// --- 全局變量 ---
let conversationHistory = [];
let currentChapterData = null; // 用戶主動選擇的章節
let initialContentChapter = null; // 記錄初始隨機顯示的章節信息
let hongloumengData = null;
let gaokaoData = null;

const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const chatButton = document.getElementById('chat-button');
const chapterMenu = document.getElementById('chapter-menu');
const toggleMenuBtn = document.getElementById('toggle-menu-btn');
const animalEmojis = ['😼', '🐶', '🦊', '🐻', '🐼', '🐰', '🐯', '🦉'];

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    Promise.all([
        fetch('data/hongloumeng.json').then(res => res.ok ? res.json() : Promise.reject(`紅樓夢數據加載失敗: ${res.status}`)),
        fetch('data/gaokao.json').then(res => res.ok ? res.json() : Promise.reject(`高考數據加載失敗: ${res.status}`))
    ])
    .then(([hlmData, gkData]) => {
        hongloumengData = hlmData;
        gaokaoData = gkData;
        loadInitialContent();
        loadChapterMenu();
    })
    .catch(error => {
        console.error("初始化數據加載失敗:", error);
        messagesContainer.innerHTML = `<p style="color: red;">基礎數據加載失敗，請刷新頁面或檢查網絡連接。</p>`;
        if (chatButton) chatButton.disabled = true;
        if (toggleMenuBtn) toggleMenuBtn.disabled = true;
    });

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
    chapterMenu.innerHTML = '';
    hongloumengData.chapters.forEach(chapter => {
        const btn = document.createElement('button');
        btn.textContent = `第 ${chapter.chapter} 回 ${chapter.title}`;
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

    messagesContainer.innerHTML = '';
    conversationHistory = [];
    currentChapterData = null; // 確保初始狀態沒有選定章節
    initialContentChapter = null; // 重置初始章節信息

    try {
        const randomIndex = Math.floor(Math.random() * hongloumengData.chapters.length);
        const randomChapter = hongloumengData.chapters[randomIndex];
        // *** 記錄初始內容的來源章節 ***
        initialContentChapter = randomChapter;
        const chapterContent = randomChapter.content || "";
        const chapterInfo = `（隨機摘自 第 ${randomChapter.chapter} 回 ${randomChapter.title}）`;

        const lines = chapterContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        let poem = "";
        let potentialPoemLines = [];
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].length < 30 && lines[i].length > 1 && !lines[i].startsWith('【')) { // 調整詩句長度判斷
                potentialPoemLines.push(lines[i]);
                if (potentialPoemLines.length >= 4 && potentialPoemLines.some(l => /[，。！？]/.test(l))) {
                     // 檢查是否像詩歌（例如，包含對仗或特定節奏感 - 這裡簡化）
                     if(potentialPoemLines.every(l => l.length < 15)) { // 傾向於更短的句子
                         poem = potentialPoemLines.join('\n');
                         break;
                     }
                }
            } else {
                // 如果不是短句，或者行數過多但未形成詩歌，重置
                if (potentialPoemLines.length > 0) potentialPoemLines = [];
            }
        }
         // 如果循環結束仍有潛在詩行，也認為是詩歌（比如只有兩句）
        if (!poem && potentialPoemLines.length >= 2) {
            poem = potentialPoemLines.join('\n');
        }

        let initialText = "";
        if (poem) {
            initialText = `${poem}\n\n${chapterInfo}`;
        } else {
            let excerpt = chapterContent.substring(0, 150);
            const lastPunctuation = Math.max(excerpt.lastIndexOf('。'), excerpt.lastIndexOf('！'), excerpt.lastIndexOf('？'), excerpt.lastIndexOf('；'));
            if (lastPunctuation > 50) {
                excerpt = excerpt.substring(0, lastPunctuation + 1);
            } else if (excerpt.length > 100) {
                 excerpt += "...";
            }
            initialText = `${excerpt}\n\n${chapterInfo}`;
        }

        const displayMessage = `偶拾書中一頁，錄得數語，以饗客官：\n\n${initialText}`;
        appendMessageToChat('ai', displayMessage);

        // *** 將代表初始顯示的消息加入歷史 ***
        // 使用特殊標記或簡化內容，避免Prompt過長
        conversationHistory.push({
            role: 'ai',
            content: `(系統展示了隨機內容: ${initialText.substring(0, 100)}... ${chapterInfo})`
        });


    } catch (error) {
        console.error("處理初始內容時出錯:", error);
        appendMessageToChat('ai', '歡迎來到 AI 紅樓夢。抱歉，準備初始內容時遇到了些麻煩。');
    }
}


