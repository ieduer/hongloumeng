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
// 更新: 獲取目錄標籤按鈕，但不再需要事件監聽
const menuLabelBtn = document.getElementById('menu-label-btn');
const animalEmojis = ['😼', '🐶', '🦊', '🐻', '🐼', '🐰', '🐯', '🦉', '🍁', '🏮']; // 添加一些相關 emoji

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
        // 目錄始終顯示，不需要額外操作
    })
    .catch(error => {
        console.error("初始化數據加載失敗:", error);
        messagesContainer.innerHTML = `<p style="color: red;">基礎數據加載失敗，請刷新頁面或檢查網絡連接。</p>`;
        if (chatButton) chatButton.disabled = true;
        // 更新: 移除對 toggleMenuBtn 的禁用，因為它只是標籤
        // if (toggleMenuBtn) toggleMenuBtn.disabled = true;
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
    chapterMenu.innerHTML = ''; // 清空目錄內容
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
    currentChapterData = null;
    initialContentChapter = null;

    try {
        const randomIndex = Math.floor(Math.random() * hongloumengData.chapters.length);
        const randomChapter = hongloumengData.chapters[randomIndex];
        initialContentChapter = randomChapter;
        const chapterContent = randomChapter.content || "";
        const chapterInfo = `（隨機摘自 第 ${randomChapter.chapter} 回 ${randomChapter.title}）`;

        // 提取詩詞或摘要的邏輯保持不變...
        const lines = chapterContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        let poem = "";
        let potentialPoemLines = [];
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].length < 30 && lines[i].length > 1 && !lines[i].startsWith('【')) {
                potentialPoemLines.push(lines[i]);
                if (potentialPoemLines.length >= 4 && potentialPoemLines.some(l => /[，。！？]/.test(l))) {
                     if(potentialPoemLines.every(l => l.length < 15)) {
                         poem = potentialPoemLines.join('\n');
                         break;
                     }
                }
            } else {
                if (potentialPoemLines.length > 0) potentialPoemLines = [];
            }
        }
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
        // 更新: 初始消息也用 formatContentForDisplay 處理換行
        appendMessageToChat('ai', displayMessage);

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
    currentChapterData = chapter; // 設置當前章節
    initialContentChapter = null; // 清除初始隨機章節記錄
    conversationHistory = []; // 清空對話歷史

    // 更新: 確保傳遞的是完整的 chapter.content
    const formattedContent = formatContentForDisplay(chapter.content);
    messagesContainer.innerHTML = ''; // 清空現有消息

    // 顯示章節標題和全文，添加特殊 class 以應用背景色
    appendMessageToChat('ai', `<h3>第 ${chapter.chapter} 回 ${chapter.title}</h3>\n${formattedContent}`, ['chapter-content-display']);

    // 加入對話歷史 (簡化版)
     conversationHistory.push({
         role: 'ai',
         content: `(系統展示了 第 ${chapter.chapter} 回 ${chapter.title} 全文)`
     });

    // 為新章節請求 AI 分析/出題
    requestInitialAnalysis(chapter);

    // 更新: 移除移動端隱藏菜單的邏輯，菜單始終顯示
    // if (window.innerWidth < 768) {
    //      // chapterMenu.style.display = 'none'; // 不再隱藏
    //      // menuLabelBtn.textContent = '顯示目錄'; // 按鈕文字固定為'目錄'
    // }
}

