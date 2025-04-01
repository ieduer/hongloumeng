// --- 全局變量 ---
let conversationHistory = []; // 存儲對話歷史 { role: 'user'/'model', content: '...' }
let currentChapterData = null; // 存儲當前加載的章節數據
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const chatButton = document.getElementById('chat-button');
const chapterMenu = document.getElementById('chapter-menu');
const toggleMenuBtn = document.getElementById('toggle-menu-btn');
const animalEmojis = ['😼', '🐶', '🦊', '🐻', '🐼', '🐰', '🐯', '🦉']; // 隨機小動物

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    loadInitialContent(); // 加載初始詩詞或歡迎語
    loadChapterMenu();    // 加載章節列表
});

// 加載章節列表
function loadChapterMenu() {
    fetch('data/hongloumeng.json')
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            if (!data || !data.chapters) {
                console.error('章節數據格式錯誤:', data);
                chapterMenu.innerHTML = '<p style="color: red;">無法加載章節列表。</p>';
                return;
            }
            // 清空現有按鈕 (如果有的話)
            chapterMenu.innerHTML = '';
            // 添加章節按鈕
            data.chapters.forEach(chapter => {
                const btn = document.createElement('button');
                btn.className = 'ghibli-button'; // 使用 Ghibli 風格基類
                // 假設數據中章節號字段為 chapter，標題為 title
                btn.textContent = `第 ${chapter.chapter} 回 ${chapter.title}`;
                // 儲存完整章節數據到按鈕屬性，避免全局查找
                btn.dataset.chapterData = JSON.stringify(chapter);
                btn.onclick = () => loadChapter(chapter);
                chapterMenu.appendChild(btn);
            });
        })
        .catch(err => {
            console.error('加載章節數據錯誤：', err);
            chapterMenu.innerHTML = `<p style="color: red;">加載章節列表失敗: ${err.message}</p>`;
        });
}

// 加載初始內容 (詩詞或歡迎語)
function loadInitialContent() {
    fetch('data/hongloumeng.json')
        .then(res => res.json())
        .then(data => {
            // 嘗試從數據中獲取介紹性內容或第一首詩詞
            // 這裡假設 hongloumeng.json 有一個 'introduction' 字段或者第一章適合展示
            let initialText = "歡迎來到 AI 紅樓夢。請從左側選擇章回閱讀，或直接與我（曹雪芹）談天說地。"; // 默認歡迎語
            if (data && data.introduction) {
                initialText = data.introduction;
            } else if (data && data.chapters && data.chapters[0] && data.chapters[0].content) {
                // 嘗試提取第一章開頭部分作為引子
                const firstChapterContent = data.chapters[0].content;
                // 簡單提取前幾句詩詞或開篇語 (需要根據實際 JSON 內容調整)
                const potentialPoem = firstChapterContent.split('\n').filter(line => line.trim().length > 5 && line.trim().length < 50).slice(0, 4).join('\n');
                if (potentialPoem) {
                     initialText = `滿紙荒唐言，一把辛酸淚。\n都云作者痴，誰解其中味？\n\n${potentialPoem}\n\n（卷首詩）\n\n請從左側選擇章回開始閱讀。`;
                }
            }
            // 清空對話歷史和當前章節
            conversationHistory = [];
            currentChapterData = null;
            // 顯示初始內容
            appendMessageToChat('ai', initialText);
        })
        .catch(err => {
            console.error('加載初始內容錯誤：', err);
            appendMessageToChat('ai', '無法加載初始內容，請選擇章回開始。');
        });
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

    // 請求 AI 進行初始分析或出題
    requestInitialAnalysis(chapter);

    // 觸發後自動隱藏目錄 (在小螢幕上可能需要調整行為)
    if (window.innerWidth < 768) { // 只在小螢幕自動隱藏
         chapterMenu.style.display = 'none';
         toggleMenuBtn.textContent = '顯示目錄';
    }
}