// 加載選定章節內容到對話框
function loadChapter(chapter) {
    console.log(`加載章節: 第 ${chapter.chapter} 回`);
    currentChapterData = chapter; // **設置當前章節**
    initialContentChapter = null; // **清除初始隨機章節記錄**
    conversationHistory = []; // 清空對話歷史

    const formattedContent = formatContentForDisplay(chapter.content);
    messagesContainer.innerHTML = '';

    // **為正文顯示添加特殊類**
    appendMessageToChat('ai', `<h3>第 ${chapter.chapter} 回 ${chapter.title}</h3>\n${formattedContent}`, ['chapter-content-display']);

    requestInitialAnalysis(chapter);

    if (window.innerWidth < 768) {
         chapterMenu.style.display = 'none';
         toggleMenuBtn.textContent = '顯示目錄';
    }
}

// 格式化文本內容（優先按段落，其次按句子）
function formatContentForDisplay(text) {
    if (!text) return "";

    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 主要嘗試按雙換行分段
    const paragraphs = text.split(/\n{2,}/g)
                           .map(p => p.replace(/\n/g, ' ').trim()) // 段內單換行變空格
                           .filter(p => p.length > 0);

    // 如果分段效果不明顯（例如段落數很少或只有一段），並且文本較長，嘗試按句子分割
    if (paragraphs.length <= 2 && text.length > 200) {
        // 使用正則表達式匹配句子結束標誌，同時處理引號等情況
        const sentences = text.match(/[^。！？…”]+[。！？…”]?(\s|$)/g);
        if (sentences && sentences.length > 1) {
             // console.log("Splitting by sentence");
             return sentences.map(s => `<p>${s.trim()}</p>`).join('');
        } else {
             // console.log("Fallback to single paragraph");
             // 如果句子分割也失敗，返回單一段落
             return `<p>${text.replace(/\n/g, ' ').trim()}</p>`;
        }
    }

    // console.log(`Splitting by ${paragraphs.length} paragraphs`);
    return paragraphs.map(p => `<p>${p}</p>`).join('');
}


// 請求 AI 對新加載的章節進行初始分析/出題
function requestInitialAnalysis(chapter) {
    if (!gaokaoData || !gaokaoData.data || !gaokaoData.instructions) {
        console.error("高考數據未加載或格式錯誤，無法生成模擬題。");
        appendMessageToChat('ai', "（抱歉，參考資料不足，暫無法為此章回出題。）");
        return;
    }

    showLoadingIndicator(true, '命題');

    try {
        const chapterContentExcerpt = chapter.content.substring(0, 500).replace(/\s+/g, ' ') + "...";
        let relevantQuestions = gaokaoData.data.filter(q => {
            const chapterNumMatch = chapter.title.match(/第(\s*[一二三四五六七八九十百]+)\s*回/);
            const chapterNum = chapterNumMatch ? chapterNumMatch[1].replace(/\s/g,'') : null;
            return (chapterNum && q.chapter && q.chapter.includes(chapterNum)) ||
                   (q.originalQuestion && chapter.title.split('').some(char => q.originalQuestion.includes(char))) ||
                   (q.originalQuestion && chapterContentExcerpt.substring(0,100).split('').some(char => q.originalQuestion.includes(char)));
        });
        if (relevantQuestions.length === 0) relevantQuestions = gaokaoData.data;
        const chosenQuestion = relevantQuestions[Math.floor(Math.random() * relevantQuestions.length)];

        const prompt = `吾乃曹雪芹。方纔閱覽《紅樓夢》第 ${chapter.chapter} 回：${chapter.title}。\n\n此回情節撮要如下：\n“${chapterContentExcerpt}”\n\n觀當今科舉（高考）之風，常以此書設題考較學子。據老夫所見資料（${gaokaoData.instructions}），與本章相關之題型，或可參照此例：“${chosenQuestion.originalQuestion}”\n\n然老夫意欲別出心裁，依本章 ${chapter.title} 之內容，為客官擬一模擬新題如下：\n\n[此處生成緊密結合本章內容的新模擬題，題型風格參考上述高考真題，切記切記：萬勿提供答案！！！]\n\n客官閱後，若有不明或欲深談此章，老夫願洗耳恭聽。`;

        // **修改歷史記錄方式**
        // 不直接加 user 請求，在 buildPrompt 時會體現上下文
        // conversationHistory.push({ role: 'user', content: `(請為第 ${chapter.chapter} 回出題並概述)` });

        callGeminiAPI(prompt, (result) => {
            // **在顯示結果前回調中隱藏指示器**
            showLoadingIndicator(false);
            appendMessageToChat('ai', result);
            conversationHistory.push({ role: 'model', content: result });
            trimConversationHistory();
        });

    } catch (error) {
        console.error("生成初始分析 Prompt 時出錯:", error);
        showLoadingIndicator(false); // 出錯也要隱藏
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
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
});

