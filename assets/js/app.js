/* ==============================================================
   《紅樓夢》章節 + 海龜湯互動腳本  2025-06-14
   ============================================================== */

/* ---------- 全局狀態 ---------- */
let conversationHistory = [];
let currentChapterData = null;
let initialContentInfo = null;
let hongloumengData = null;
let shiciData = null;

let currentTurtleSoup = null;      // { question, answer }
let puzzleSolved = false;
let lastPrompt = null;      // 用於重試
let lastCallback = null;      // 用於重試
const SITE_KEY = 'hlm';
let conversationSessionKey = '';

/* ---------- DOM ---------- */
const $msg = document.getElementById('messages');
const $in = document.getElementById('user-input');
const $send = document.getElementById('chat-button');
const $menu = document.getElementById('chapter-menu');
const $dark = document.getElementById('toggle-dark-btn');
const emojis = ['😼', '🐶', '🦊', '🐻', '🐼', '🐰', '🐯', '🦉', '🍁', '🏮'];

function getIdentity() {
  return window.BdfzIdentity || null;
}

function mountIdentity() {
  getIdentity()?.mount({ siteKey: SITE_KEY });
}

function chapterItemKey(ch) {
  return `chapter-${String(ch?.chapter || '').trim().replace(/\s+/g, '-')}`;
}

function trackChapterReading(ch) {
  if (!ch) return;
  getIdentity()?.syncProgress({
    siteKey: SITE_KEY,
    itemKey: chapterItemKey(ch),
    itemTitle: ch.title || ch.chapter || '紅樓夢章節',
    itemGroup: '阅读',
    itemType: 'chapter',
    state: 'in_progress',
    progressPercent: 30,
    meta: {
      chapter: ch.chapter || '',
    },
  }).catch(() => {});
}

function trackChapterDiscussion(ch, message) {
  if (!ch || !message) return;
  getIdentity()?.syncProgress({
    siteKey: SITE_KEY,
    itemKey: `discussion-${chapterItemKey(ch)}`,
    itemTitle: `${ch.title || ch.chapter || '紅樓夢章節'} 对话`,
    itemGroup: '讨论',
    itemType: 'discussion',
    state: 'in_progress',
    progressPercent: 55,
    meta: {
      chapter: ch.chapter || '',
      messageLength: String(message).length,
    },
    }).catch(() => {});
}

function resetConversationSession() {
  conversationSessionKey = getIdentity()?.createSessionKey?.(`${SITE_KEY}-chat`) || `${SITE_KEY}-chat-${Date.now().toString(36)}`;
}

function syncConversationArchive(reason = 'update') {
  if (!conversationHistory.length) return;
  if (!conversationSessionKey) resetConversationSession();
  getIdentity()?.recordConversation({
    siteKey: SITE_KEY,
    sessionKey: conversationSessionKey,
    title: (currentChapterData?.title || currentChapterData?.chapter || '紅樓夢').slice(0, 80),
    summary: conversationHistory[conversationHistory.length - 1]?.content?.slice(0, 120) || '紅樓夢對話',
    sourceUrl: window.location.href,
    messages: conversationHistory.map((message, index) => ({
      id: String(index + 1),
      role: message.role === 'user' ? 'user' : 'assistant',
      content: message.content,
    })),
    meta: {
      reason,
      chapter: currentChapterData?.chapter || '',
      turtleSoup: Boolean(currentTurtleSoup),
    },
  }).catch(() => {});
}

function addConversationEntry(role, content, reason = 'update') {
  conversationHistory.push({ role, content });
  trimHist(20);
  syncConversationArchive(reason);
}

/* ---------- 初始化 ---------- */
document.addEventListener('DOMContentLoaded', () => {
  mountIdentity();
  resetConversationSession();
  Promise.all([
    fetch('data/hongloumeng.json').then(r => r.ok ? r.json() : Promise.reject(r.status)),
    fetch('data/shici.json').then(r => r.ok ? r.json() : Promise.reject(r.status))
  ])
    .then(([hlm, sc]) => {
      hongloumengData = hlm; shiciData = sc;
      loadInitialPoem(); loadChapterMenu();
    })
    .catch(e => {
      console.error(e);
      append('ai', `<p style="color:red;">初始化錯誤：${e}</p>`); $send.disabled = true;
    });

  if (localStorage.getItem('theme') === 'dark')
    document.body.classList.add('dark-mode');

  // 恢復對話歷史
  try {
    const saved = localStorage.getItem('chatHistory');
    if (saved) {
      conversationHistory = JSON.parse(saved);
      syncConversationArchive('hydrate-local');
    }
  } catch (e) { console.warn('無法恢復對話歷史:', e); }
});

/* ==============================================================
   章節目錄
   ============================================================== */
function loadChapterMenu() {
  if (!hongloumengData?.chapters) {
    $menu.innerHTML = '<p style="color:red;">目錄載入失敗</p>'; return;
  }
  $menu.innerHTML = '';
  hongloumengData.chapters.forEach(ch => {
    const b = document.createElement('button');
    b.textContent = `${ch.chapter}  ${ch.title}`;
    b.onclick = () => loadChapter(ch);
    $menu.appendChild(b);
  });
}