// 格式化文本內容（分段，加分隔符）
function formatContentForDisplay(text) {
    if (!text) return "";
    // 1. 將多個換行符合併為一個標記，保留雙換行作為明確的段落分隔
    text = text.replace(/\n\s*\n/g, '<<PARAGRAPH_BREAK>>');
    // 2. 將單個換行符替換為空格或移除，除非它們跟在標點後
    text = text.replace(/([。！？；”’])\n/g, '$1<<SOFT_BREAK>>'); // 保留標點後的換行意圖
    text = text.replace(/\n/g, ' '); // 其他單換行變空格
    text = text.replace(/<<SOFT_BREAK>>/g, '\n'); // 恢復標點後的換行
    // 3. 按標記或常見標點分段
    const paragraphs = text.split(/<<PARAGRAPH_BREAK>>|[。！？]\s*/g)
                           .map(p => p.trim()) // 去除首尾空格
                           .filter(p => p.length > 0); // 過濾空段落

    // 4. 用 <p> 包裹，並在段落間插入分隔符
    let htmlContent = "";
    paragraphs.forEach((p, index) => {
        htmlContent += `<p>${p.replace(/^[。！？]/, '')}</p>`; // 添加段落，移除可能遺留的句首標點
        if (index < paragraphs.length - 1) {
            htmlContent += '<span class="paragraph-separator">🌿</span>'; // 段落間加分隔符
        }
    });
    return htmlContent;
}


// 請求 AI 對新加載的章節進行初始分析/出題
function requestInitialAnalysis(chapter) {
    // 顯示加載提示
    showLoadingIndicator(true, '命題'); // true 表示正在為初始加載出題

    const chapterContentExcerpt = chapter.content.substring(0, 1500); // 截取部分內容避免過長

    // 優化後的 Prompt
    const prompt = `吾乃曹雪芹。方纔讀至《紅樓夢》第 ${chapter.chapter} 回：${chapter.title}。\n此回主要情節片段大致如下：\n“${chapterContentExcerpt}...”\n\n依此章回內容，並參酌當今高考之風尚，老夫為你擬設一模擬題，以助你備考。請看題：\n\n[此處生成模擬題]\n\n閱畢此題，若有不明，或欲就此章與老夫閒敘，皆可暢所欲言。`;

    // 添加系統級指令到歷史記錄 (雖然前端發送時會合併，但內部記錄可能有益)
    // conversationHistory.push({ role: 'system', content: '你是曹雪芹，精通紅樓夢，以曹雪芹的口吻和風格與用戶交流。' });
    // 不加 system role，直接依賴 prompt 本身設定身份

    // 調用 API
    callGeminiAPI(prompt, (result) => {
        showLoadingIndicator(false); // 隱藏加載提示
        appendMessageToChat('ai', result); // 顯示 AI 的回覆（包含題目）

        // 將 AI 的首次回覆也加入歷史記錄
        conversationHistory.push({ role: 'user', content: `(關於第 ${chapter.chapter} 回的初次請求)` }); // 標記用戶的隱式請求
        conversationHistory.push({ role: 'model', content: result });
    });
}

// --- 用戶交互 ---

// 切換目錄顯示/隱藏
toggleMenuBtn.addEventListener('click', () => {
    if (chapterMenu.style.display === 'none' || chapterMenu.style.display === '') {
        chapterMenu.style.display = 'block'; // 或 'grid' 如果用回網格
        toggleMenuBtn.textContent = '隱藏目錄';
    } else {
        chapterMenu.style.display = 'none';
        toggleMenuBtn.textContent = '顯示目錄';
    }
});

// 切換黑暗模式
document.getElementById('toggle-dark-btn').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    // 可以考慮保存用戶偏好到 localStorage
    if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
    } else {
        localStorage.setItem('theme', 'light');
    }
});

// 檢查並應用保存的主題偏好
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
}

// 發送聊天消息
function sendChatMessage() {
    const messageText = userInput.value.trim();
    if (!messageText) return; // 不發送空消息

    // 顯示用戶消息
    appendMessageToChat('user', messageText);
    userInput.value = ''; // 清空輸入框

    // 將用戶消息添加到歷史
    conversationHistory.push({ role: 'user', content: messageText });

    // 顯示加載提示
    showLoadingIndicator(true, '思考'); // true 表示正在等待回復

    // 構造包含歷史的 Prompt
    const prompt = buildPromptWithHistory(messageText);

    // 調用 API
    callGeminiAPI(prompt, (result) => {
        showLoadingIndicator(false); // 隱藏加載提示
        appendMessageToChat('ai', result); // 顯示 AI 回覆

        // 將 AI 回覆添加到歷史
        conversationHistory.push({ role: 'model', content: result });

        // (可選) 限制歷史記錄長度，防止 Prompt 過長
        trimConversationHistory(20); // 保留最近 20 條消息 (10輪對話)
    });
}

// 監聽聊天按鈕點擊
chatButton.addEventListener('click', sendChatMessage);