// 發送聊天消息
function sendChatMessage() {
    const messageText = userInput.value.trim();
    if (!messageText) return;

    appendMessageToChat('user', messageText);
    userInput.value = '';

    // *** 處理首次對話的上下文 ***
    let activeChapterContext = currentChapterData;
    if (!activeChapterContext && initialContentChapter) {
        console.log("用戶正在回應初始內容，使用 initialContentChapter 作為上下文");
        activeChapterContext = initialContentChapter;
        // 可選：在首次交互後，可以將 initialContentChapter 賦值給 currentChapterData
        // currentChapterData = initialContentChapter;
        // 或者直接清除，讓後續對話不帶特定章節上下文，除非用戶點擊新章節
        initialContentChapter = null; // 響應一次後清除，避免一直關聯
    }


    conversationHistory.push({ role: 'user', content: messageText });

    // **顯示加載提示**
    showLoadingIndicator(true, '回覆中');

    // 使用 activeChapterContext 構建 prompt
    const prompt = buildPromptWithHistory(messageText, activeChapterContext);

    callGeminiAPI(prompt, (result) => {
        // **在顯示結果前回調中隱藏指示器**
        showLoadingIndicator(false);
        appendMessageToChat('ai', result);
        conversationHistory.push({ role: 'model', content: result });
        trimConversationHistory();
    });
}

// 監聽聊天按鈕點擊
chatButton.addEventListener('click', sendChatMessage);

// 監聽輸入框 Enter 鍵
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
    }
});

// --- 輔助函數 ---

// 將消息添加到聊天窗口 (添加 classes 參數)
function appendMessageToChat(sender, message, classes = []) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message-bubble', sender === 'user' ? 'user-message' : 'ai-message');
    // 添加額外傳入的 class
    if (classes && classes.length > 0) {
        messageElement.classList.add(...classes);
    }

    if (sender === 'ai') {
        const safeMessage = message.replace(/</g, "<").replace(/>/g, ">");
        messageElement.innerHTML = formatContentForDisplay(safeMessage);
    } else {
        const escapedMessage = message.replace(/</g, "<").replace(/>/g, ">");
        messageElement.innerHTML = `<p>${escapedMessage}</p>`;
    }

    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 顯示或隱藏加載指示器