/* ==============================================================
   首頁隨機詩詞（恢復原 350 行格式）
   ============================================================== */
function normalizePoemLines(poemText) {
  if (Array.isArray(poemText)) {
    return poemText.map(line => String(line || '').trim()).filter(Boolean);
  }
  if (typeof poemText === 'string') {
    return poemText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
  }
  return [];
}

function loadInitialPoem() {
  resetState();
  if (!Array.isArray(shiciData) || !shiciData.length) {
    append('ai', '暫無詩詞'); return;
  }
  const e = shiciData[Math.floor(Math.random() * shiciData.length)];
  const { title, poem_text, explanation } = e.details;
  const poemLines = normalizePoemLines(poem_text);

  const formattedPoem = poemLines.length ? poemLines.join('<br>') : '暫無內容';
  const html =
    `<h3>${title}</h3>` +
    `<div class="poem-like-block">${formattedPoem}</div>` +
    (explanation ? `<strong>【註解】</strong>${formatContentForDisplay(explanation)}` : '');

  append('ai', `偶隨書頁翻，拾得片語詩箋：\n\n${html}`, ['initial-shici-display']);
  initialContentInfo = { title };
}

/* ==============================================================
   顯示章節 ⇒ 生成海龜湯
   ============================================================== */
function loadChapter(ch) {
  resetState(); currentChapterData = ch;
  append('ai', `<h3>${ch.chapter}  ${ch.title}</h3>\n${formatContentForDisplay(ch.content)}`, ['chapter-content-display']);
  addConversationEntry('ai', `(展示${ch.chapter}${ch.title}全文)`, 'chapter-open');
  trackChapterReading(ch);
  genTurtleSoup(ch);
}
function genTurtleSoup(ch) {
  loading('Gemini 正烹製海龜湯…');
  const prompt = `
你是曹雪芹。依據《紅樓夢》${ch.chapter} ${ch.title} 的情節，設計海龜湯：
【謎面】用簡潔、現代讀者易懂且有趣的描述（尊重原文）
【謎底】完整情節（僅供你判斷）
之後「客官」只能問 *能以「是／否／無關」回答* 的問題，
你僅回答「是」「否」「無關」。
猜中後回覆「恭喜你解開謎題！」並簡短解釋。`;
  askLLM(prompt, res => {
    loading(false);
    currentTurtleSoup = parsePuzzle(res);
    if (!currentTurtleSoup) {
      append('ai', '謎題生成失敗，請刷新頁面再試。');
      return;
    }
    append('ai', `<strong>🌊 海龜湯謎題：</strong><br>${currentTurtleSoup.question}<br><small style="color:#888;">（請提出能以「是／否／無關」回答的問題）</small>`);
    addConversationEntry('ai', `(謎面:${currentTurtleSoup.question};謎底:${currentTurtleSoup.answer})`, 'turtle-puzzle');
  });
}
function parsePuzzle(t) {
  const m = t.match(/【謎面】\s*([\s\S]*?)\s*【謎底】\s*([\s\S]*)/);
  return m ? { question: m[1].trim(), answer: m[2].trim() } : null;
}

/* ==============================================================
   用戶訊息
   ============================================================== */
$send.addEventListener('click', sendMsg);
$in.addEventListener('keypress', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
});

function sendMsg() {
  const txt = $in.value.trim(); if (!txt) return;
  append('user', txt); $in.value = '';
  addConversationEntry('user', txt, 'user-message');
  trackChapterDiscussion(currentChapterData, txt);

  /* 用戶要求再來海龜湯 */
  if (/海龜湯|再來|再做/.test(txt) && currentChapterData) {
    puzzleSolved = false; currentTurtleSoup = null; genTurtleSoup(currentChapterData); return;
  }

  /* 海龜湯進行中 */
  if (currentTurtleSoup) {          // 若為 null 則直接普通對話
    loading('思索中…');
    const puzzlePrompt = `【謎面】${currentTurtleSoup.question}
【謎底】${currentTurtleSoup.answer}
客官：「${txt}」
僅回答「是」「否」「無關」。猜中則祝賀並解釋。`;
    askLLM(puzzlePrompt, res => {
      loading(false);
      append('ai', res);
      addConversationEntry('model', res, 'assistant-message');
      if (res.includes('恭喜你解開謎題')) {
        /* —— 用戶猜中：轉入普通對話 —— */
        puzzleSolved = true; currentTurtleSoup = null;
      }
    });
    return;
  }

  /* 普通對話 */
  loading('Gemini 回覆中…');
  askLLM(buildPrompt(txt), res => {
    loading(false); append('ai', res); addConversationEntry('model', res, 'assistant-message');
  });
}

/* ==============================================================
   舊版 formatContentForDisplay
   ============================================================== */
