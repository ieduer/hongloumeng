/* ==============================================================
   《紅樓夢》章節 + 海龜湯互動遊戲  —  全量腳本
   2025-06-13 版（保留原有首頁詩詞、黑暗模式、格式化排版等功能，
   將「高考題」改為「海龜湯」謎題）
   ============================================================== */

/* ---------- 全局變量 ---------- */
let conversationHistory   = [];
let currentChapterData    = null;   // 目前選定章節
let initialContentInfo    = null;   // 首頁隨機詩詞資訊
let hongloumengData       = null;   // 《紅樓夢》全文
let shiciData             = null;   // 詩詞資料

// 海龜湯遊戲狀態
let currentTurtleSoup = null;       // { question, answer }
let puzzleSolved      = false;      // 是否已解謎

/* ---------- DOM ---------- */
const messagesContainer = document.getElementById('messages');
const userInput         = document.getElementById('user-input');
const chatButton        = document.getElementById('chat-button');
const chapterMenu       = document.getElementById('chapter-menu');
const toggleDarkBtn     = document.getElementById('toggle-dark-btn');
const animalEmojis      = ['😼','🐶','🦊','🐻','🐼','🐰','🐯','🦉','🍁','🏮'];

/* ---------- 初始化 ---------- */
document.addEventListener('DOMContentLoaded', () => {
  Promise.all([
    fetch('data/hongloumeng.json').then(r => r.ok ? r.json()
                                                  : Promise.reject(`紅樓夢載入失敗 ${r.status}`)),
    fetch('data/shici.json')      .then(r => r.ok ? r.json()
                                                  : Promise.reject(`詩詞載入失敗 ${r.status}`))
  ])
  .then(([hlm, sc]) => {
    hongloumengData = hlm;
    shiciData       = sc;
    loadInitialContent();  // 首頁隨機詩詞
    loadChapterMenu();     // 章節選單
  })
  .catch(err => {
    console.error('初始化錯誤:', err);
    messagesContainer.innerHTML =
      `<p style="color:red;">初始化資料失敗：${err}</p>`;
    chatButton.disabled = true;
  });

  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
  }
});

/* ==============================================================
   章節選單
   ============================================================== */
function loadChapterMenu() {
  if (!hongloumengData?.chapters) {
    chapterMenu.innerHTML = '<p style="color:red;">無法加載章節列表</p>';
    return;
  }
  chapterMenu.innerHTML = '';
  hongloumengData.chapters.forEach(ch => {
    const btn = document.createElement('button');
    btn.textContent = `${ch.chapter}  ${ch.title}`;
    btn.onclick = () => loadChapter(ch);
    chapterMenu.appendChild(btn);
  });
}

/* ==============================================================
   首頁隨機詩詞
   ============================================================== */
function loadInitialContent() {
  if (!Array.isArray(shiciData) || !shiciData.length) {
    appendMessageToChat('ai','歡迎，暫無詩詞可顯示，請從目錄選章節閱讀《紅樓夢》。');
    return;
  }
  resetState();

  const entry = shiciData[Math.floor(Math.random() * shiciData.length)];
  const { title, poem_text, explanation } = entry.details;

  const html = `<h3>${title}</h3>
                <div class="poem-like-block">${poem_text.join('<br>')}</div>` +
               (explanation ? `<strong>【註解】</strong>${formatContentForDisplay(explanation)}` : '');

  appendMessageToChat('ai',
    `偶隨書頁翻，拾得片語詩箋，錄之以饗客官：\n\n${html}`,
    ['initial-poem']);

  initialContentInfo = { title };
}

/* ==============================================================
   加載章節 → 顯示全文 → 生成海龜湯
   ============================================================== */
function loadChapter(chapter) {
  resetState();
  currentChapterData = chapter;

  /* —— 顯示章節正文 —— */
  const formatted = formatContentForDisplay(chapter.content);
  appendMessageToChat('ai',
    `<h3>${chapter.chapter}  ${chapter.title}</h3>\n${formatted}`,
    ['chapter-content-display']);

  conversationHistory.push({
    role:'ai',
    content:`(系統展示 《紅樓夢》${chapter.chapter}  ${chapter.title} 全文)`
  });

  /* —— 生成海龜湯謎題 —— */
  requestTurtleSoup(chapter);
}