// 格式化文本內容（優先按段落，其次按句子）
function formatContentForDisplay(text) {
    if (!text) return "";

    // 統一換行符
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 移除文末的 (本章完) 等標記
    text = text.replace(/\(本[章回]完\)$/g, '').trim();

    // 嘗試按空行分段 (匹配一個或多個空行)
    // 保留段首空格 (全角/半角) 以維持縮進效果
    const paragraphs = text.split(/\n\s*\n+/g) // 分割符是換行+可選空白+至少一個換行
                           .map(p => p.trim()) // 去掉段落前後的空白，但保留段內的
                           .filter(p => p.length > 0);

    // 如果分段效果不明顯（比如只有一段或很少段落）
    if (paragraphs.length <= 5 && text.length > 300) {
        // 嘗試按單個換行符分段，這對於詩歌或列表可能更友好
        const lines = text.split('\n')
                          .map(l => l.trim())
                          .filter(l => l.length > 0);
        if (lines.length > paragraphs.length) {
            // console.log("Splitting by single newline");
            // 對每個行添加 <p> 標籤，並嘗試保留原始縮進（通過CSS實現可能更好）
            return lines.map(l => `<p>${l.replace(/</g, "<").replace(/>/g, ">")}</p>`).join('');
        }
    }

    // 如果主要按空行分段，效果不錯
    if (paragraphs.length > 1) {
        // console.log(`Splitting by ${paragraphs.length} paragraphs (double newline)`);
        return paragraphs.map(p => `<p>${p.replace(/</g, "<").replace(/>/g, ">")}</p>`).join('');
    }

    // 最後的兜底：如果上面都不理想，整個作為一個段落
    // console.log("Fallback to single paragraph");
    return `<p>${text.replace(/\n/g, ' ').trim().replace(/</g, "<").replace(/>/g, ">")}</p>`;
}


// 請求 AI 對新加載的章節進行初始分析/出題
function requestInitialAnalysis(chapter) {
    if (!gaokaoData || !gaokaoData.data || !gaokaoData.instructions) {
        console.error("高考數據未加載或格式錯誤，無法生成模擬題。");
        appendMessageToChat('ai', "（抱歉，參考資料不足，暫無法為此章回出題。）");
        return;
    }

    // 更新: 使用修改後的 showLoadingIndicator
    showLoadingIndicator('Gemini 正為您命題...');

    try {
        // 提取章節摘要和隨機選取高考題目的邏輯保持不變...
        const chapterContentExcerpt = chapter.content.substring(0, 500).replace(/\s+/g, ' ') + "...";
        let relevantQuestions = gaokaoData.data.filter(q => {
            const chapterNumMatch = chapter.title.match(/第(\s*[一二三四五六七八九十百]+)\s*回/);
            const chapterNum = chapterNumMatch ? chapterNumMatch[1].replace(/\s/g,'') : null;
            return (chapterNum && q.chapter && q.chapter.includes(chapterNum)) ||
                   (q.originalQuestion && chapter.title.split('').some(char => q.originalQuestion.includes(char))) ||
                   (q.originalQuestion && chapterContentExcerpt.substring(0,100).split('').some(char => q.originalQuestion.includes(char)));
        });
        if (relevantQuestions.length === 0) relevantQuestions = gaokaoData.data; // Fallback
        const chosenQuestion = relevantQuestions[Math.floor(Math.random() * relevantQuestions.length)];

        const prompt = `吾乃曹雪芹。方纔閱覽《紅樓夢》第 ${chapter.chapter} 回：${chapter.title}。\n\n此回情節撮要如下：\n“${chapterContentExcerpt}”\n\n觀當今科舉（高考）之風，常以此書設題考較學子。據老夫所見資料（${gaokaoData.instructions}），與本章相關之題型，或可參照此例：“${chosenQuestion.originalQuestion}”\n\n然老夫意欲別出心裁，依本章 ${chapter.title} 之內容，為客官擬一模擬新題如下：\n\n[此處生成緊密結合本章內容的新模擬題，題型風格參考上述高考真題，切記切記：萬勿提供答案！！！]\n\n客官閱後，若有不明或欲深談此章，老夫願洗耳恭聽。`;

        // 不需要添加用戶歷史記錄來觸發這個

        callGeminiAPI(prompt, (result) => {
            // 更新: 在回調中先移除指示器，再添加消息
            removeLoadingIndicator();
            appendMessageToChat('ai', result);
            // 添加模型回復到歷史
            conversationHistory.push({ role: 'model', content: result });
            trimConversationHistory();
        });

    } catch (error) {
        console.error("生成初始分析 Prompt 時出錯:", error);
        // 更新: 出錯也要移除指示器
        removeLoadingIndicator();
        appendMessageToChat('ai', `（哎呀，構思題目時出了些岔子：${error.message}）`);
    }
}

