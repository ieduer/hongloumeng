// --- 全局變量 ---
let conversationHistory = [];
let currentChapterData = null; // 用戶主動選擇的紅樓夢章節
// 更新: 重命名並修改用途，記錄初始隨機顯示的詩詞信息
let initialContentInfo = null;
let hongloumengData = null;
let gaokaoData = null;
let shiciData = null; // 新增: 存儲詩詞數據

const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const chatButton = document.getElementById('chat-button');
const chapterMenu = document.getElementById('chapter-menu');
// 更新: 獲取目錄標籤按鈕，但不再需要事件監聽 (保持不變)
const menuLabelBtn = document.getElementById('menu-label-btn');
const animalEmojis = ['😼', '🐶', '🦊', '🐻', '🐼', '🐰', '🐯', '🦉', '🍁', '🏮'];

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    Promise.all([
        fetch('data/hongloumeng.json').then(res => res.ok ? res.json() : Promise.reject(`紅樓夢數據加載失敗: ${res.status}`)),
        fetch('data/gaokao.json').then(res => res.ok ? res.json() : Promise.reject(`高考數據加載失敗: ${res.status}`)),
        // 新增: 加載 shici.json
        fetch('data/shici.json').then(res => res.ok ? res.json() : Promise.reject(`詩詞數據加載失敗: ${res.status}`))
    ])
    .then(([hlmData, gkData, scData]) => { // 更新: 接收 shici 數據
        hongloumengData = hlmData;
        gaokaoData = gkData;
        shiciData = scData; // 新增: 存儲詩詞數據
        loadInitialContent(); // 加載初始詩詞內容
        loadChapterMenu(); // 加載紅樓夢章節目錄
        // 目錄始終顯示，不需要額外操作
    })
    .catch(error => {
        console.error("初始化數據加載失敗:", error);
        messagesContainer.innerHTML = `<p style="color: red;">基礎數據加載失敗，部分功能可能無法使用。請刷新頁面或檢查網絡連接。</p>`;
        // 根據失敗的數據決定是否禁用按鈕等
        if (!hongloumengData || !shiciData) {
            if (chatButton) chatButton.disabled = true;
            appendMessageToChat('ai', '抱歉，核心數據加載失敗，無法正常使用。');
        } else {
            appendMessageToChat('ai', `部分數據加載失敗: ${error}. 可能影響部分功能。`);
        }
    });

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }
});


// 加載章節列表 (紅樓夢目錄，保持不變)
function loadChapterMenu() {
    if (!hongloumengData || !hongloumengData.chapters) {
        console.error('紅樓夢數據未加載或格式錯誤，無法生成目錄');
        chapterMenu.innerHTML = '<p style="color: red;">無法加載章節列表。</p>';
        return;
    }
    chapterMenu.innerHTML = ''; // 清空目錄內容
    hongloumengData.chapters.forEach(chapter => {
        const btn = document.createElement('button');
        btn.textContent = ` ${chapter.chapter}  ${chapter.title}`;
        btn.onclick = () => loadChapter(chapter);
        chapterMenu.appendChild(btn);
    });
}