function requestTurtleSoup(chapter) {
  showLoadingIndicator('Gemini 正烹製海龜湯…');

  const prompt = `
你是曹雪芹。依據《紅樓夢》${chapter.chapter} ${chapter.title} 的情節，
設計一題「海龜湯」謎題，並按下列格式輸出：

【謎面】
（模糊且引人好奇的描述，不可暴露答案）

【謎底】
（完整真實情節，供你內部判斷）

規則：之後用戶只能提問可回答「是」「否」「無關」的問題，
你也僅能以此三詞作答。當用戶猜中謎底核心，
回覆「恭喜你解開謎題！」並簡短解釋原情節。`;

  callGeminiAPI(prompt, res => {
    removeLoadingIndicator();
    currentTurtleSoup = parseTurtleSoup(res);
    if (!currentTurtleSoup) {
      appendMessageToChat('ai','謎題生成失敗，請重選章節再試。');
      return;
    }
    appendMessageToChat('ai',
      `<strong>🌊 海龜湯謎題：</strong><br>${currentTurtleSoup.question}`);
    conversationHistory.push({
      role:'ai',
      content:`(海龜湯謎面：${currentTurtleSoup.question}；謎底：${currentTurtleSoup.answer})`
    });
  });
}

function parseTurtleSoup(text){
  const m = text.match(/【謎面】\s*([\s\S]*?)\s*【謎底】\s*([\s\S]*)/);
  return m ? { question: m[1].trim(), answer: m[2].trim() } : null;
}

/* ==============================================================
   用戶互動
   ============================================================== */
chatButton.addEventListener('click', sendChatMessage);
userInput.addEventListener('keypress', e=>{
  if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendChatMessage(); }
});

function sendChatMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  appendMessageToChat('user', text);
  userInput.value = '';
  conversationHistory.push({ role:'user', content:text });
  trimConversationHistory();

  /* —— 若正在海龜湯遊戲 —— */
  if (currentTurtleSoup && !puzzleSolved) {
    showLoadingIndicator('思索中…');

    const puzzlePrompt = `
【謎面】${currentTurtleSoup.question}
【謎底】${currentTurtleSoup.answer}

用戶提問：「${text}」

僅以「是」「否」「無關」回答。
若用戶已猜出謎底，回覆：
「恭喜你解開謎題！」並附簡短情節解釋。`;

    callGeminiAPI(puzzlePrompt, res => {
      removeLoadingIndicator();
      appendMessageToChat('ai', res);
      conversationHistory.push({ role:'model', content:res });
      if (res.includes('恭喜你解開謎題')) puzzleSolved = true;
    });
    return;
  }

  /* —— 普通對話（海龜湯結束後才會用到） —— */
  showLoadingIndicator('Gemini 回覆中…');
  const prompt = buildPromptWithHistory(text, currentChapterData);
  callGeminiAPI(prompt, res => {
    removeLoadingIndicator();
    appendMessageToChat('ai', res);
    conversationHistory.push({ role:'model', content:res });
    trimConversationHistory();
  });
}

/* ==============================================================
   格式化顯示
   ============================================================== */
