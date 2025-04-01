// --- 全局變量 ---
let conversationHistory = []; // 存儲對話歷史 { role: 'user'/'model', content: '...' }
let currentChapterData = null; // 存儲當前加載的章節數據
let hongloumengData = null; // 存儲紅樓夢全書數據以便隨機選取
let gaokaoData = null; // 存儲高考數據

const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const chatButton = document.getElementById('chat-button');
const chapterMenu = document.getElementById('chapter-menu');
const toggleMenuBtn = document.getElementById('toggle-menu-btn');
const animalEmojis = ['😼', '🐶', '🦊', '🐻', '🐼', '🐰', '🐯', '🦉'];

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    // 先加載必要的數據
    Promise.all([
        fetch('data/hongloumeng.json').then(res => res.ok ? res.json() : Promise.reject(`紅樓夢數據加載失敗: ${res.status}`)),
        fetch('data/gaokao.json').then(res => res.ok ? res.json() : Promise.reject(`高考數據加載失敗: ${res.status}`))
    ])
    .then(([hlmData, gkData]) => {
        hongloumengData = hlmData;
        gaokaoData = gkData;
        // 數據加載成功後再執行後續操作
        loadInitialContent(); // 加載初始內容
        loadChapterMenu();    // 加載章節列表
    })
    .catch(error => {
        console.error("初始化數據加載失敗:", error);
        messagesContainer.innerHTML = `<p style="color: red;">基礎數據加載失敗，請刷新頁面或檢查網絡連接。</p>`;
        // 可以考慮禁用交互按鈕
        if (chatButton) chatButton.disabled = true;
        if (toggleMenuBtn) toggleMenuBtn.disabled = true;
    });

    // 檢查並應用保存的主題偏好
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }
});


// 加載章節列表
function loadChapterMenu() {
    if (!hongloumengData || !hongloumengData.chapters) {
        console.error('紅樓夢數據未加載或格式錯誤，無法生成目錄');
        chapterMenu.innerHTML = '<p style="color: red;">無法加載章節列表。</p>';
        return;
    }
    // 清空現有按鈕
    chapterMenu.innerHTML = '';
    // 添加章節按鈕
    hongloumengData.chapters.forEach(chapter => {
        const btn = document.createElement('button');
        // btn.className = 'ghibli-button'; // 不再需要基類，直接用 nth-child 控制
        btn.textContent = `第 ${chapter.chapter} 回 ${chapter.title}`;
        // btn.dataset.chapterData = JSON.stringify(chapter); // 直接傳對象更好
        btn.onclick = () => loadChapter(chapter);
        chapterMenu.appendChild(btn);
    });
}

// 加載初始內容 (隨機詩詞或摘錄)
function loadInitialContent() {
    if (!hongloumengData || !hongloumengData.chapters || hongloumengData.chapters.length === 0) {
         appendMessageToChat('ai', '歡迎來到 AI 紅樓夢。數據似乎有些問題，暫無法顯示內容。請稍後再試。');
         return;
    }

    // 清空現有內容和歷史
    messagesContainer.innerHTML = '';
    conversationHistory = [];
    currentChapterData = null; // 確保初始狀態沒有選定章節

    try {
        // 1. 隨機選擇一個章節
        const randomIndex = Math.floor(Math.random() * hongloumengData.chapters.length);
        const randomChapter = hongloumengData.chapters[randomIndex];
        const chapterContent = randomChapter.content || "";
        const chapterInfo = `（第 ${randomChapter.chapter} 回 ${randomChapter.title}）`;

        // 2. 嘗試尋找詩詞 (簡單規則：連續多行短句)
        const lines = chapterContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        let poem = "";
        let potentialPoemLines = [];
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].length < 20 && lines[i].length > 2) { // 可能是詩句的長度
                potentialPoemLines.push(lines[i]);
                // 檢查是否連續超過3行短句，且包含常見詩歌標點
                if (potentialPoemLines.length >= 4 && potentialPoemLines.some(l => /[，。！？]/.test(l))) {
                    poem = potentialPoemLines.join('\n');
                    break; // 找到第一組就停止
                }
            } else {
                potentialPoemLines = []; // 不是連續短句，重置
            }
        }

        // 3. 如果沒找到詩詞，提取開頭片段
        let initialText = "";
        if (poem) {
            initialText = `${poem}\n\n${chapterInfo}`;
        } else {
            // 提取前 150 個字符左右的片段，並嘗試在標點處斷句
            let excerpt = chapterContent.substring(0, 150);
            const lastPunctuation = Math.max(excerpt.lastIndexOf('。'), excerpt.lastIndexOf('！'), excerpt.lastIndexOf('？'), excerpt.lastIndexOf('；'));
            if (lastPunctuation > 50) { // 確保不是太短
                excerpt = excerpt.substring(0, lastPunctuation + 1);
            } else if (excerpt.length > 100) {
                 excerpt += "..."; // 如果沒有合適標點且較長，加省略號
            }
            initialText = `${excerpt}\n\n${chapterInfo}`;
        }

        // 4. 顯示初始內容
        appendMessageToChat('ai', `偶拾書中一頁，錄得數語，以饗客官：\n\n${initialText}`);

    } catch (error) {
        console.error("處理初始內容時出錯:", error);
        appendMessageToChat('ai', '歡迎來到 AI 紅樓夢。抱歉，準備初始內容時遇到了些麻煩。');
    }
}


