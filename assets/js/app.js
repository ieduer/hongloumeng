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
    conversationHistory = []; // 清空歷史記錄
    currentChapterData = null;
    initialContentChapter = null; // 重置初始內容記錄

    try {
        const randomIndex = Math.floor(Math.random() * hongloumengData.chapters.length);
        const randomChapter = hongloumengData.chapters[randomIndex];
        initialContentChapter = randomChapter; // 記錄下來，用於後續對話上下文
        const chapterContent = randomChapter.content || "";
        const chapterInfo = `（隨機摘自 第 ${randomChapter.chapter} 回 ${randomChapter.title}）`;

        // 提取詩詞或摘要的邏輯 (保持不變)
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
        // 初始消息也用 formatContentForDisplay 處理，確保格式一致
        appendMessageToChat('ai', displayMessage);

        // 加入對話歷史，標記這是系統展示的初始內容
        conversationHistory.push({
            role: 'ai', // 用 AI role 標記，但內容指明是系統行為
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
    initialContentChapter = null; // 清除初始隨機章節記錄，因為現在有明確章節了
    conversationHistory = []; // 清空對話歷史，開始新的章節對話流

    // 使用更新後的 formatContentForDisplay 處理全文，進行分段和基礎 Markdown
    const formattedContent = formatContentForDisplay(chapter.content);
    messagesContainer.innerHTML = ''; // 清空現有消息

    // 顯示章節標題和分段後的全文
    // 添加特殊 class 以便應用特定樣式 (如背景色)
    appendMessageToChat('ai', `<h3>第 ${chapter.chapter} 回 ${chapter.title}</h3>\n${formattedContent}`, ['chapter-content-display']);

    // 加入對話歷史，標記展示了全文
    conversationHistory.push({
         role: 'ai', // 用 AI role 標記，內容指明系統行為
         content: `(系統展示了 第 ${chapter.chapter} 回 ${chapter.title} 全文)`
     });

    // 為新章節請求 AI 分析/出題
    requestInitialAnalysis(chapter);
}

// 更新：格式化文本內容（分段、基礎Markdown轉HTML）
function formatContentForDisplay(text) {
    if (!text) return "";

    // 1. Basic cleanup (統一換行，移除文末標記)
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    text = text.replace(/\(本[章回]完\)$/gm, '').trim();

    // 2. IMPORTANT: Escape HTML tags in the original text FIRST to prevent XSS.
    let escapedText = text.replace(/</g, "<").replace(/>/g, ">");

    // 3. Apply basic Markdown conversions (on the escaped text)
    // Headers (must be at the start of a line)
    escapedText = escapedText.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    escapedText = escapedText.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    escapedText = escapedText.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    // Bold and Italic (handle ***, **, *) - Order matters!
    escapedText = escapedText.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    escapedText = escapedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    escapedText = escapedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Basic Unordered Lists (simple conversion, doesn't handle nesting well)
    escapedText = escapedText.replace(/^(?:[\*\-]\s+.*(?:\n|$))+/gm, (match) => {
        const items = match.trim().split('\n').map(line => `<li>${line.replace(/^[\*\-]\s+/, '').trim()}</li>`).join('');
        return `<ul>${items}</ul>`; // Removed extra newlines for cleaner HTML
    });
    // Basic Ordered Lists (simple conversion)
     escapedText = escapedText.replace(/^(?:\d+\.\s+.*(?:\n|$))+/gm, (match) => {
        const items = match.trim().split('\n').map(line => `<li>${line.replace(/^\d+\.\s+/, '').trim()}</li>`).join('');
        return `<ol>${items}</ol>`; // Removed extra newlines
    });
    // Convert explicit newlines (that weren't paragraph breaks) to <br> AFTER list conversion
    // but BEFORE paragraph splitting based on double newlines. This helps preserve line breaks within list items or code blocks if any.
    // Let's refine this: only convert \n to <br> INSIDE the final blocks/paragraphs.


    // 4. Split into logical blocks based on double newlines.
    // Treats Markdown blocks (like <ul>, <ol>, <h1>) or regular text blocks separated by blank lines.
    const blocks = escapedText.split(/\n\s*\n+/g)
                             .map(block => block.trim()) // Trim whitespace around each block
                             .filter(block => block.length > 0); // Remove empty blocks

    let resultHtml = "";
    if (blocks.length > 0) {
        resultHtml = blocks.map(block => {
            // Check if the block is already a recognized HTML block element from our Markdown conversion
            if (/^<(?:h[1-6]|ul|ol|p|blockquote)/i.test(block)) {
                 // If it is, keep it as is, but convert internal newlines to <br>
                 // This handles multi-line list items correctly if the regex was simple.
                 return block.replace(/\n/g, '<br>');
            } else {
                // Otherwise, wrap the block in a <p> tag
                // And convert internal newlines to <br>
                return `<p>${block.replace(/\n/g, '<br>')}</p>`;
            }
        }).join(''); // Join the blocks together
    } else {
         // Fallback: If splitting yields nothing, treat the whole (processed) text as one paragraph
         // Convert all remaining newlines to <br>
         resultHtml = `<p>${escapedText.replace(/\n/g, '<br>')}</p>`;
    }

    // 5. Final cleanup: Remove potentially empty paragraphs created during processing
    resultHtml = resultHtml.replace(/<p>\s*<\/p>/gi, '');

    return resultHtml;
}


// 請求 AI 對新加載的章節進行初始分析/出題
function requestInitialAnalysis(chapter) {
    if (!gaokaoData || !gaokaoData.data || !gaokaoData.instructions) {
        console.error("高考數據未加載或格式錯誤，無法生成模擬題。");
        appendMessageToChat('ai', "（抱歉，參考資料不足，暫無法為此章回出題。）");
        return;
    }

    showLoadingIndicator('Gemini 正為您命題...');

    try {
        const chapterContentExcerpt = chapter.content.substring(0, 500).replace(/\s+/g, ' ').trim() + "..."; // Trimmed excerpt
        // Find relevant Gaokao question (logic remains the same)
        let relevantQuestions = gaokaoData.data.filter(q => {
             const chapterNumMatch = chapter.title.match(/第(\s*[一二三四五六七八九十百]+)\s*回/);
             const chapterNum = chapterNumMatch ? chapterNumMatch[1].replace(/\s/g,'') : null;
             return (chapterNum && q.chapter && q.chapter.includes(chapterNum)) ||
                    (q.originalQuestion && chapter.title.split('').some(char => q.originalQuestion.includes(char))) ||
                    (q.originalQuestion && chapterContentExcerpt.substring(0,100).split('').some(char => q.originalQuestion.includes(char)));
        });
        if (relevantQuestions.length === 0) relevantQuestions = gaokaoData.data; // Fallback
        const chosenQuestion = relevantQuestions[Math.floor(Math.random() * relevantQuestions.length)];

        // 更新後的 Prompt，指導 AI 先分析再命題
        const prompt = `吾乃曹雪芹。方纔與客官一同閱覽《紅樓夢》第 ${chapter.chapter} 回：${chapter.title}。\n\n` +
                       `此回情節撮要（供汝參考，無需複述）：\n“${chapterContentExcerpt}”\n\n` +
                       `老夫聽聞當今有「高考」，常以拙作設題考較學子。老夫亦查閱了相關資料（${gaokaoData.instructions}），見有此類試題與本章或相關，例如：“${chosenQuestion.originalQuestion}”\n\n` +
                       `現請汝：\n` +
                       `1. 先在心中回顧本章「${chapter.title}」之主要情節、人物互動與關鍵細節。\n` + // 強調內部分析
                       `2. 參照上述「高考」題型風格（例如設問方式、考查點：可能是情節理解、人物分析、藝術手法、文化內涵等）。\n` +
                       `3. 為客官擬定一【新】模擬試題，務必緊密結合【本章具體內容】。\n` +
                       `4. 【切記】：只需生成【試題本身】，萬勿提供答案、解析或任何多餘文字！\n\n` +
                       `模擬試題：\n\n`; // AI 在此處接續生成題目

        // 注意：此處不向 conversationHistory 添加用戶消息，因為這是系統觸發的分析請求
        callGeminiAPI(prompt, (result) => {
            removeLoadingIndicator();
            // AI 回覆（即生成的題目）添加到聊天框，並進行格式化（包括 MD 轉 HTML）
            appendMessageToChat('ai', result);
            // 將 AI 生成的題目加入對話歷史
            conversationHistory.push({ role: 'model', content: result });
            trimConversationHistory();
        });

    } catch (error) {
        console.error("生成初始分析 Prompt 時出錯:", error);
        removeLoadingIndicator();
        appendMessageToChat('ai', `（哎呀，構思題目時出了些岔子：${error.message}）`);
    }
}

// --- 用戶交互 ---

// 切換黑暗模式 (保持不變)
document.getElementById('toggle-dark-btn').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
});

// 發送聊天消息
function sendChatMessage() {
    const messageText = userInput.value.trim();
    if (!messageText) return;

    // 1. 添加用戶消息到聊天框 (簡單處理換行)
    appendMessageToChat('user', messageText);
    userInput.value = ''; // 清空輸入框

    // 2. 添加用戶消息到歷史記錄
    conversationHistory.push({ role: 'user', content: messageText });
    trimConversationHistory(); // 修剪歷史記錄，防止過長

    // 3. 確定上下文 (當前章節或初始內容)
    // currentChapterData 由 loadChapter 設置
    // initialContentChapter 由 loadInitialContent 設置，並在 loadChapter 時清除
    // buildPromptWithHistory 會根據 currentChapterData 或 (如果 currentChapterData 為 null) 來判斷上下文
    let activeChapterContext = currentChapterData;
    // 如果沒有選擇章節，但之前有初始內容，用初始內容的章節信息作為參考上下文
    // 但注意：初始內容只是摘錄，AI 不知道全文
    if (!activeChapterContext && initialContentChapter) {
        console.log("用戶正在回應初始內容，使用 initialContentChapter 作為參考上下文");
        activeChapterContext = initialContentChapter;
        // 響應一次後清除初始內容上下文引用，避免後續無關問題也關聯到初始章節
        // 但保留 conversationHistory 中的記錄
         initialContentChapter = null;
    }


    // 4. 顯示加載提示
    showLoadingIndicator('Gemini 回覆中...');

    // 5. 構造 Prompt (包含歷史記錄和上下文)
    const prompt = buildPromptWithHistory(messageText, activeChapterContext);

    // 6. 調用 API
    callGeminiAPI(prompt, (result) => {
        // 7. 移除加載提示
        removeLoadingIndicator();
        // 8. 添加 AI 回覆到聊天框 (會進行格式化)
        appendMessageToChat('ai', result);
        // 9. 添加 AI 回覆到歷史記錄
        conversationHistory.push({ role: 'model', content: result });
        // 10. 再次修剪歷史記錄
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

// 將消息添加到聊天窗口
function appendMessageToChat(sender, message, classes = []) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message-bubble', sender === 'user' ? 'user-message' : 'ai-message');
    if (classes && classes.length > 0) {
        messageElement.classList.add(...classes);
    }

    // 對於 AI 消息，使用 formatContentForDisplay 進行分段和 Markdown 處理
    // 對於用戶消息，進行基本的 HTML 轉義並處理換行
    if (sender === 'ai') {
        messageElement.innerHTML = formatContentForDisplay(message);
    } else {
        // User message: escape HTML and convert newlines to <br>
        const safeMessage = message.replace(/</g, "<").replace(/>/g, ">");
        messageElement.innerHTML = `<p>${safeMessage.replace(/\n/g, '<br>')}</p>`; // Simple paragraph wrap
    }

    messagesContainer.appendChild(messageElement);
    // 滾動到底部
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 顯示加載指示器 (保持不變)
function showLoadingIndicator(text) {
    removeLoadingIndicator();
    const indicator = document.createElement('div');
    indicator.id = 'loading-indicator';
    indicator.classList.add('loading-indicator');
    const randomEmoji = animalEmojis[Math.floor(Math.random() * animalEmojis.length)];
    indicator.innerHTML = `<strong>${text}</strong><span>${randomEmoji}</span>`;
    messagesContainer.appendChild(indicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 移除加載指示器的函數 (保持不變)
function removeLoadingIndicator() {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) {
        indicator.remove();
    }
}


// 更新：構造包含對話歷史的 Prompt
function buildPromptWithHistory(newMessage, chapterContext = null) {
    // 基礎設定，要求 AI 扮演曹雪芹
    let prompt = `你是曹雪芹，沉浸在《紅樓夢》的世界中。請始終以曹雪芹的口吻（文雅、古典、帶有書卷氣）、風格和學識與用戶對話。保持文雅，時而感嘆、時而點評，如同在與知己談論書中人與事。避免使用現代網絡用語或表情符號。\n\n`;

    // 添加章節上下文提示（如果有的話）
    if (chapterContext) {
        prompt += `【當前談論焦點：第 ${chapterContext.chapter} 回 ${chapterContext.title}】\n`;
        // 檢查歷史記錄，看是否是剛加載完章節
        const lastHistoryEntry = conversationHistory[conversationHistory.length - 2]; // 檢查倒數第二條（用戶消息是最後一條）
        if (lastHistoryEntry && lastHistoryEntry.role === 'ai' && lastHistoryEntry.content.includes(`(系統展示了 第 ${chapterContext.chapter} 回`)) {
             prompt += `（你剛剛展示了此章全文，現在用戶開始提問或評論。）\n\n`;
        } else if (lastHistoryEntry && lastHistoryEntry.role === 'model' && conversationHistory.length > 2) {
             // 如果之前有模型的回覆（比如命題），說明對話已在進行中
             prompt += `（你們正在圍繞此章進行討論。）\n\n`;
        } else {
             prompt += `（你已知曉此章全文，請基於內容回答。）\n\n`;
        }
    } else {
        // 如果沒有特定章節上下文，檢查是否是初始隨機內容後的對話
        const firstHistoryEntry = conversationHistory[0];
         if (firstHistoryEntry && firstHistoryEntry.role === 'ai' && firstHistoryEntry.content.includes('(系統展示了隨機內容')) {
              prompt += `【當前談論焦點：隨機展示的書中片段】\n(你之前隨機展示了一段內容，用戶現在可能就此提問或引申。)\n\n`;
         } else {
              prompt += `(當前未指定特定章回，請根據對話內容回應。)\n\n`;
         }
    }

    // 過濾出實際的對話輪次（用戶提問和 AI 回答）
    // 排除系統提示信息，只保留 'user' 和 'model' 角色
    const conversationTurns = conversationHistory.filter(msg => msg.role === 'user' || msg.role === 'model');
    const recentTurns = conversationTurns.slice(-10); // 取最近的對話（最多5輪）

    // 構建歷史對話部分
    if (recentTurns.length > 0) {
        prompt += "【往來筆談】:\n";
        recentTurns.forEach(msg => {
            // 確定角色標識
            const rolePrefix = msg.role === 'user' ? '客官 (用戶)' : '老夫 (曹雪芹)';
            // 清理內容：移除HTML標籤，壓縮空白，截斷長度
            const cleanedContent = msg.content
                                      .replace(/<[^>]*>/g, "") // Strip HTML tags
                                      .replace(/\s+/g, ' ')      // Normalize whitespace
                                      .trim()
                                      .substring(0, 200); // Truncate to keep prompt concise
            prompt += `${rolePrefix}: ${cleanedContent}${msg.content.length > 200 ? '...' : ''}\n`;
        });
        prompt += "\n"; // 在歷史記錄和新消息間加空行
    }

    // 添加用戶的最新消息
    prompt += `【客官新言】:\n用戶: ${newMessage}\n\n`; // 用戶的新消息
    prompt += `【老夫回應】:\n曹雪芹:`; // 提示 AI 從這裡開始回答

    // console.log("Generated Prompt:", prompt); // 用於調試
    return prompt;
}


// 限制對話歷史長度 (稍微增加長度以保留更多上下文)
function trimConversationHistory(maxLength = 20) { // 保留最近 20 條記錄 (包括系統消息)
    if (conversationHistory.length > maxLength) {
        // 從數組開頭移除舊的記錄
        conversationHistory.splice(0, conversationHistory.length - maxLength);
        // console.log(`History trimmed to ${conversationHistory.length} items.`);
    }
}


// 調用 Gemini API 的函數
function callGeminiAPI(prompt, callback) {
  // 更新：顯示加載指示器移到調用此函數之前
  fetch('https://apis.bdfz.workers.dev', { // 確保 URL 正確
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt })
  })
  .then(res => {
    if (!res.ok) {
        return res.json().then(errData => {
             throw new Error(`API請求失敗 (狀態 ${res.status}): ${errData.error || JSON.stringify(errData)}`);
        }).catch(() => {
            throw new Error(`API請求失敗 (狀態 ${res.status}): 無法解析錯誤響應體`);
        });
    }
    return res.json();
  })
  .then(data => {
    // 更新：移除加載指示器移到回調函數內部處理之前
    if (data && data.answer) {
      callback(data.answer); // 將結果傳遞給回調
    } else {
      console.error('API 返回數據格式錯誤或無回答:', data);
      callback("唉，老夫搜索枯腸，竟一時語塞。許是方纔神遊太虛，待緩過神來再與客官細談。");
    }
  })
  .catch(err => {
    console.error('調用 API 或處理響應時出錯：', err);
    // 更新：移除加載指示器同樣移到回調之前
    // 將錯誤信息格式化後傳遞給回調，以便在界面上顯示
     callback(`噫！與後端通路似乎阻滯不暢：<br><pre style="font-size: 0.8em; color: #888;">${err.message}</pre>還請客官稍待片刻，或尋網站主事之人問詢。`);
  });
}