// 更新: 加載初始內容 (從 shici.json 隨機選取)
function loadInitialContent() {
    // 檢查 shiciData 是否成功加載且包含數據
    if (!shiciData || !Array.isArray(shiciData) || shiciData.length === 0) {
         console.error('詩詞數據 (shici.json) 未加載或格式錯誤。');
         appendMessageToChat('ai', '歡迎。抱歉，詩詞數據似乎有些問題，暫無法為您展示隨機詩詞。您可以從右側目錄選擇《紅樓夢》章回閱讀。');
         return;
    }

    messagesContainer.innerHTML = ''; // 清空聊天區域
    conversationHistory = []; // 清空歷史記錄
    currentChapterData = null; // 清除選定的紅樓夢章節
    initialContentInfo = null; // 重置初始內容記錄

    try {
        // 隨機選取一個詩詞條目
        const randomIndex = Math.floor(Math.random() * shiciData.length);
        const randomEntry = shiciData[randomIndex];

        // 檢查選中條目的結構是否符合預期
        if (!randomEntry || !randomEntry.details || !randomEntry.details.title || !randomEntry.details.poem_text || typeof randomEntry.details.explanation === 'undefined') {
            console.error("選中的詩詞條目結構不完整:", randomEntry);
            appendMessageToChat('ai', '哎呀，取來的詩箋似乎有些殘缺，換一頁試試？（請刷新）');
            return;
        }

        const { title, poem_text, explanation } = randomEntry.details;
        const page_number = randomEntry.page_number;

        // 格式化詩詞正文 (數組轉為帶換行的字符串)
        // 使用 <br> 進行換行，並包裹在一個具有特定樣式類名的塊中
        const formattedPoem = poem_text.join('<br>');

        // 構建顯示內容的 HTML 字符串
        // 使用特定 class 'initial-shici-display' 以便應用 CSS 樣式
        let displayHtml = `<h3>${title}</h3>`; // 標題
        displayHtml += `<div class="poem-like-block">${formattedPoem}</div>`; // 詩詞正文，使用 div 包裹以便應用 pre-line 或其他樣式
        if (explanation && explanation.trim().length > 0) {
            // 使用 formatContentForDisplay 處理註解，使其支持分段等
            displayHtml += `<strong>【註解】</strong>${formatContentForDisplay(explanation)}`; // 註解
        }

        const introMessage = `偶隨書頁翻，拾得片語詩箋，錄之以饗客官：\n\n`; // 引導語保留換行符
        // 使用 appendMessageToChat，將引導語和 HTML 內容分開處理
        // 引導語作為普通文本，HTML 內容直接插入
        const fullMessageContent = introMessage + displayHtml;

        // 將格式化後的內容顯示在聊天框中，並添加 CSS class
        // 注意：這裡我們直接將 HTML 字符串傳給 appendMessageToChat，由它內部處理
        appendMessageToChat('ai', fullMessageContent, ['initial-shici-display']);

        // 記錄初始內容信息，用於後續對話上下文
        initialContentInfo = {
            type: 'shici',
            page_number: page_number,
            title: title,
            // 存儲原始 poem_text 數組或 join 後的文本，以便 AI 理解展示了什麼
            displayed_poem: poem_text.join('\n'),
            displayed_explanation: explanation // 存儲註解
        };

        // 加入對話歷史，標記這是系統展示的初始詩詞內容
        conversationHistory.push({
            role: 'ai', // 用 AI role 標記，但內容指明是系統行為
            // 記錄更詳細的信息，便於追溯
            content: `(系統隨機展示了《${title}》(源自 shici.json 頁 ${page_number}) 的詩文與註解)`
        });

    } catch (error) {
        console.error("處理初始詩詞內容時出錯:", error);
        appendMessageToChat('ai', '歡迎。抱歉，準備隨機詩詞時遇到了些麻煩。');
    }
}


// 加載選定章節內容到對話框 (紅樓夢章節，保持不變)
function loadChapter(chapter) {
    console.log(`加載章節:  ${chapter.chapter} `);
    currentChapterData = chapter; // 設置當前紅樓夢章節
    initialContentInfo = null; // 清除初始詩詞記錄，因為現在有明確章節了
    conversationHistory = []; // 清空對話歷史，開始新的章節對話流

    const formattedContent = formatContentForDisplay(chapter.content);
    messagesContainer.innerHTML = '';

    appendMessageToChat('ai', `<h3> ${chapter.chapter}  ${chapter.title}</h3>\n${formattedContent}`, ['chapter-content-display']);

    conversationHistory.push({
         role: 'ai',
         content: `(系統展示了《紅樓夢》 ${chapter.chapter}  ${chapter.title} 全文)`
     });

    requestInitialAnalysis(chapter); // 為紅樓夢章節請求 AI 分析/出題 (保持不變)
}