// 加載選定章節內容到對話框
function loadChapter(chapter) {
    console.log(`加載章節: 第 ${chapter.chapter} 回`);
    currentChapterData = chapter; // 更新當前章節數據
    conversationHistory = []; // 清空對話歷史

    // 格式化章節內容
    const formattedContent = formatContentForDisplay(chapter.content);

    // 清空現有消息
    messagesContainer.innerHTML = '';

    // 顯示章節標題和內容 (作為 AI 的第一條消息)
    const chapterIntro = `<h3>第 ${chapter.chapter} 回 ${chapter.title}</h3>\n${formattedContent}`;
    appendMessageToChat('ai', chapterIntro); // 使用 appendMessageToChat 自動滾動

    // 請求 AI 進行初始分析或出題 (結合高考數據)
    requestInitialAnalysis(chapter);

    // 觸發後自動隱藏目錄 (在小螢幕上)
    if (window.innerWidth < 768) {
         chapterMenu.style.display = 'none';
         toggleMenuBtn.textContent = '顯示目錄';
    }
}

// 格式化文本內容（分段，無分隔符）
function formatContentForDisplay(text) {
    if (!text) return "";

    // 替換顯式換行符為段落標記，處理不同系統的換行符
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 將兩個或更多連續換行符視為段落分隔
    const paragraphs = text.split(/\n{2,}/g)
                           .map(p => p.replace(/\n/g, ' ').trim()) // 將段內單換行變空格
                           .filter(p => p.length > 0); // 過濾空段落

    // 如果上面分段效果不好（比如沒有雙換行），嘗試按標點分段
    if (paragraphs.length <= 1 && text.length > 200) {
        // 按常見結束標點分段，保留標點
         const sentences = text.match(/[^。！？]+[。！？]?/g) || [text];
         return sentences.map(s => `<p>${s.trim()}</p>`).join('');
    }

    // 用 <p> 包裹每個段落
    return paragraphs.map(p => `<p>${p}</p>`).join('');
}