function formatContentForDisplay(text){
  if(!text) return '';
  let t = text.replace(/\r\n?/g,'\n').trim();

  // Markdown 轉換
  t = t.replace(/^### (.*)$/gim,'<h3>$1</h3>')
       .replace(/^## (.*)$/gim,'<h2>$1</h2>')
       .replace(/^# (.*)$/gim ,'<h1>$1</h1>')
       .replace(/\*\*\*(.*?)\*\*\*/g,'<strong><em>$1</em></strong>')
       .replace(/\*\*(.*?)\*\*/g   ,'<strong>$1</strong>')
       .replace(/\*(.*?)\*/g       ,'<em>$1</em>');

  // 清單
  t = t.replace(/^(?:[\*\-]\s+.*(?:\n|$))+/gm, m=>{
    return `<ul>${m.trim().split('\n')
             .map(l=>`<li>${l.replace(/^[\*\-]\s+/,'')}</li>`).join('')}</ul>`;
  });
  t = t.replace(/^(?:\d+\.\s+.*(?:\n|$))+/gm, m=>{
    return `<ol>${m.trim().split('\n')
             .map(l=>`<li>${l.replace(/^\d+\.\s+/,'')}</li>`).join('')}</ol>`;
  });

  // 段落與首行縮排；中文句號、問號、驚嘆號後自動換行
  const blocks = t.split(/\n\s*\n+/).map(b=>b.trim()).filter(Boolean);
  const html   = blocks.map(b=>{
    if(/^<(h[1-6]|ul|ol|blockquote|pre)/i.test(b)) return b;
    const p = b.replace(/([。？！])/g,'$1<br>').replace(/<br>$/,'');
    return `<p style="text-indent:2em;">${p}</p>`;
  }).join('');
  return html.replace(/<p>\s*<\/p>/g,'');
}

/* ==============================================================
   輔助：聊天框、Loading、Prompt 與歷史
   ============================================================== */
function appendMessageToChat(sender, message, classes = []) {
  const msgEl = document.createElement('div');
  msgEl.classList.add('message-bubble', sender==='user'?'user-message':'ai-message', ...classes);

  if (sender === 'ai' && /<[a-z][\s\S]*>/i.test(message)){
    msgEl.innerHTML = message;
  } else {
    msgEl.innerHTML = `<p>${message
        .replace(/</g,"<").replace(/>/g,">").replace(/\n/g,'<br>')}</p>`;
  }
  messagesContainer.appendChild(msgEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showLoadingIndicator(text){
  removeLoadingIndicator();
  const d=document.createElement('div');
  d.id='loading-indicator';
  d.className='loading-indicator';
  d.innerHTML=`<strong>${text}</strong><span>${animalEmojis[Math.floor(Math.random()*animalEmojis.length)]}</span>`;
  messagesContainer.appendChild(d);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
function removeLoadingIndicator(){
  document.getElementById('loading-indicator')?.remove();
}

function buildPromptWithHistory(newMessage, chapterCtx=null){
  let p = '你是曹雪芹，古雅口吻應答。\n\n';
  if (chapterCtx) p += `【章節】${chapterCtx.chapter} ${chapterCtx.title}\n\n`;

  const turns = conversationHistory.filter(x=>x.role==='user'||x.role==='model').slice(-10);
  if (turns.length){
    p += '【對話】\n';
    turns.forEach(t=>{
      const who = t.role==='user'?'客官':'老夫';
      const c   = t.content.replace(/<[^>]*>/g,' ').slice(0,180);
      p += `${who}: ${c}${t.content.length>180?'…':''}\n`;
    });
    p += '\n';
  }
  p += `客官: ${newMessage}\n\n曹雪芹:`;
  return p;
}

function trimConversationHistory(max=20){
  if(conversationHistory.length>max)
    conversationHistory.splice(0,conversationHistory.length-max);
}

function resetState(){
  messagesContainer.innerHTML = '';
  conversationHistory = [];
  currentChapterData  = null;
  currentTurtleSoup   = null;
  puzzleSolved        = false;
  initialContentInfo  = null;
}

/* ==============================================================
   Gemini API
   ============================================================== */
function callGeminiAPI(prompt, callback){
  fetch('https://ai.bdfz.net/',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ prompt })
  })
  .then(res => res.ok ? res.json() : res.text().then(t=>{ throw new Error(t||res.status); }))
  .then(j  => callback(j.answer || '…老夫一時語塞。'))
  .catch(e => {
    console.error('API 錯誤:', e);
    callback(`<span style="color:red;">後端錯誤：${e.message}</span>`);
  });
}

/* ==============================================================
   黑暗模式
   ============================================================== */
toggleDarkBtn.addEventListener('click',()=>{
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('theme',
    document.body.classList.contains('dark-mode') ? 'dark' : 'light');
});