// 更新：格式化文本內容（分段、基礎Markdown轉HTML）(保持不變，因其通用性)
function formatContentForDisplay(text) {
    if (!text) return "";

    // 1. Basic cleanup
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    text = text.replace(/\(本[章回]完\)$/gm, '').trim();

    // 2. Escape HTML tags
    let escapedText = text.replace(/</g, "<").replace(/>/g, ">");

    // 3. Apply basic Markdown conversions
    escapedText = escapedText.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    escapedText = escapedText.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    escapedText = escapedText.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    escapedText = escapedText.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    escapedText = escapedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    escapedText = escapedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    escapedText = escapedText.replace(/^(?:[\*\-]\s+.*(?:\n|$))+/gm, (match) => {
        const items = match.trim().split('\n').map(line => `<li>${line.replace(/^[\*\-]\s+/, '').trim()}</li>`).join('');
        return `<ul>${items}</ul>`;
    });
     escapedText = escapedText.replace(/^(?:\d+\.\s+.*(?:\n|$))+/gm, (match) => {
        const items = match.trim().split('\n').map(line => `<li>${line.replace(/^\d+\.\s+/, '').trim()}</li>`).join('');
        return `<ol>${items}</ol>`;
    });

    // 4. Split into logical blocks and wrap in <p> or keep existing block tags
    const blocks = escapedText.split(/\n\s*\n+/g)
                             .map(block => block.trim())
                             .filter(block => block.length > 0);

    let resultHtml = "";
    if (blocks.length > 0) {
        resultHtml = blocks.map(block => {
            if (/^<(?:h[1-6]|ul|ol|p|blockquote|pre)/i.test(block)) { // Added <pre> just in case
                 return block.replace(/\n/g, '<br>'); // Convert internal newlines inside existing blocks
            } else {
                // Wrap non-block text in <p> and convert internal newlines
                return `<p>${block.replace(/\n/g, '<br>')}</p>`;
            }
        }).join('');
    } else {
         // Fallback for single block of text or empty text
         resultHtml = `<p>${escapedText.replace(/\n/g, '<br>')}</p>`;
    }

    // 5. Final cleanup
    resultHtml = resultHtml.replace(/<p>\s*<\/p>/gi, '');
    // Special case: if the result is just <p><br></p> or similar, return empty
    if (resultHtml.replace(/<p>|<br>|<\/p>|\s/g, '') === '') {
        return "";
    }


    return resultHtml;
}