// 請求 AI 對新加載的章節進行初始分析/出題 (結合 gaokao.json)
function requestInitialAnalysis(chapter) {
    if (!gaokaoData || !gaokaoData.data || !gaokaoData.instructions) {
        console.error("高考數據未加載或格式錯誤，無法生成模擬題。");
        // 可以選擇顯示一個提示或直接跳過
        appendMessageToChat('ai', "（抱歉，參考資料不足，暫無法為此章回出題。）");
        return;
    }

    // 顯示加載提示
    showLoadingIndicator(true, '命題'); // true 表示正在為初始加載出題

    try {
        // 提取章節內容摘要 (前 500 字符)
        const chapterContentExcerpt = chapter.content.substring(0, 500).replace(/\s+/g, ' ') + "...";

        // 查找相關高考題
        let relevantQuestions = gaokaoData.data.filter(q => {
            // 簡單匹配章節標題中的數字或關鍵詞
            const chapterNumMatch = chapter.title.match(/第(\s*[一二三四五六七八九十百]+)\s*回/);
            const chapterNum = chapterNumMatch ? chapterNumMatch[1].replace(/\s/g,'') : null;
            // 簡易匹配，實際可能需要更複雜的關鍵詞提取和匹配
            return (chapterNum && q.chapter && q.chapter.includes(chapterNum)) ||
                   (q.originalQuestion && chapter.title.split('').some(char => q.originalQuestion.includes(char))) || // 模糊匹配標題字
                   (q.originalQuestion && chapterContentExcerpt.substring(0,100).split('').some(char => q.originalQuestion.includes(char))); // 模糊匹配開頭內容字
        });

        // 如果找不到，隨機選一個
        if (relevantQuestions.length === 0) {
            relevantQuestions = gaokaoData.data;
        }
        const chosenQuestion = relevantQuestions[Math.floor(Math.random() * relevantQuestions.length)];

        // 優化後的 Prompt (結合 gaokao.json)
        const prompt = `吾乃曹雪芹。方纔閱覽《紅樓夢》第 ${chapter.chapter} 回：${chapter.title}。\n\n此回情節撮要如下：\n“${chapterContentExcerpt}”\n\n觀當今科舉（高考）之風，常以此書設題考較學子。據老夫所見資料（${gaokaoData.instructions}），與本章相關之題型，或可參照此例：“${chosenQuestion.originalQuestion}”\n\n然老夫意欲別出心裁，依本章 ${chapter.title} 之內容，為客官擬一模擬新題如下：\n\n[此處生成緊密結合本章內容的新模擬題，題型風格參考上述高考真題，切記切記：萬勿提供答案！！！]\n\n客官閱後，若有不明或欲深談此章，老夫願洗耳恭聽。`;

        // 添加隱式用戶請求到歷史
        conversationHistory.push({ role: 'user', content: `(請為第 ${chapter.chapter} 回出題並概述)` });

        // 調用 API
        callGeminiAPI(prompt, (result) => {
            // showLoadingIndicator(false); // callGeminiAPI 內部會調用
            appendMessageToChat('ai', result); // 顯示 AI 的回覆（包含題目）
            // 將 AI 的首次回覆加入歷史記錄
            conversationHistory.push({ role: 'model', content: result });
            trimConversationHistory(); // 整理歷史
        });

    } catch (error) {
        console.error("生成初始分析 Prompt 時出錯:", error);
        showLoadingIndicator(false);
        appendMessageToChat('ai', `（哎呀，構思題目時出了些岔子：${error.message}）`);
    }
}

// --- 用戶交互 ---

// 切換目錄顯示/隱藏
toggleMenuBtn.addEventListener('click', () => {
    if (chapterMenu.style.display === 'none' || chapterMenu.style.display === '') {
        chapterMenu.style.display = 'block';
        toggleMenuBtn.textContent = '隱藏目錄';
    } else {
        chapterMenu.style.display = 'none';
        toggleMenuBtn.textContent = '顯示目錄';
    }
});

// 切換黑暗模式
document.getElementById('toggle-dark-btn').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
    } else {
        localStorage.setItem('theme', 'light');
    }
});

// 發送聊天消息
function sendChatMessage() {
    const messageText = userInput.value.trim();
    if (!messageText) return;

    appendMessageToChat('user', messageText);
    userInput.value = '';

    conversationHistory.push({ role: 'user', content: messageText });

    showLoadingIndicator(true, '回覆中'); // 更新提示文字

    const prompt = buildPromptWithHistory(messageText);

    callGeminiAPI(prompt, (result) => {
        // showLoadingIndicator(false); // callGeminiAPI 內部會調用
        appendMessageToChat('ai', result);
        conversationHistory.push({ role: 'model', content: result });
        trimConversationHistory();
    });
}

// 監聽聊天按鈕點擊
chatButton.addEventListener('click', sendChatMessage);

// 監聽輸入框 Enter 鍵
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { // Allow Shift+Enter for newline if needed in future
        e.preventDefault();
        sendChatMessage();
    }
});

// --- 輔助函數 ---