// --- 用戶交互 ---

// 更新: 移除目錄切換按鈕的事件監聽器
// toggleMenuBtn.addEventListener('click', () => { ... });

// 切換黑暗模式 (保持不變)
document.getElementById('toggle-dark-btn').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
});

// 發送聊天消息
function sendChatMessage() {
    const messageText = userInput.value.trim();
    if (!messageText) return;

    // 1. 添加用戶消息到聊天框
    appendMessageToChat('user', messageText);
    userInput.value = ''; // 清空輸入框

    // 2. 添加用戶消息到歷史記錄
    conversationHistory.push({ role: 'user', content: messageText });

    // 3. 確定上下文 (當前章節或初始內容)
    let activeChapterContext = currentChapterData;
    if (!activeChapterContext && initialContentChapter) {
        console.log("用戶正在回應初始內容，使用 initialContentChapter 作為上下文");
        activeChapterContext = initialContentChapter;
        // 響應一次後清除初始內容上下文，避免一直關聯
        initialContentChapter = null;
    }

    // 4. 顯示加載提示 (更新: 立即顯示在用戶消息下方)
    showLoadingIndicator('Gemini 回覆中...');

    // 5. 構造 Prompt
    const prompt = buildPromptWithHistory(messageText, activeChapterContext);

    // 6. 調用 API
    callGeminiAPI(prompt, (result) => {
        // 7. 更新: 在回調中，先移除加載提示
        removeLoadingIndicator();
        // 8. 添加 AI 回覆到聊天框
        appendMessageToChat('ai', result);
        // 9. 添加 AI 回覆到歷史記錄
        conversationHistory.push({ role: 'model', content: result });
        // 10. 修剪歷史記錄
        trimConversationHistory();
    });
}

// 監聽聊天按鈕點擊
chatButton.addEventListener('click', sendChatMessage);

// 監聽輸入框 Enter 鍵
userInput.addEventListener('keypress', (e) => {
    // Shift+Enter 換行，單獨 Enter 發送
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // 阻止默認換行行為
        sendChatMessage();
    }
});

// --- 輔助函數 ---

// 將消息添加到聊天窗口
function appendMessageToChat(sender, message, classes = []) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message-bubble', sender === 'user' ? 'user-message' : 'ai-message');
    if (classes && classes.length > 0) {
        messageElement.classList.add(...classes);
    }

    // 使用 formatContentForDisplay 處理 AI 消息，用戶消息直接包裹
    // 同時進行基本的 HTML 轉義防止 XSS (雖然 formatContentForDisplay 已包含)
    const safeMessage = message.replace(/</g, "<").replace(/>/g, ">");
    if (sender === 'ai') {
        // 讓 formatContentForDisplay 處理段落等
        // 注意：formatContentForDisplay 內部應已處理轉義，這裡的 safeMessage 主要是兜底
        // 但 formatContentForDisplay 輸出的是帶 <p> 的 HTML，所以直接用 innerHTML
        messageElement.innerHTML = formatContentForDisplay(message);
    } else {
        // 用戶消息簡單處理換行（如果需要）或直接顯示
        // messageElement.textContent = message; // 更安全，但不支持換行顯示
        messageElement.innerHTML = `<p>${safeMessage.replace(/\n/g, '<br>')}</p>`; // 支持換行
    }

    messagesContainer.appendChild(messageElement);
    // 滾動到底部
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 更新: 顯示加載指示器 (只負責顯示)
function showLoadingIndicator(text) {
    // 移除可能存在的舊指示器，確保只有一個
    removeLoadingIndicator();

    const indicator = document.createElement('div');
    indicator.id = 'loading-indicator'; // 給定 ID 以便之後移除
    indicator.classList.add('loading-indicator'); // 應用 CSS 樣式

    const randomEmoji = animalEmojis[Math.floor(Math.random() * animalEmojis.length)];
    indicator.innerHTML = `<strong>${text}</strong><span>${randomEmoji}</span>`;

    messagesContainer.appendChild(indicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight; // 滾動到底部
}

// 更新: 新增移除加載指示器的函數
function removeLoadingIndicator() {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) {
        indicator.remove();
    }
}