// 請求 AI 對新加載的章節進行初始分析/出題 (紅樓夢章節，保持不變)
function requestInitialAnalysis(chapter) {
    if (!gaokaoData || !gaokaoData.data || !gaokaoData.instructions) {
        console.error("高考數據未加載或格式錯誤，無法生成模擬題。");
        appendMessageToChat('ai', "（抱歉，參考資料不足，暫無法為此章回出題。）");
        return;
    }

    showLoadingIndicator('Gemini 正為您命題...');

    try {
        const chapterContentExcerpt = chapter.content.substring(0, 500).replace(/\s+/g, ' ').trim() + "...";
        let relevantQuestions = gaokaoData.data.filter(q => {
             const chapterNumMatch = chapter.title.match(/(\s*[一二三四五六七八九十百]+)\s*/);
             const chapterNum = chapterNumMatch ? chapterNumMatch[1].replace(/\s/g,'') : null;
             return (chapterNum && q.chapter && q.chapter.includes(chapterNum)) ||
                    (q.originalQuestion && chapter.title.split('').some(char => q.originalQuestion.includes(char))) ||
                    (q.originalQuestion && chapterContentExcerpt.substring(0,100).split('').some(char => q.originalQuestion.includes(char)));
        });
        if (relevantQuestions.length === 0) relevantQuestions = gaokaoData.data;
        const chosenQuestion = relevantQuestions[Math.floor(Math.random() * relevantQuestions.length)];

        const prompt = `吾乃曹雪芹。方纔與客官一同閱覽《紅樓夢》 ${chapter.chapter} ：${chapter.title}。\n\n` +
                       `此回情節撮要（供汝參考，無需複述）：\n“${chapterContentExcerpt}”\n\n` +
                       `老夫聽聞當今有「高考」，常以拙作設題考較學子。老夫亦查閱了相關資料（${gaokaoData.instructions}），見有此類試題與本章或相關，例如：“${chosenQuestion.originalQuestion}”\n\n` +
                       `現請汝：\n` +
                       `1. 先在心中回顧本章「${chapter.title}」之主要情節、人物互動與關鍵細節。\n` +
                       `2. 參照上述「高考」題型風格（例如設問方式、考查點：可能是情節理解、人物分析、藝術手法、文化內涵等）。\n` +
                       `3. 為客官擬定一【新】模擬試題，務必緊密結合【本章具體內容】。\n` +
                       `4. 【切記】：只需生成【試題本身】，萬勿提供答案、解析或任何多餘文字！\n\n` +
                       `模擬試題：\n\n`;

        callGeminiAPI(prompt, (result) => {
            removeLoadingIndicator();
            appendMessageToChat('ai', result); // AI 的回復即為題目
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

    // 1. 添加用戶消息到聊天框
    appendMessageToChat('user', messageText);
    userInput.value = '';

    // 2. 添加用戶消息到歷史記錄
    conversationHistory.push({ role: 'user', content: messageText });
    trimConversationHistory();

    // 3. 確定上下文
    let activeChapterContext = currentChapterData; // 紅樓夢章節上下文
    let isRespondingToInitialShici = false; // 新增標記

    // 更新: 檢查是否正在回應初始詩詞內容
    if (!activeChapterContext && initialContentInfo && initialContentInfo.type === 'shici') {
        console.log("用戶正在回應初始詩詞內容，使用 initialContentInfo 作為參考上下文");
        isRespondingToInitialShici = true;
        // 不需要將 initialContentInfo 傳遞給 buildPromptWithHistory 的 chapterContext 參數
        // buildPromptWithHistory 會自行檢查 initialContentInfo
        // **重要**: 響應一次後清除初始內容上下文引用，避免後續無關問題也關聯
        // 但保留 conversationHistory 中的記錄
        // 注意：這裡立即清除，確保 buildPromptWithHistory 能讀到最後一次的 initialContentInfo
        // 如果 prompt 構造失敗或 API 調用失敗，這個狀態會丟失，但這是小概率事件
    }

    // 4. 顯示加載提示
    showLoadingIndicator('Gemini 回覆中...');

    // 5. 構造 Prompt (包含歷史記錄和上下文)
    // 更新: buildPromptWithHistory 現在會處理 isRespondingToInitialShici 的情況 (通過檢查 initialContentInfo)
    const prompt = buildPromptWithHistory(messageText, activeChapterContext);

    // 如果是回應初始詩詞，發送請求後清除標記
    if (isRespondingToInitialShici) {
         initialContentInfo = null;
         console.log("Initial shici context cleared after sending message.");
    }


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

// 監聽聊天按鈕點擊 (保持不變)
chatButton.addEventListener('click', sendChatMessage);

// 監聽輸入框 Enter 鍵 (保持不變)
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

    // 對於 AI 消息
    if (sender === 'ai') {
        // 如果消息內容看起來像 HTML (包含 <tag>), 假定它是預格式化的 (例如來自 loadInitialContent)
        // 否則，使用 formatContentForDisplay 進行處理
        if (/<[a-z][\s\S]*>/i.test(message)) {
             // 特別處理引導語和 HTML 內容的組合
             const introMatch = message.match(/^([\s\S]*?\n\n)(<[\s\S]+)/);
             if (introMatch && classes.includes('initial-shici-display')) {
                 // 分開處理引導語和 HTML
                 const introText = introMatch[1];
                 const htmlContent = introMatch[2];
                 // 引導語用 <p> 包裹並處理換行
                 const introPara = document.createElement('p');
                 introPara.innerHTML = introText.replace(/\n/g, '<br>');
                 messageElement.appendChild(introPara);
                 // 直接插入後續的 HTML
                 const contentDiv = document.createElement('div');
                 contentDiv.innerHTML = htmlContent;
                 // 將 contentDiv 的子節點附加到 messageElement
                 while (contentDiv.firstChild) {
                    messageElement.appendChild(contentDiv.firstChild);
                 }

             } else {
                 // 否則，直接設置 innerHTML (假設是安全的，因為源頭可控)
                 messageElement.innerHTML = message;
             }
        } else {
            // 普通 AI 消息，使用格式化函數
            messageElement.innerHTML = formatContentForDisplay(message);
        }
    } else {
        // User message: escape HTML and convert newlines to <br>
        const safeMessage = message.replace(/</g, "<").replace(/>/g, ">");
        messageElement.innerHTML = `<p>${safeMessage.replace(/\n/g, '<br>')}</p>`; // Simple paragraph wrap
    }

    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight; // 滾動到底部
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
// chapterContext 現在只接收紅樓夢章節數據，初始詩詞通過檢查全局 initialContentInfo 來處理
function buildPromptWithHistory(newMessage, chapterContext = null) {
    let prompt = `你是曹雪芹，沉浸在《紅樓夢》的世界中。請始終以曹雪芹的口吻（文雅、古典、帶有書卷氣）、風格和學識與用戶對話。保持文雅，時而感嘆、時而點評，如同在與知己談論書中人與事。避免使用現代網絡用語或表情符號。\n\n`;

    // 判斷上下文
    if (chapterContext) {
        // --- 紅樓夢章節上下文 ---
        prompt += `【當前談論焦點：《紅樓夢》 ${chapterContext.chapter}  ${chapterContext.title}】\n`;
        const lastHistoryEntry = conversationHistory[conversationHistory.length - 2];
        if (lastHistoryEntry && lastHistoryEntry.role === 'ai' && lastHistoryEntry.content.includes(`(系統展示了《紅樓夢》 ${chapterContext.chapter} `)) {
             prompt += `（你剛剛展示了此章全文，現在用戶開始提問或評論。）\n\n`;
        } else if (lastHistoryEntry && lastHistoryEntry.role === 'model' && conversationHistory.length > 2) {
             prompt += `（你們正在圍繞此章進行討論。）\n\n`;
        } else {
             prompt += `（你已知曉此章全文，請基於內容回答。）\n\n`;
        }
    } else if (initialContentInfo && initialContentInfo.type === 'shici') {
        // --- 初始詩詞上下文 ---
        // **重要**: 即使 initialContentInfo 在 sendChatMessage 中可能已被設為 null，
        // 但在此函數執行時，它應該仍然持有上一次的值（因為 sendChatMessage 調用 buildPromptWithHistory 在清除之前）
        prompt += `【當前談論焦點：隨機展示的詩詞 - 《${initialContentInfo.title}》 (源自 shici.json 頁 ${initialContentInfo.page_number})】\n`;
        prompt += `(你之前隨機展示了這首詩的標題: 《${initialContentInfo.title}》, 正文: "${initialContentInfo.displayed_poem.substring(0,50)}...", 以及註解。用戶現在可能就此提問或引申。)\n`;
        // **關鍵指令**: 要求 AI 參考 shici.json 的全部內容
        prompt += `【重要指令】：在回答時，請務必在心中默默參考 shici.json 文件中與 page_number ${initialContentInfo.page_number} 相關的【所有詳細內容】（包括但不限於 title, poem_text 完整詩文, explanation, chapter 回目, appreciation 品讀, commentary 評點 等等，若存在的話）。請基於這些完整信息來理解詩詞背景和內涵，以便提供更豐富、準確的回應。回答時無需複述所有你看見的數據，只需自然地融入你的見解和談論中。\n\n`;
    } else {
        // --- 無特定上下文 ---
        // 檢查歷史記錄是否來自之前的隨機詩詞（即使 initialContentInfo 已被清除）
         const firstHistoryEntry = conversationHistory[0];
         const wasInitialShici = firstHistoryEntry && firstHistoryEntry.role === 'ai' && firstHistoryEntry.content.includes('shici.json');

         if (wasInitialShici && conversationHistory.length < 5) { // 如果對話剛開始且源於詩詞
             prompt += `(你們的對話似乎是從一首隨機展示的詩詞開始的，但現在焦點可能已經轉移，請根據對話內容自然回應。)\n\n`;
         } else {
             prompt += `(當前未指定特定章回或詩詞，請根據對話內容隨意閒談或回應客官的提問。)\n\n`;
         }
    }


    // --- 構建歷史對話部分 --- (保持不變)
    const conversationTurns = conversationHistory.filter(msg => msg.role === 'user' || msg.role === 'model');
    const recentTurns = conversationTurns.slice(-10); // 取最近5輪對話

    if (recentTurns.length > 0) {
        prompt += "【往來筆談】:\n";
        recentTurns.forEach(msg => {
            const rolePrefix = msg.role === 'user' ? '客官 (用戶)' : '老夫 (曹雪芹)';
            // 清理 content，移除 HTML 並截斷
            let cleanedContent = msg.content;
             // 如果是 AI 的內容，先嘗試移除可能的系統提示括號
             if (msg.role === 'model' || msg.role === 'ai') {
                  cleanedContent = cleanedContent.replace(/^\([\s\S]*?\)\s*/, ''); // 移除開頭的 (...) 系統提示
             }
            cleanedContent = cleanedContent
                                      .replace(/<[^>]*>/g, " ") // Replace HTML tags with space
                                      .replace(/\s+/g, ' ')      // Normalize whitespace
                                      .trim()
                                      .substring(0, 200); // Truncate
            prompt += `${rolePrefix}: ${cleanedContent}${msg.content.length > 200 ? '...' : ''}\n`;
        });
        prompt += "\n";
    }

    // --- 添加用戶的最新消息 --- (保持不變)
    prompt += `【客官新言】:\n用戶: ${newMessage}\n\n`;
    prompt += `【老夫回應】:\n曹雪芹:`;

    // console.log("Generated Prompt:", prompt); // 用於調試
    return prompt;
}


// 限制對話歷史長度 (保持不變)
function trimConversationHistory(maxLength = 20) {
    if (conversationHistory.length > maxLength) {
        conversationHistory.splice(0, conversationHistory.length - maxLength);
    }
}


// 調用 Gemini API 的函數 (保持不變)
function callGeminiAPI(prompt, callback) {
  fetch('https://ai.bdfz.net/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt })
  })
  .then(res => {
    if (!res.ok) {
        // 嘗試解析 JSON 錯誤信息，如果失敗則返回文本錯誤
        return res.json().then(errData => {
             throw new Error(`API請求失敗 (狀態 ${res.status}): ${errData.error || JSON.stringify(errData)}`);
        }).catch(() => {
            return res.text().then(textData => {
                 throw new Error(`API請求失敗 (狀態 ${res.status}): ${textData}`);
            });
        });
    }
    return res.json();
  })
  .then(data => {
    if (data && data.answer) {
      callback(data.answer);
    } else {
      console.error('API 返回數據格式錯誤或無回答:', data);
      // 提供更符合角色的錯誤回覆
      callback("唉，老夫搜索枯腸，竟一時語塞。許是方纔神遊太虛境，未知客官所云何事。不如稍候再談？");
    }
  })
  .catch(err => {
    console.error('調用 API 或處理響應時出錯：', err);
    // 提供更符合角色的錯誤回覆，並顯示錯誤信息
    callback(`噫！與後端通路似乎阻滯不暢，或是那警幻仙姑設了迷陣？<br><pre style="font-size: 0.8em; color: #888;">${err.message}</pre>還請客官稍待片刻，容老夫探查一番。`);
  });
}