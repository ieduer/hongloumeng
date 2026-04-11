/* ==============================================================
   《紅樓夢》章節 + AI 人物情節分析  2025-06-14
   ============================================================== */

/* ---------- 全局狀態 ---------- */
let conversationHistory = [];
let currentChapterData = null;
let initialContentInfo = null;
let hongloumengData = null;
let shiciData = null;

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
const $analyzeBtn = document.getElementById('ai-analyze-btn');
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
  loadLocalHlmReadProgress();
  Promise.all([
    fetch('data/hongloumeng.json').then(r => r.ok ? r.json() : Promise.reject(r.status)),
    fetch('data/shici.json').then(r => r.ok ? r.json() : Promise.reject(r.status))
  ])
    .then(([hlm, sc]) => {
      hongloumengData = hlm; shiciData = sc;
      loadInitialPoem(); loadChapterMenu();
      // 菜單渲染完成後，從用戶系統拉一次遠端進度並合併
      hydrateReadProgressFromIdentity();
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
   顯示章節（不再自動觸發 AI）
   ============================================================== */
function loadChapter(ch) {
  resetState(); currentChapterData = ch;
  append('ai', `<h3>${ch.chapter}  ${ch.title}</h3>\n${formatContentForDisplay(ch.content)}`, ['chapter-content-display']);
  append('ai', `<p style="color:#888; font-size:0.9em;">💡 點擊下方「📖 AI分析」按鈕，可獲得本章人物、情節與高考考點的深度解析。</p>`);
  addConversationEntry('ai', `(展示${ch.chapter}${ch.title}全文)`, 'chapter-open');
  markHlmChapterRead(ch);
  trackChapterReading(ch);
  // 顯示 AI 分析按鈕
  if ($analyzeBtn) $analyzeBtn.style.display = '';
}

/* ==============================================================
   AI 章節分析（用戶手動觸發）
   ============================================================== */
function analyzeChapter(ch) {
  if (!ch) {
    append('ai', '請先選擇一個章節。');
    return;
  }
  loading('Gemini 正在分析本章人物與情節…');
  const prompt = `你是一位精通《紅樓夢》的語文教師兼高考閱卷專家，同時保持曹雪芹的文學視角。
請對《紅樓夢》${ch.chapter}「${ch.title}」進行深度分析，依序回答以下五個板塊：

**一、章節概要**
用 3-5 句話概括本章核心情節和在全書結構中的位置。

**二、人物分析**
列出本章出場的主要人物（3-5人），針對每一位：
- 在本章的行為和語言特點
- 性格體現和心理動機
- 與其他人物的關係變化

**三、情節與文學技巧**
- 本章運用了哪些敘事手法（如伏筆、對比、象徵、諷刺等）？
- 關鍵場景的藝術效果分析

**四、高考考點解讀**
結合中國高考語文對《紅樓夢》的考查方向，分析本章可能涉及的考點：
- 名著閱讀題常見角度（人物形象、情節概括、主題理解）
- 微寫作和大作文中可能引用本章內容的方向
- 1-2 道模擬簡答題及參考要點

**五、經典名句與點評**
摘錄本章 2-3 句具有深意的經典語句，並簡析其文學價值。

輸出要求：全程使用繁體中文，語言學術嚴謹但生動易懂。`;
  askLLM(prompt, res => {
    loading(false);
    const formatted = formatContentForDisplay(res);
    append('ai', `<strong>📖 ${ch.chapter}「${ch.title}」深度分析</strong><br>${formatted}`);
    addConversationEntry('ai', `(AI 分析 ${ch.chapter} ${ch.title})`, 'chapter-analysis');
  });
}

/* ==============================================================
   用戶訊息
   ============================================================== */
$send.addEventListener('click', sendMsg);
$in.addEventListener('keypress', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
});

/* AI 分析按鈕 */
if ($analyzeBtn) {
  $analyzeBtn.addEventListener('click', () => {
    analyzeChapter(currentChapterData);
  });
}

function sendMsg() {
  const txt = $in.value.trim(); if (!txt) return;
  append('user', txt); $in.value = '';
  addConversationEntry('user', txt, 'user-message');
  trackChapterDiscussion(currentChapterData, txt);

  /* 用戶輸入「分析」觸發章節分析 */
  if (/^分析|^AI分析|^考點/.test(txt) && currentChapterData) {
    analyzeChapter(currentChapterData); return;
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
  initialContentInfo = null;
  // 隱藏 AI 分析按鈕
  if ($analyzeBtn) $analyzeBtn.style.display = 'none';
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

/* ==============================================================
   已讀進度追蹤/顯示 (Read Progress Visual Indicator)
   ============================================================== */

// 本地已讀進度 Set
let hlmReadSet = new Set();
let hlmInProgressSet = new Set();

function loadLocalHlmReadProgress() {
  try {
    const stored = localStorage.getItem('hlm_read_progress');
    hlmReadSet = stored ? new Set(JSON.parse(stored)) : new Set();
  } catch (e) { hlmReadSet = new Set(); }
}

function saveLocalHlmReadProgress() {
  try {
    localStorage.setItem('hlm_read_progress', JSON.stringify([...hlmReadSet]));
  } catch (e) { /* quota */ }
}

function markHlmChapterRead(ch) {
  if (!ch) return;
  const key = chapterItemKey(ch);
  hlmReadSet.add(key);
  hlmInProgressSet.delete(key);
  saveLocalHlmReadProgress();
  updateChapterMenuReadStatus();
}

// 更新目錄中已讀/進行中狀態
function updateChapterMenuReadStatus() {
  if (!hongloumengData?.chapters) return;
  const buttons = $menu.querySelectorAll('button');
  hongloumengData.chapters.forEach((ch, idx) => {
    const btn = buttons[idx];
    if (!btn) return;
    const key = chapterItemKey(ch);
    btn.classList.remove('read', 'reading');
    if (hlmReadSet.has(key)) {
      btn.classList.add('read');
    } else if (hlmInProgressSet.has(key)) {
      btn.classList.add('reading');
    }
  });
}

// 從 BdfzIdentity 拉取遠端進度，與本地合併
async function hydrateReadProgressFromIdentity() {
  const identity = getIdentity();
  if (!identity || typeof identity.api !== 'function') {
    console.debug('[hlm] hydrateReadProgressFromIdentity skipped: no identity or API');
    updateChapterMenuReadStatus();
    return;
  }
  try {
    const payload = await identity.api(`/api/progress?site=${encodeURIComponent(SITE_KEY)}`);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    if (!items.length) { updateChapterMenuReadStatus(); return; }

    items.forEach(item => {
      const key = String(item?.itemKey || '');
      if (!key.startsWith('chapter-')) return;
      const isDone = item.state === 'done' || Number(item.progressPercent) >= 100;
      const isInProgress = item.state === 'in_progress';
      if (isDone) {
        hlmReadSet.add(key);
        hlmInProgressSet.delete(key);
      } else if (isInProgress && !hlmReadSet.has(key)) {
        hlmInProgressSet.add(key);
      }
    });

    saveLocalHlmReadProgress();
    updateChapterMenuReadStatus();
  } catch (e) {
    console.debug('[hlm] hydrateReadProgressFromIdentity skipped:', e?.message || e);
    updateChapterMenuReadStatus();
  }
}