// 監聽輸入框 Enter 鍵
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault(); // 防止默認換行行為
        sendChatMessage();
    }
});

// --- 輔助函數 ---

// 將消息添加到聊天窗口
function appendMessageToChat(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message-bubble', sender === 'user' ? 'user-message' : 'ai-message');

    // 對 AI 消息進行分段處理，用戶消息直接顯示
    if (sender === 'ai') {
        messageElement.innerHTML = formatContentForDisplay(message);
    } else {
        // 對用戶輸入進行基本的 HTML 轉義，防止 XSS
        const escapedMessage = message.replace(/</g, "<").replace(/>/g, ">");
        messageElement.innerHTML = `<p>${escapedMessage}</p>`;
    }

    messagesContainer.appendChild(messageElement);
    // 滾動到底部
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 顯示或隱藏加載指示器
function showLoadingIndicator(show, type = '思考') {
    let indicator = document.getElementById('loading-indicator');
    if (show) {
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'loading-indicator';
            indicator.classList.add('loading-indicator');
             // 插入到消息容器的末尾
            messagesContainer.appendChild(indicator);
        }
        const randomEmoji = animalEmojis[Math.floor(Math.random() * animalEmojis.length)];
        indicator.innerHTML = `<strong>Gemini 正在為你${type}⋯⋯</strong><span>${randomEmoji}</span>`;
        indicator.style.display = 'block';
        // 確保滾動到底部能看到指示器
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else {
        if (indicator) {
            indicator.style.display = 'none';
            // 可以選擇移除元素，或者只是隱藏
            // indicator.remove();
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

    // 添加對話歷史
    prompt += "【對話淵源】:\n";
    conversationHistory.forEach(msg => {
        const rolePrefix = msg.role === 'user' ? '客官 (用戶)' : '老夫 (曹雪芹)';
        prompt += `${rolePrefix}: ${msg.content}\n`;
    });

    // 添加用戶最新消息
    prompt += `\n【客官新言】:\n用戶: ${newMessage}\n`;

    // 結束標記，提示 AI 回覆
    prompt += "\n【老夫回應】:\n曹雪芹:";

    // console.log("Generated Prompt:", prompt); // 調試用
    return prompt;
}

// 限制對話歷史長度
function trimConversationHistory(maxLength) {
    if (conversationHistory.length > maxLength) {
        // 從數組開頭移除舊消息，保留最新的 maxLength 條
        conversationHistory.splice(0, conversationHistory.length - maxLength);
        // console.log(`Conversation history trimmed to ${maxLength} messages.`);
    }
}


// 調用 Gemini API 的函數（通過 Cloudflare Worker 代理）
function callGeminiAPI(prompt, callback) {
  // console.log("Sending prompt to Worker:", prompt); // Log the prompt being sent
  fetch('https://apis.bdfz.workers.dev', { // 確保這是你的 Worker URL
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
      // Worker 會根據 Origin 自動識別項目，無需 X-Project-Name
    },
    body: JSON.stringify({ prompt: prompt }) // 發送包含 prompt 的 JSON
  })
  .then(res => {
    if (!res.ok) {
        // 如果響應狀態不是 2xx，嘗試讀取錯誤信息
        return res.json().then(errData => {
            // 拋出一個包含服務器錯誤信息的 Error 對象
            throw new Error(`API請求失敗 (狀態 ${res.status}): ${errData.error || '未知服務器錯誤'}`);
        }).catch(() => {
            // 如果連 JSON 都解析不了，拋出通用錯誤
            throw new Error(`API請求失敗 (狀態 ${res.status}): 無法解析錯誤響應`);
        });
    }
    return res.json(); // 解析成功的 JSON 響應
  })
  .then(data => {
    // console.log('API返回數據：', data);
    if (data && data.answer) {
      callback(data.answer); // 調用回調函數，傳遞 AI 的回答
    } else {
      console.error('API 返回數據格式錯誤或無回答:', data);
      callback("抱歉，老夫神思倦怠，暫時無法回應。請稍後再試。"); // 提供一個友好的錯誤回覆
    }
  })
  .catch(err => {
    console.error('調用 API 或處理響應時出錯：', err);
    showLoadingIndicator(false); // 確保錯誤時移除加載提示
    // 在聊天界面顯示錯誤信息
    appendMessageToChat('ai', `唉，與後端連接似乎出了些岔子：${err.message}。請稍後再試，或聯繫網站管理人。`);
  });
}