// 構造包含對話歷史的 Prompt (保持不變)
function buildPromptWithHistory(newMessage, chapterContext = null) {
    let prompt = `你是曹雪芹，沉浸在《紅樓夢》的世界中。請始終以曹雪芹的口吻、風格和學識與用戶對話。保持文雅、時而感嘆、時而點評，如同在與知己談論書中人與事。\n\n`;

    if (chapterContext) {
        prompt += `【當前談論章回：第 ${chapterContext.chapter} 回 ${chapterContext.title}】\n（不必重複提及全文，只需知曉背景即可）\n\n`;
    }

    const recentHistory = conversationHistory.slice(-10); // 取最近 10 條
    const filteredHistory = recentHistory.filter(msg => msg.role === 'user' || msg.role === 'model');

    if (filteredHistory.length > 1) { // 至少有一輪對話
        prompt += "【往來筆談】:\n";
        // 確保不包含當前正在發送的 user message (它在 filteredHistory 的末尾)
        filteredHistory.slice(0, -1).forEach(msg => {
            const rolePrefix = msg.role === 'user' ? '客官 (用戶)' : '老夫 (曹雪芹)';
            // 清理並截斷內容，避免 prompt 過長
            const cleanedContent = msg.content.replace(/\(系統展示了.*\)/g, '(先前內容)') // 替換系統提示
                                             .replace(/<[^>]*>/g, "") // 移除 HTML 標籤
                                             .replace(/\s+/g, ' ') // 壓縮空白
                                             .substring(0, 200); // 截斷
            prompt += `${rolePrefix}: ${cleanedContent}${msg.content.length > 200 ? '...' : ''}\n`;
        });
        prompt += "\n";
    }

    prompt += `【客官新言】:\n用戶: ${newMessage}\n`;
    prompt += "\n【老夫回應】:\n曹雪芹:";

    // console.log("Generated Prompt:", prompt); // Debugging
    return prompt;
}

// 限制對話歷史長度 (保持不變)
function trimConversationHistory(maxLength = 16) { // 稍微減少長度
    if (conversationHistory.length > maxLength) {
        // 保留最新的 maxLength 條記錄
        conversationHistory.splice(0, conversationHistory.length - maxLength);
    }
}


// 調用 Gemini API 的函數 (保持不變，回調處理移到調用處)
function callGeminiAPI(prompt, callback) {
  fetch('https://apis.bdfz.workers.dev', { // 確保 URL 正確
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt })
  })
  .then(res => {
    if (!res.ok) {
        // 嘗試解析 JSON 錯誤信息
        return res.json().then(errData => {
             // 拋出包含服務器錯誤信息的 Error
             throw new Error(`API請求失敗 (狀態 ${res.status}): ${errData.error || JSON.stringify(errData)}`);
        }).catch(() => {
            // 如果解析 JSON 失敗，拋出基本錯誤
            throw new Error(`API請求失敗 (狀態 ${res.status}): 無法解析錯誤響應體`);
        });
    }
    return res.json(); // 解析成功的 JSON 響應
  })
  .then(data => {
    if (data && data.answer) {
      callback(data.answer); // 將結果傳遞給回調
    } else {
      console.error('API 返回數據格式錯誤或無回答:', data);
      // 提供一個默認的錯誤回覆
      callback("唉，老夫搜索枯腸，竟一時語塞。許是方纔神遊太虛，待緩過神來再與客官細談。");
    }
  })
  .catch(err => {
    console.error('調用 API 或處理響應時出錯：', err);
    // 將錯誤信息傳遞給回調，以便在界面上顯示
     callback(`噫！與後端通路似乎阻滯不暢：<br><pre style="font-size: 0.8em; color: #888;">${err.message}</pre>還請客官稍待片刻，或尋網站主事之人問詢。`);
  });
}