function showLoadingIndicator(show, type = '思考') {
    let indicator = document.getElementById('loading-indicator');
    const loadingText = type === '命題' ? 'Gemini 正為您命題...' : 'Gemini 回覆中...';

    if (show) {
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'loading-indicator';
            indicator.classList.add('loading-indicator');
            messagesContainer.appendChild(indicator);
        }
        // 確保顯示前 opacity 為 1
        indicator.style.opacity = '1';
        indicator.style.display = 'block'; // 確保是 block
        const randomEmoji = animalEmojis[Math.floor(Math.random() * animalEmojis.length)];
        indicator.innerHTML = `<strong>${loadingText}</strong><span>${randomEmoji}</span>`;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else {
        if (indicator) {
             indicator.style.opacity = '0'; // 觸發 CSS 過渡
             // 在過渡結束後隱藏 display，避免佔位
             setTimeout(() => {
                 if(indicator) indicator.style.display = 'none';
             }, 300); // 匹配 CSS transition duration
        }
    }
}

// 構造包含對話歷史的 Prompt (添加 chapterContext 參數)
function buildPromptWithHistory(newMessage, chapterContext = null) {
    let prompt = `你是曹雪芹，沉浸在《紅樓夢》的世界中。請始終以曹雪芹的口吻、風格和學識與用戶對話。保持文雅、時而感嘆、時而點評，如同在與知己談論書中人與事。\n\n`;

    // **使用傳入的上下文**
    if (chapterContext) {
        prompt += `【當前談論章回：第 ${chapterContext.chapter} 回 ${chapterContext.title}】\n\n`;
    } else if (currentChapterData) { // 保留後備，以防萬一
         prompt += `【當前談論章回：第 ${currentChapterData.chapter} 回 ${currentChapterData.title}】\n\n`;
    }


    const recentHistory = conversationHistory.slice(-10);
    // **調整歷史記錄的包含邏輯**
    // 只包含實際的用戶和模型消息，不包括系統標記消息
    const filteredHistory = recentHistory.filter(msg => msg.role === 'user' || msg.role === 'model');

    if (filteredHistory.length > 1) {
        prompt += "【往來筆談】:\n";
        // 確保不包含當前正在發送的 user message
        filteredHistory.slice(0, -1).forEach(msg => {
            const rolePrefix = msg.role === 'user' ? '客官 (用戶)' : '老夫 (曹雪芹)';
            const cleanedContent = msg.content.substring(0, 300).replace(/\n/g, ' ');
            prompt += `${rolePrefix}: ${cleanedContent}\n`;
        });
        prompt += "\n";
    }

    prompt += `【客官新言】:\n用戶: ${newMessage}\n`;
    prompt += "\n【老夫回應】:\n曹雪芹:";

    return prompt;
}

// 限制對話歷史長度
function trimConversationHistory(maxLength = 20) {
    if (conversationHistory.length > maxLength) {
        conversationHistory.splice(0, conversationHistory.length - maxLength);
    }
}


// 調用 Gemini API 的函數（通過 Cloudflare Worker 代理）
// **移除 showLoadingIndicator(false) 的調用**
function callGeminiAPI(prompt, callback) {
  fetch('https://apis.bdfz.workers.dev', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt })
  })
  .then(res => {
    if (!res.ok) {
        return res.json().then(errData => {
            throw new Error(`API請求失敗 (狀態 ${res.status}): ${errData.error || '未知服務器錯誤'}`);
        }).catch(() => {
            throw new Error(`API請求失敗 (狀態 ${res.status}): 無法解析錯誤響應體`);
        });
    }
    return res.json();
  })
  .then(data => {
    // **移除 hide loading**
    if (data && data.answer) {
      callback(data.answer);
    } else {
      console.error('API 返回數據格式錯誤或無回答:', data);
      callback("唉，老夫搜索枯腸，竟一時語塞。許是方纔神遊太虛，待緩過神來再與客官細談。");
    }
  })
  .catch(err => {
    console.error('調用 API 或處理響應時出錯：', err);
    // **移除 hide loading，但仍需處理錯誤回調**
    // 提供錯誤信息給回調，讓調用者決定如何顯示
     callback(`噫！與後端通路似乎阻滯不暢：<br><pre style="font-size: 0.8em; color: #888;">${err.message}</pre>還請客官稍待片刻，或尋網站主事之人問詢。`);
     // 可能需要一個標誌來區分正常回答和錯誤信息
     // 或者讓 appendMessageToChat 處理錯誤樣式
  });
}