function formatContentForDisplay(text) {
  if (!text) return "";
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\(本[章回]完\)$/gm, '').trim();

  let e = text.replace(/</g, "<").replace(/>/g, ">");

  e = e.replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');

  e = e.replace(/^(?:[\*\-]\s+.*(?:\n|$))+/gm, m => {
    const items = m.trim().split('\n').map(l => `<li>${l.replace(/^[\*\-]\s+/, '').trim()}</li>`).join('');
    return `<ul>${items}</ul>`;
  });
  e = e.replace(/^(?:\d+\.\s+.*(?:\n|$))+/gm, m => {
    const items = m.trim().split('\n').map(l => `<li>${l.replace(/^\d+\.\s+/, '').trim()}</li>`).join('');
    return `<ol>${items}</ol>`;
  });

  const blocks = e.split(/\n\s*\n+/g).map(b => b.trim()).filter(Boolean);
  let html = "";
  if (blocks.length) {
    html = blocks.map(b => {
      if (/^<(?:h[1-6]|ul|ol|p|blockquote|pre)/i.test(b))
        return b.replace(/\n/g, '<br>');
      return `<p>${b.replace(/\n/g, '<br>')}</p>`;
    }).join('');
  } else html = `<p>${e.replace(/\n/g, '<br>')}</p>`;

  html = html.replace(/<p>\s*<\/p>/gi, '');
  if (html.replace(/<p>|<br>|<\/p>|\s/g, '') === '') return "";
  return html;
}

/* ==============================================================
   UI 輔助
   ============================================================== */
function append(role, html, cls = []) {
  const d = document.createElement('div');
  d.classList.add('message-bubble', role === 'user' ? 'user-message' : 'ai-message', ...cls);
  d.innerHTML = html.includes('<') ? html : `<p>${html.replace(/</g, '<').replace(/>/g, '>').replace(/\n/g, '<br>')}</p>`;
  $msg.appendChild(d); $msg.scrollTop = $msg.scrollHeight;
}
function loading(txt) { txt ? show(txt) : hide(); }
function show(txt) {
  hide(); const s = document.createElement('div');
  s.id = 'load'; s.className = 'loading-indicator';
  s.innerHTML = `<strong>${txt}</strong><span>${emojis[Math.floor(Math.random() * emojis.length)]}</span>`;
  $msg.appendChild(s); $msg.scrollTop = $msg.scrollHeight;
}
function hide() { document.getElementById('load')?.remove(); }

/* 骨架屏加載 */
function showSkeleton() {
  hide();
  const s = document.createElement('div');
  s.id = 'load'; s.className = 'skeleton-bubble ai-message';
  s.innerHTML = `<div class="skeleton-line"></div><div class="skeleton-line short"></div><div class="skeleton-line"></div>`;
  $msg.appendChild(s); $msg.scrollTop = $msg.scrollHeight;
}

function buildPrompt(newMsg) {
  let p = '你是曹雪芹，古雅口吻應答。\n\n';
  if (currentChapterData) p += `【章節】${currentChapterData.chapter} ${currentChapterData.title}\n\n`;
  const hist = conversationHistory.filter(x => x.role !== 'ai').slice(-8);
  if (hist.length)
    p += '【對話】\n' + hist.map(h => `${h.role === 'user' ? '客官' : '老夫'}: ${h.content.replace(/<[^>]*>/g, ' ').slice(0, 120)}\n`).join('') + '\n';
  return p + `客官: ${newMsg}\n\n曹雪芹:`;
}
function trimHist(n) {
  if (conversationHistory.length > n) conversationHistory.splice(0, conversationHistory.length - n);
  // 持久化到 localStorage
  try { localStorage.setItem('chatHistory', JSON.stringify(conversationHistory)); }
  catch (e) { console.warn('無法保存對話歷史:', e); }
}
function resetState() {
  $msg.innerHTML = '';
  conversationHistory = []; currentChapterData = null; resetConversationSession();
  currentTurtleSoup = null; puzzleSolved = false; initialContentInfo = null;
}

/* ==============================================================
   Gemini API
   ============================================================== */
function askLLM(prompt, cb) {
  lastPrompt = prompt;
  lastCallback = cb;
  fetch('https://ai.bdfz.net/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  })
    .then(r => r.ok ? r.json() : r.text().then(t => { throw new Error(t || r.status); }))
    .then(j => cb(j.answer?.trim() || '…老夫一時語塞。'))
    .catch(e => {
      console.error(e);
      cb(`<span style="color:#c75;">連接失敗：${e.message}</span> <button class="retry-btn" onclick="retryLLM()">🔄 重試</button>`);
    });
}

/* 重試上次請求 */
function retryLLM() {
  if (!lastPrompt || !lastCallback) return;
  hide();
  showSkeleton();
  askLLM(lastPrompt, res => { hide(); append('ai', res); });
}

/* ==============================================================
   黑暗模式
   ============================================================== */
$dark.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('theme',
    document.body.classList.contains('dark-mode') ? 'dark' : 'light');
});