// 將消息添加到聊天窗口
function appendMessageToChat(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message-bubble', sender === 'user' ? 'user-message' : 'ai-message');

    // 對 AI 消息進行分段處理，用戶消息直接顯示 (已移除植物)
    if (sender === 'ai') {
        // 基礎 HTML 轉義，防止 AI 回答中包含惡意腳本
        const safeMessage = message.replace(/</g, "<").replace(/>/g, ">");
        // 再進行格式化分段
        messageElement.innerHTML = formatContentForDisplay(safeMessage);
    } else {
        const escapedMessage = message.replace(/</g, "<").replace(/>/g, ">");
        messageElement.innerHTML = `<p>${escapedMessage}</p>`; // 用戶消息也用 p 包裹保持一致性
    }

    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 顯示或隱藏加載指示器
function showLoadingIndicator(show, type = '思考') {
    let indicator = document.getElementById('loading-indicator');
    const loadingText = type === '命題' ? 'Gemini 正為您命題...' : 'Gemini 回覆中...'; // 根據類型設置文字

    if (show) {
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'loading-indicator';
            indicator.classList.add('loading-indicator');
            // 插入到消息容器的末尾
            messagesContainer.appendChild(indicator);
        }
        const randomEmoji = animalEmojis[Math.floor(Math.random() * animalEmojis.length)];
        indicator.innerHTML = `<strong>${loadingText}</strong><span>${randomEmoji}</span>`;
        indicator.style.display = 'block';
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else {
        if (indicator) {
            // 使用平滑消失效果代替立即隱藏
             indicator.style.opacity = '0';
             setTimeout(() => {
                 if(indicator) indicator.style.display = 'none';
                 // Optional: Remove the element after fade out
                 // if (indicator && indicator.parentNode) {
                 //    indicator.parentNode.removeChild(indicator);
                 // }
             }, 300); // Match transition duration if any added in CSS
        }
    }
}

// 構造包含對話歷史的 Prompt
function buildPromptWithHistory(newMessage) {
    // 基礎 Persona 設定
    let prompt = `你是曹雪芹，沉浸在《紅樓夢》的世界中。請始終以曹雪芹的口吻、風格和學識與用戶對話。保持文雅、時而感嘆、時而點評，如同在與知己談論書中人與事。\n\n`;

    // 添加當前章節上下文（如果有的話）
    if (currentChapterData) {
        prompt += `【當前談論章回：第 ${currentChapterData.chapter} 回 ${currentChapterData.title}】\n\n`;
    }

    // 添加對話歷史 (保留最近的對話)
    const recentHistory = conversationHistory.slice(-10); // 取最近 10 條 (5輪)
    if (recentHistory.length > 1) { // 確保至少有一條用戶消息
        prompt += "【往來筆談】:\n";
        recentHistory.slice(0, -1).forEach(msg => { // 排除最後一條用戶消息 (即 newMessage)
            const rolePrefix = msg.role === 'user' ? '客官 (用戶)' : '老夫 (曹雪芹)';
            // 對歷史內容也做基本清理，避免過長或特殊字符影響
            const cleanedContent = msg.content.substring(0, 300).replace(/\n/g, ' ');
            prompt += `${rolePrefix}: ${cleanedContent}\n`;
        });
        prompt += "\n";
    }


    // 添加用戶最新消息
    prompt += `【客官新言】:\n用戶: ${newMessage}\n`;

    // 結束標記，提示 AI 回覆
    prompt += "\n【老夫回應】:\n曹雪芹:";

    // console.log("Generated Prompt Length:", prompt.length); // 調試長度
    return prompt;
}

// 限制對話歷史長度 (現在在 buildPromptWithHistory 中截取)
function trimConversationHistory(maxLength = 20) { // 保留一個最大長度以防萬一
    if (conversationHistory.length > maxLength) {
        conversationHistory.splice(0, conversationHistory.length - maxLength);
    }
}


// 調用 Gemini API 的函數（通過 Cloudflare Worker 代理）
function callGeminiAPI(prompt, callback) {
  // console.log("Sending prompt to Worker:", prompt);
  fetch('https://apis.bdfz.workers.dev', { // 確保這是你的 Worker URL
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt: prompt })
  })
  .then(res => {
    if (!res.ok) {
        return res.json().then(errData => {
            throw new Error(`API請求失敗 (狀態 ${res.status}): ${errData.error || '未知服務器錯誤'}`);
        }).catch((parseError) => { // 如果解析錯誤信息也失敗
            throw new Error(`API請求失敗 (狀態 ${res.status}): 無法解析錯誤響應體`);
        });
    }
    return res.json();
  })
  .then(data => {
    // console.log('API返回數據：', data);
    showLoadingIndicator(false); // 無論成功失敗，API 有響應就隱藏加載
    if (data && data.answer) {
      callback(data.answer);
    } else {
      console.error('API 返回數據格式錯誤或無回答:', data);
      callback("唉，老夫搜索枯腸，竟一時語塞。許是方纔神遊太虛，待緩過神來再與客官細談。");
    }
  })
  .catch(err => {
    console.error('調用 API 或處理響應時出錯：', err);
    showLoadingIndicator(false); // 捕獲到錯誤也要隱藏加載
    appendMessageToChat('ai', `噫！與後端通路似乎阻滯不暢：<br><pre style="font-size: 0.8em; color: #888;">${err.message}</pre>還請客官稍待片刻，或尋網站主事之人問詢。`);
  });
}