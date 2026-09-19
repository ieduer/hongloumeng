/* =============================================================
   紅樓夢 · 整本書閱讀與北京卷真題
   前端重寫 2026-09-09
   ============================================================= */
'use strict';

const SITE_KEY = 'hlm';
const V = 'v=2026091704';

/* ---------------- 小工具 ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
const CN = '零一二三四五六七八九';
function cn(n) {
  if (n <= 10) return n === 10 ? '十' : CN[n];
  if (n < 20) return '十' + CN[n % 10];
  if (n < 100) return CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : '');
  const h = Math.floor(n / 100), r = n % 100;
  let s = CN[h] + '百';
  if (!r) return s;
  if (r < 10) return s + '零' + CN[r];
  return s + (r < 20 ? '十' + (r % 10 ? CN[r % 10] : '') : cn(r));
}
const chLabel = (n) => '第' + cn(n) + '回';

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
};

const cache = {};
async function getJSON(path) {
  if (cache[path]) return cache[path];
  cache[path] = fetch(path + (path.includes('?') ? '&' : '?') + V)
    .then(r => { if (!r.ok) throw new Error(path + ' ' + r.status); return r.json(); })
    .catch(e => { delete cache[path]; throw e; });
  return cache[path];
}
const D = {
  chapters: () => getJSON('data/study/chapters.json'),
  exams: () => getJSON('data/study/exams.json'),
  people: () => getJSON('data/study/people.json'),
  poems: () => getJSON('data/study/poems.json'),
  plans: () => getJSON('data/study/plans.json'),
  method: () => getJSON('data/authored/method.json'),
  text: (n) => getJSON('data/text/ch' + String(n).padStart(3, '0') + '.json'),
  full: () => getJSON('data/hongloumeng.json'),
  research: () => getJSON('data/authored/research.json'),
};

/* ---------------- 進度（沿用舊版 itemKey 契約） ---------------- */
let readSet = new Set(store.get('hlm_read_progress', []));
const itemKey = (n) => 'chapter-第' + n + '章';
const isRead = (n) => readSet.has(itemKey(n));
function setRead(n, on) {
  const k = itemKey(n);
  if (on) readSet.add(k); else readSet.delete(k);
  store.set('hlm_read_progress', [...readSet]);
  syncProgress(n, on);
}
const identity = () => window.BdfzIdentity || null;
function syncProgress(n, done) {
  // A manual reading marker is a self-report, separate from server completion.
  identity()?.getSession?.().then(session => {
    if (!session?.authenticated) return;
    return fetch('https://my.bdfz.net/api/data-records', {
      method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteKey: SITE_KEY, recordKind: 'event', recordKey: 'hlm:reading-marker:' + n,
        title: chLabel(n) + ' 閱讀標記', itemGroup: '紅樓夢', itemType: 'reading_self_report',
        contentFormat: 'hlm-reading-marker-v1', sourceUrl: location.href,
        payload: { chapterId: String(n), markedRead: done, scoringEligible: false } }),
    });
  })?.catch?.(() => {});
}

async function hydrateProgress() {
  const id = identity();
  if (!id || typeof id.api !== 'function') return;
  try {
    const payload = await id.api('/api/progress?site=' + encodeURIComponent(SITE_KEY));
    const items = Array.isArray(payload?.items) ? payload.items : [];
    let changed = false;
    items.forEach(it => {
      const k = String(it?.itemKey || '');
      if (!k.startsWith('chapter-')) return;
      if ((it.state === 'done' || Number(it.progressPercent) >= 100) && !readSet.has(k)) {
        readSet.add(k); changed = true;
      }
    });
    if (changed) { store.set('hlm_read_progress', [...readSet]); render(); }
  } catch (e) { /* 未登入或無資料，靜默 */ }
}

/* ---------------- 全域狀態 ---------------- */
const state = { chapters: null, route: null, peopleNames: null, renderId: 0 };
const prefs = Object.assign({ size: 19, lh: 2.05, width: 34 }, store.get('hlm_reader_prefs', {}));
function applyPrefs() {
  const r = document.documentElement.style;
  r.setProperty('--read-size', prefs.size + 'px');
  r.setProperty('--read-lh', prefs.lh);
  r.setProperty('--read-width', prefs.width + 'em');
  store.set('hlm_reader_prefs', prefs);
}

/* ---------------- 導覽 ---------------- */
const TABS = [
  ['#/', '今日'],
  ['#/read', '通讀'],
  ['#/exam', '真題'],
  ['#/people', '人物'],
  ['#/poems', '詩詞'],
  ['#/plan', '進度'],
  ['#/method', '讀法'],
];
function renderTabs() {
  const cur = location.hash || '#/';
  $('#tabs').innerHTML = TABS.map(([h, t]) => {
    const on = h === '#/' ? (cur === '#/' || cur === '') : cur.startsWith(h);
    return `<a href="${h}" class="${on ? 'on' : ''}">${t}</a>`;
  }).join('');
}

/* =============================================================
   路由
   ============================================================= */
function parseRoute() {
  const h = (location.hash || '#/').slice(1);
  const [pathPart, queryPart] = h.split('?');
  const seg = pathPart.split('/').filter(Boolean);
  const q = new URLSearchParams(queryPart || '');
  return { seg, q, raw: h };
}

async function render() {
  window.ReaderCompletion.detach();
  const renderId = ++state.renderId;
  const r = parseRoute();
  state.route = r;
  renderTabs();
  const view = $('#view');
  view.className = 'wrap';
  window.scrollTo({ top: 0 });
  const page = r.seg[0] || '';
  try {
    if (!page) await viewHome(view);
    else if (page === 'read') await viewRead(view, r);
    else if (page === 'exam') await viewExam(view, r);
    else if (page === 'people') await viewPeople(view, r);
    else if (page === 'poems') await viewPoems(view, r);
    else if (page === 'plan') await viewPlan(view, r);
    else if (page === 'method') await viewMethod(view);
    else if (page === 'search') await viewSearch(view, r);
    else if (page === 'research') await viewResearch(view, r);
    else view.innerHTML = '<p class="muted">找不到這一頁。<a href="#/">回首頁</a></p>';
  } catch (e) {
    if (renderId !== state.renderId) return;
    console.error(e);
    view.innerHTML = `<div class="card pad"><h3>載入失敗</h3><p class="muted small">${esc(e.message || e)}</p>
      <p><button class="btn" onclick="location.reload()">重新載入</button></p></div>`;
  }
  if (renderId === state.renderId) updateAIContext();
}

function skeleton(view, n = 6) {
  view.innerHTML = '<div class="card pad">' +
    Array.from({ length: n }, (_, i) => `<div class="skel" style="width:${90 - i * 7}%"></div>`).join('') +
    '</div>';
}

/* =============================================================
   今日
   ============================================================= */
function planState() {
  return Object.assign({ paceId: null, start: null }, store.get('hlm_plan', {}));
}
function localDate(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
function planDayNumber(ps, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ps.start || '')) return null;
  const start = Date.parse(ps.start + 'T00:00:00Z');
  if (!Number.isFinite(start)) return null;
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((now - start) / 86400000) + 1;
}

async function viewHome(view) {
  const renderId = state.renderId;
  skeleton(view, 5);
  const [chs, plans, poems, exams] = await Promise.all([D.chapters(), D.plans(), D.poems(), D.exams()]);
  if (renderId !== state.renderId) return;
  state.chapters = chs;
  const done = chs.items.filter(c => isRead(c.n)).length;
  const pct = Math.round(done / 120 * 100);
  const ps = planState();
  const plan = plans.plans.find(p => p.id === ps.paceId);
  const dayNo = planDayNumber(ps);
  const day = plan && dayNo ? plan.days[Math.min(Math.max(dayNo, 1), plan.total) - 1] : null;
  const doneDays = new Set(store.get('hlm_plan_done_' + (ps.paceId || 'x'), []));
  const last = store.get('hlm_last', null);

  const pool = poems.items.filter(p => p.lines.length >= 2 && p.explanation);
  const pick = pool[Math.floor(Math.random() * pool.length)];

  const R = 34, C = 2 * Math.PI * R;
  view.innerHTML = `
  <section class="hero">
    <div class="card pad today">
      ${day ? `
        <div class="d">${plan.name} · 第 ${dayNo > plan.total ? plan.total : dayNo} 天 / ${plan.total}${dayNo > plan.total ? '（已超出計畫期，可重新開始）' : ''}</div>
        <h2>${day.chapters.map(chLabel).join('、')}　${esc(day.titles.join(' ／ '))}</h2>
        <ul class="tasklist" id="today-tasks">
          ${day.tasks.map((t, i) => {
    const k = 'hlm_task_' + ps.paceId + '_' + day.d + '_' + i;
    const dn = store.get(k, false);
    return `<li class="${dn ? 'done' : ''}" data-k="${k}"><span class="k">${dn ? '✓' : ''}</span><span class="t">${esc(t)}</span></li>`;
  }).join('')}
        </ul>
        ${day.note ? `<p class="plan-note">◆ ${esc(day.note)}</p>` : ''}
        ${day.weekly ? `<p class="plan-note">◇ 本週回顧：${esc(day.weekly)}</p>` : ''}
        <p style="margin:16px 0 0"><a class="btn primary" href="#/read/${day.chapters[0]}">開始今天的閱讀</a>
          <a class="btn" href="#/plan">看完整計畫</a></p>
      ` : `
        <div class="d">尚未選擇進度計畫</div>
        <h2>先挑一個節奏，再開始讀</h2>
        <p class="muted small" style="margin:8px 0 14px">一百二十回不必硬啃。選一個能堅持下來的速度，每天的任務會自動排好——讀哪幾回、記哪幾首詩、練哪一道真題。</p>
        <div class="grid g3">
          ${plans.plans.map(p => `<button class="btn" data-pace="${p.id}">${esc(p.name)}</button>`).join('')}
        </div>
        <p class="muted tiny" style="margin-top:10px">也可以先<a href="#/read/1">直接從第一回讀起</a>。</p>
      `}
    </div>

    <div class="card pad">
      <div class="ring">
        <svg width="86" height="86" viewBox="0 0 86 86">
          <circle cx="43" cy="43" r="${R}" fill="none" stroke="var(--line)" stroke-width="7" />
          <circle cx="43" cy="43" r="${R}" fill="none" stroke="var(--zhu)" stroke-width="7"
            stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - done / 120)}"
            transform="rotate(-90 43 43)" />
        </svg>
        <div>
          <div class="n">${done}<span class="muted" style="font-size:15px"> / 120 回</span></div>
          <div class="muted small">已讀 ${pct}%${done ? '' : '　·　從第一回開始'}</div>
        </div>
      </div>
      ${last ? `<p style="margin:14px 0 0"><a class="btn" href="#/read/${last.n}">接著讀 ${chLabel(last.n)}</a></p>` : ''}
      <div style="margin-top:14px;padding-top:14px;border-top:1px dashed var(--line)" class="small muted">
        北京卷《紅樓夢》真題 <b class="zhu">${exams.items.length}</b> 道 ·
        詩詞判詞 <b class="zhu">${poems.items.length}</b> 篇 ·
        人物檔案 <b class="zhu">44</b> 位
      </div>
    </div>
  </section>

  ${pick ? `
  <div class="poem-card" style="margin-bottom:18px">
    <div class="tiny muted" style="letter-spacing:.14em">偶隨書頁翻　拾得片語詩箋</div>
    <h3 style="margin-top:6px">${esc(pick.title)}${pick.chapters.length ? `<span class="muted" style="font-size:13px;font-family:var(--sans);margin-left:8px">${pick.chapters.map(chLabel).join('、')}</span>` : ''}</h3>
    <div class="lines">${esc(pick.lines.join('\n'))}</div>
    <p class="small muted" style="margin:0">${esc((pick.explanation || '').slice(0, 130))}${(pick.explanation || '').length > 130 ? '…' : ''}
      <a href="#/poems?q=${encodeURIComponent(pick.title)}">全文與註釋</a></p>
    ${pick.qualityNote ? `<p class="tiny muted">${esc(pick.qualityNote)}</p>` : ''}
  </div>` : ''}

  <div class="grid g4">
    <a class="entry" href="#/exam"><div class="num">${exams.items.length}</div><h3>北京卷真題全編</h3>
      <p>2005—2026 年北京卷中全部涉及《紅樓夢》的試題，含原題、材料、答案要點與詳解。</p></a>
    <a class="entry" href="#/people"><div class="num">44</div><h3>人物分析</h3>
      <p>判詞歸屬、關鍵情節、名稱分布、易錯點，以及每個人對應哪一年的真題。</p></a>
    <a class="entry" href="#/poems"><div class="num">${poems.items.length}</div><h3>詩詞與判詞</h3>
      <p>依回目、人物、類別（判詞／十二支曲／詩社／燈謎／對聯）交叉檢索。</p></a>
    <a class="entry" href="#/method"><div class="num">七</div><h3>日常閱讀方法</h3>
      <p>日常閱讀、證據組織與十項自查，附論文導讀考點卡。</p></a>
  </div>`;

  $$('[data-pace]', view).forEach(b => b.onclick = () => {
    const today = new Date();
    store.set('hlm_plan', { paceId: b.dataset.pace, start: localDate(today) });
    render();
  });
  $$('#today-tasks li', view).forEach(li => li.onclick = () => {
    const k = li.dataset.k, now = !store.get(k, false);
    store.set(k, now);
    li.classList.toggle('done', now);
    $('.k', li).textContent = now ? '✓' : '';
  });
}

/* =============================================================
   通讀
   ============================================================= */
function tocHTML(chs, cur, filter) {
  const f = (filter || '').trim();
  let html = '', part = '';
  chs.items.forEach(c => {
    if (f && !(c.title.includes(f) || String(c.n) === f || (c.focus || '').includes(f))) return;
    if (!f && c.part !== part) {
      part = c.part;
      const p = chs.parts.find(x => x.name === part);
      html += `<div class="toc-part">${esc(part)}　${p ? p.from + '–' + p.to : ''}</div>`;
    }
    html += `<button class="toc-item ${c.n === cur ? 'on' : ''} ${isRead(c.n) ? 'read' : ''} ${c.exams.length ? 'has-exam' : ''}"
      data-n="${c.n}"><span class="n">${c.n}</span><span class="dot"></span><span>${esc(c.title)}</span></button>`;
  });
  return html || '<p class="muted small" style="padding:8px">沒有符合的回目。</p>';
}

async function viewRead(view, r) {
  const renderId = state.renderId;
  const chs = await D.chapters();
  if (renderId !== state.renderId) return;
  state.chapters = chs;
  const n = Math.min(120, Math.max(1, parseInt(r.seg[1] || (store.get('hlm_last', {}).n) || 1, 10) || 1));
  const meta = chs.items[n - 1];

  view.innerHTML = `
  <div class="reader-layout">
    <aside class="toc" id="toc">
      <button class="chip toc-toggle" id="toc-toggle">目錄 ▾</button>
      <input class="toc-search" id="toc-q" type="search" placeholder="搜回目（輸入字詞或回數）" />
      <div class="toc-list" id="toc-list">${tocHTML(chs, n, '')}</div>
      <p class="tiny muted toc-hint" style="margin:8px 2px 0">紅點＝該回有北京卷真題　·　數字後小點＝已讀</p>
    </aside>
    <section class="reader">
      <div class="reader-bar">
        <span class="chip">${esc(meta.part)}</span>
        <span class="chip qing">${meta.words} 字</span>
        ${meta.exams.length ? `<span class="chip gold">真題 ${meta.exams.length}</span>` : ''}
        <span class="spacer"></span>
        <button class="chip" id="mk-mode" title="開啟後點擊段落即可畫記">劃記</button>
        <button class="chip" id="fs-dec">A−</button>
        <button class="chip" id="fs-inc">A+</button>
        <button class="chip" id="lh-tog">行距</button>
        <button class="chip ${isRead(n) ? 'on' : ''}" id="mark-read">${isRead(n) ? '✓ 已讀' : '標記已讀'}</button>
      </div>
      <div class="reader-cols">
        <div>
          <h1 class="chapter-title">${chLabel(n)}　${esc(meta.title)}</h1>
          <div class="chapter-sub">${meta.focus ? esc(meta.focus) : '&nbsp;'}</div>
          <div class="chapter-body" id="body">${Array.from({ length: 8 }, () => '<div class="skel"></div>').join('')}</div>
          <div class="pager">
            ${n > 1 ? `<a class="btn" href="#/read/${n - 1}">← ${chLabel(n - 1)}</a>` : '<span></span>'}
            ${n < 120 ? `<a class="btn primary" href="#/read/${n + 1}">${chLabel(n + 1)} →</a>` : '<span class="muted small">全書終</span>'}
          </div>
        </div>
        <aside class="reader-side" id="side"></aside>
      </div>
    </section>
  </div>`;

  // 目錄
  $('#toc-q').oninput = (e) => { $('#toc-list').innerHTML = tocHTML(chs, n, e.target.value); bindToc(); };
  const bindToc = () => $$('#toc-list .toc-item').forEach(b => b.onclick = () => { location.hash = '#/read/' + b.dataset.n; });
  bindToc();
  const toc = $('#toc');
  if (matchMedia('(max-width:760px)').matches) toc.classList.add('collapsed');
  $('#toc-toggle').onclick = () => {
    const c = toc.classList.toggle('collapsed');
    $('#toc-toggle').textContent = c ? '目錄 ▾' : '目錄 ▴';
  };
  const onEl = $('#toc-list .toc-item.on');
  if (onEl && !toc.classList.contains('collapsed')) onEl.scrollIntoView({ block: 'center' });

  // 排版控制
  $('#fs-inc').onclick = () => { prefs.size = Math.min(26, prefs.size + 1); applyPrefs(); };
  $('#fs-dec').onclick = () => { prefs.size = Math.max(15, prefs.size - 1); applyPrefs(); };
  $('#lh-tog').onclick = () => { prefs.lh = prefs.lh >= 2.3 ? 1.75 : Math.round((prefs.lh + 0.25) * 100) / 100; applyPrefs(); };
  $('#mark-read').onclick = (e) => {
    const now = !isRead(n);
    setRead(n, now);
    e.target.classList.toggle('on', now);
    e.target.textContent = now ? '✓ 已讀' : '標記已讀';
    $$('#toc-list .toc-item').forEach(b => { if (+b.dataset.n === n) b.classList.toggle('read', now); });
  };

  // 側欄
  const [poems, exams, people, research] = await Promise.all([D.poems(), D.exams(), D.people(), D.research()]);
  if (renderId !== state.renderId) return;
  const sideParts = [];
  if (meta.exams.length) {
    sideParts.push(`<div class="card pad side-box"><h4>本回真題</h4><ul>${meta.exams.map(id => {
      const it = exams.items.find(x => x.id === id);
      return it ? `<li><a href="#/exam/${it.id}">${it.year} 年 · ${esc(it.topic)}</a></li>` : '';
    }).join('')}</ul></div>`);
  }
  if (meta.poems.length) {
    sideParts.push(`<div class="card pad side-box"><h4>本回詩詞</h4><ul>${meta.poems.map(id => {
      const p = poems.items.find(x => x.id === id);
      return p ? `<li><a href="#/poems?q=${encodeURIComponent(p.title)}">${esc(p.title)}</a></li>` : '';
    }).join('')}</ul></div>`);
  }
  if (meta.people.length) {
    sideParts.push(`<div class="card pad side-box"><h4>本回主要人物</h4><ul>${meta.people.map(p => {
      const has = people.items.some(x => x.name === p.name);
      return `<li>${has ? `<a href="#/people/${encodeURIComponent(p.name)}">${esc(p.name)}</a>` : esc(p.name)}
        <span class="muted tiny">${p.n}</span></li>`;
    }).join('')}</ul></div>`);
  }
  sideParts.push(`<div class="card pad side-box"><h4>助讀</h4>
    <p class="tiny muted" style="margin:0 0 8px">讀完寫三行：本回發生了什麼／誰變了／埋了什麼。</p>
    <button class="btn" id="ai-chapter" style="width:100%">請 AI 解讀本回</button></div>`);
  sideParts.push(researchLinks(research, 'chapters', n));
  $('#side').innerHTML = sideParts.join('');
  $('#ai-chapter').onclick = () => { openAI(); askChapter(n, meta.title); };

  // 正文
  const doc = await D.text(n);
  if (renderId !== state.renderId) return;
  const marks = new Set(store.get('hlm_marks_' + n, []));
  const paras = doc.content.split(/\n+/).map(s => s.trim()).filter(Boolean);
  $('#body').innerHTML = paras.map((p, i) =>
    `<p data-i="${i}" data-seg="hlm:chapter:${n}:paragraph:${i}" class="${marks.has(i) ? 'mark' : ''}">${esc(p.replace(/^　+/, ''))}</p>`).join('');

  let markMode = false;
  $('#mk-mode').onclick = (e) => { markMode = !markMode; e.target.classList.toggle('on', markMode); };
  $('#body').onclick = (e) => {
    if (!markMode) return;
    const p = e.target.closest('p[data-i]');
    if (!p) return;
    const i = +p.dataset.i;
    if (marks.has(i)) { marks.delete(i); p.classList.remove('mark'); }
    else { marks.add(i); p.classList.add('mark'); }
    store.set('hlm_marks_' + n, [...marks]);
  };

  store.set('hlm_last', { n });
  window.ReaderCompletion.mount($('#body'), String(n), "p[data-seg]", "data-seg");
  window.scrollTo({ top: 0 });
}

/* =============================================================
   真題
   ============================================================= */
const TIER_LABEL = { core: '名著閱讀', micro: '微寫作', edge: '外圍' };

function examCardHTML(it, open) {
  return `<article class="card exam-item" id="ex-${it.id}">
    <button class="exam-head" data-id="${it.id}">
      <span class="exam-year">${it.year}</span>
      <span class="meta">
        <h3>${esc(it.topic)}</h3>
        <span class="sub">
          <span class="chip ${it.tier === 'core' ? 'on' : it.tier === 'micro' ? 'qing' : ''}">${TIER_LABEL[it.tier]}</span>
          <span>${/^[0-9]+[①-⑳]?$/.test(it.qNumber) ? '第 ' + esc(it.qNumber) + ' 題' : esc(it.qNumber)} · ${esc(it.type)}${it.score ? ' · ' + it.score + ' 分' : ''}</span>
          ${it.chapters.length ? `<span>涉及 ${it.chapters.slice(0, 4).map(chLabel).join('、')}${it.chapters.length > 4 ? '等' : ''}</span>` : ''}
        </span>
      </span>
      <span class="muted exam-toggle">${open ? '收合 ▴' : '展開 ▾'}</span>
    </button>
    ${open ? examBodyHTML(it) : ''}
  </article>`;
}

function examBodyHTML(it) {
  const ansKey = 'hlm_ans_' + it.id;
  return `<div class="exam-body">
    ${it.material ? `<div class="material"><span class="src">材料 · ${esc(it.material.source)}</span>${esc(it.material.text)}${it.material.footnote ? `\n\n<span class="src" style="margin:0">${esc(it.material.footnote)}</span>` : ''}</div>` : ''}
    <div class="qbox">${esc(it.stem)}</div>
    ${it.options ? `<ul class="opts">${it.options.map(o => `<li><b>${o.key}</b>${esc(o.text)}</li>`).join('')}</ul>` : ''}

    <div style="margin:14px 0">
      <div class="tiny muted" style="margin-bottom:6px">先自己寫一遍（只存在本機瀏覽器）</div>
      <textarea class="selfbox" data-ans="${ansKey}" placeholder="在此作答…">${esc(store.get(ansKey, ''))}</textarea>
    </div>

    <details class="anno">
      <summary>顯示答案與解析</summary>
      <div class="ans">
        <h4>答案</h4>
        <div class="body">${esc(it.answer)}</div>
        <p class="tiny muted" style="margin:8px 0 0">來源：${esc(it.answerSource)}${it.authorityNote ? '　·　' + esc(it.authorityNote) : ''}</p>
      </div>
      <div class="ans">
        <h4>解析</h4>
        <div class="body">${esc(it.analysis)}</div>
      </div>
      ${it.tips ? `<div class="ans"><h4>備考提示</h4><div class="body">${esc(it.tips)}</div></div>` : ''}
    </details>
    ${researchLinks(state.research, 'examIds', it.id)}

    <div class="filters" style="margin:14px 0 0">
      ${it.points.map(p => `<span class="chip">${esc(p)}</span>`).join('')}
      ${it.chapters.map(c => `<a class="chip qing" href="#/read/${c}">${chLabel(c)}</a>`).join('')}
      ${(it.people || []).map(p => state.peopleNames && state.peopleNames.has(p)
        ? `<a class="chip" href="#/people/${encodeURIComponent(p)}">${esc(p)}</a>`
        : `<span class="chip">${esc(p)}</span>`).join('')}
      <button class="chip gold" data-ai-exam="${it.id}">請 AI 批改我的作答</button>
    </div>
  </div>`;
}

async function viewExam(view, r) {
  const renderId = state.renderId;
  const [exams, people, research] = await Promise.all([D.exams(), D.people(), D.research()]);
  if (renderId !== state.renderId) return;
  state.peopleNames = new Set(people.items.map(x => x.name));
  state.research = research;
  const single = r.seg[1];
  if (single) {
    const it = exams.items.find(x => x.id === single);
    if (!it) { view.innerHTML = '<p class="muted">沒有這一題。<a href="#/exam">回真題列表</a></p>'; return; }
    view.className = 'wrap narrow';
    view.innerHTML = `<div class="page-head"><a class="small" href="#/exam">← 全部真題</a></div>` + examCardHTML(it, true);
    bindExam(view, exams);
    return;
  }

  const f = r.q.get('tier') || 'all';
  const TR = { core: 0, micro: 1, edge: 2 };
  const items = exams.items
    .filter(x => f === 'all' || x.tier === f)
    .sort((a, b) => (TR[a.tier] - TR[b.tier]) || (b.year - a.year));
  const byYear = {};
  exams.items.forEach(x => { byYear[x.tier] = (byYear[x.tier] || 0) + 1; });

  view.innerHTML = `
  <div class="page-head">
    <h1>北京卷《紅樓夢》真題全編</h1>
    <p>${esc(exams.meta.scope)}（${esc(exams.meta.years)}）。共 ${exams.items.length} 道：名著閱讀 ${byYear.core || 0} 道、微寫作 ${byYear.micro || 0} 道、外圍 ${byYear.edge || 0} 道。${esc(exams.meta.note)}</p>
  </div>
  <div class="card pad" style="margin-bottom:16px">
    <div class="small" style="line-height:1.9">
      <b>二十年一條線。</b>2005、2009 年只是題面出現書名；2014 年考一句詩對一個人；2017 年進入文學類文本末題與微寫作；
      2020 年以來，名著閱讀更重視材料分析與全書聯繫，具體題型、設問和分值以各年題面為準。
      備考要兼顧<b class="zhu">材料細讀與全書情節印證</b>；先看題幹要求，再決定使用哪些證據，不能預設每題都有相同的兩問結構。
    </div>
  </div>
  <div class="filters">
    ${[['all', '全部'], ['core', '名著閱讀（核心）'], ['micro', '微寫作'], ['edge', '外圍']].map(([k, t]) =>
    `<a class="chip ${f === k ? 'on' : ''}" href="#/exam?tier=${k}">${t}</a>`).join('')}
  </div>
  <div id="exam-list">${items.map(it => examCardHTML(it, false)).join('')}</div>`;
  bindExam(view, exams);
}

function bindExam(root, exams) {
  $$('.exam-head', root).forEach(h => h.onclick = () => {
    const art = h.parentElement;
    const it = exams.items.find(x => x.id === h.dataset.id);
    const isOpen = !!$('.exam-body', art);
    if (isOpen) { $('.exam-body', art).remove(); $('.exam-toggle', h).textContent = '展開 ▾'; }
    else {
      art.insertAdjacentHTML('beforeend', examBodyHTML(it));
      $('.exam-toggle', h).textContent = '收合 ▴';
      bindExamBody(art, it);
    }
  });
  $$('.exam-item', root).forEach(art => {
    const it = exams.items.find(x => 'ex-' + x.id === art.id);
    if (it && $('.exam-body', art)) bindExamBody(art, it);
  });
}
function bindExamBody(art, it) {
  const ta = $('textarea[data-ans]', art);
  if (ta) ta.oninput = () => store.set(ta.dataset.ans, ta.value);
  const btn = $('[data-ai-exam]', art);
  if (btn) btn.onclick = () => { openAI(); askExam(it, ta ? ta.value : ''); };
}

/* =============================================================
   人物
   ============================================================= */
async function viewPeople(view, r) {
  const renderId = state.renderId;
  const [people, exams, poems, research] = await Promise.all([D.people(), D.exams(), D.poems(), D.research()]);
  if (renderId !== state.renderId) return;
  const name = r.seg[1] ? decodeURIComponent(r.seg[1]) : null;

  if (name) {
    const p = people.items.find(x => x.name === name);
    if (!p) { view.innerHTML = '<p class="muted">查無此人。<a href="#/people">回人物列表</a></p>'; return; }
    view.className = 'wrap narrow';
    const max = Math.max(...p.dist, 1);
    view.innerHTML = `
    <div class="page-head"><a class="small" href="#/people">← 全部人物</a></div>
    <div class="card pad" style="margin-bottom:14px">
      <div class="person-head">
        <h1>${esc(p.name)}</h1>
        <span class="chip">${esc(p.group)}</span>
        ${p.aliases.length ? `<span class="muted small">又稱 ${p.aliases.map(esc).join('、')}</span>` : ''}
      </div>
      <p style="margin:10px 0 0;font-size:15px">${esc(p.tagline)}</p>
      <div class="filters" style="margin-top:12px">
        <a class="chip qing" href="#/read/${p.firstChapter}">導讀 ${chLabel(p.firstChapter)}</a>
        <span class="chip">名稱匹配 ${p.mentions} 次</span>
        ${p.peakChapters.slice(0, 4).map(c => `<a class="chip" href="#/read/${c}">重場 ${chLabel(c)}</a>`).join('')}
      </div>
      <div style="margin-top:14px">
        <div class="tiny muted" style="margin-bottom:4px">名稱在正文的匹配分布（第 1 – 120 回）</div>
        <div class="spark" style="height:40px">${p.dist.map((v, i) =>
      `<i style="height:${Math.max(1, v / max * 100)}%" title="${chLabel(i + 1)}：${v}"></i>`).join('')}</div>
      </div>
    </div>

    ${p.poems.length ? `<div class="card pad" style="margin-bottom:14px">
      <h3 style="font-size:17px">判詞與曲</h3>
      ${p.poems.map(id => {
        const q = poems.items.find(x => x.id === id);
        if (!q) return '';
        return `<div style="margin-top:12px">
          <div class="small" style="color:var(--zhu)">${esc(q.title)}</div>
          <div class="lines" style="font-family:var(--serif);font-size:16px;line-height:2;white-space:pre-line;margin:6px 0">${esc(q.lines.join('\n'))}</div>
          ${q.explanation ? `<p class="small muted" style="margin:0">${esc(q.explanation.slice(0, 160))}${q.explanation.length > 160 ? '…' : ''} <a href="#/poems?q=${encodeURIComponent(q.title)}">全文</a></p>` : ''}
          ${q.qualityNote ? `<p class="tiny muted">${esc(q.qualityNote)}</p>` : ''}
        </div>`;
      }).join('')}
    </div>` : ''}

    <div class="card pad" style="margin-bottom:14px">
      <h3 style="font-size:17px">形象要點</h3>
      <ul class="bullet" style="margin-top:10px">${p.traits.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    </div>

    <div class="card pad" style="margin-bottom:14px">
      <h3 style="font-size:17px">關鍵情節</h3>
      <p class="tiny muted" style="margin:4px 0 10px">依題目要求選擇情節並回讀原文，說清言行如何支持判斷，不機械套用例子。</p>
      ${p.keyScenes.map(s => `<div class="scene"><a class="ch" href="#/read/${s.ch}">${chLabel(s.ch)}</a><span>${esc(s.text)}</span></div>`).join('')}
    </div>

    <div class="card pad" style="margin-bottom:14px">
      <h3 style="font-size:17px">易錯與常考角度</h3>
      <ul class="bullet" style="margin-top:10px">${p.pitfalls.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    </div>

    ${researchLinks(research, 'people', p.name)}
    ${p.examIds.length ? `<div class="card pad">
      <h3 style="font-size:17px">關聯真題</h3>
      <ul class="bullet" style="margin-top:10px">${p.examIds.map(id => {
      const it = exams.items.find(x => x.id === id);
      return it ? `<li><a href="#/exam/${it.id}">${it.year} 年北京卷 · ${esc(it.topic)}</a><span class="muted tiny">（${TIER_LABEL[it.tier]}${it.score ? '，' + it.score + ' 分' : ''}）</span></li>` : '';
    }).join('')}</ul>
    </div>` : ''}
    <p style="margin-top:16px"><button class="btn" id="ai-person">請 AI 就這個人物出一道模擬題</button></p>`;
    $('#ai-person').onclick = () => { openAI(); askPerson(p); };
    window.scrollTo({ top: 0 });
    return;
  }

  const groups = people.groups.filter(g => people.items.some(p => p.group === g));
  view.innerHTML = `
  <div class="page-head">
    <h1>人物分析</h1>
    <p>44 位人物：判詞歸屬、形象要點、可直接引用的關鍵情節（含回目）、易錯點，以及該人物對應哪一年的北京卷真題。柱狀圖按姓名與別名在正文的字面匹配統計，供定位閱讀；共用稱謂或同名詞可能誤計，不等於實際出場次數。</p>
  </div>
  ${groups.map(g => `
    <h2 style="font-size:18px;margin:22px 0 10px;letter-spacing:.06em">${esc(g)}</h2>
    <div class="people-grid">
      ${people.items.filter(p => p.group === g).map(p => {
    const max = Math.max(...p.dist, 1);
    return `<a class="p-card" href="#/people/${encodeURIComponent(p.name)}">
          <h3>${esc(p.name)}${p.examIds.length ? `<span class="chip gold" style="margin-left:7px;font-size:11px">真題 ${p.examIds.length}</span>` : ''}</h3>
          <div class="tl">${esc(p.tagline)}</div>
          <div class="spark">${p.dist.map(v => `<i style="height:${Math.max(1, v / max * 100)}%"></i>`).join('')}</div>
        </a>`;
  }).join('')}
    </div>`).join('')}`;
}

/* =============================================================
   詩詞
   ============================================================= */
async function viewPoems(view, r) {
  const renderId = state.renderId;
  const [poems, chs, people] = await Promise.all([D.poems(), D.chapters(), D.people()]);
  if (renderId !== state.renderId) return;
  state.peopleNames = new Set(people.items.map(x => x.name));
  const kind = (r.q.get('kind') || 'all').replace('判詞', '判词');
  const q = (r.q.get('q') || '').trim();
  const kinds = ['判词', '红楼梦十二支曲', '诗词', '对联匾额', '灯谜谶语', '诔赋', '歌谣曲词'];
  let items = poems.items.filter(p => kind === 'all' || p.kind === kind);
  if (q) items = items.filter(p => p.title.includes(q) || p.lines.join('').includes(q)
    || [p.explanation, p.annotations, p.appreciation].some(t => (t || '').includes(q)) || p.people.some(n => n.includes(q)));

  view.innerHTML = `
  <div class="page-head">
    <h1>詩詞與判詞</h1>
    <p>現收 ${poems.items.length} 篇詩詞曲賦、判詞、對聯與燈謎，附原註與鑑賞，並標明所在回目與歸屬人物。
      第五回的判詞與《紅樓夢》十二支曲是全書的「壓縮檔案」，也是北京卷 2020 年真題的直接出處。</p>
  </div>
  ${kind === '判词' ? `<p class="plan-note">${esc(poems.meta.verdictNote)}</p><p class="small"><a href="#/research/method-8">怎樣讀判詞：圖像、字詞、人物與後文互證</a></p>` : ''}
  <div class="filters">
    <a class="chip ${kind === 'all' ? 'on' : ''}" href="#/poems">全部 ${poems.items.length}</a>
    ${kinds.map(k => {
    const n = poems.items.filter(p => p.kind === k).length;
    return n ? `<a class="chip ${kind === k ? 'on' : ''}" href="#/poems?kind=${encodeURIComponent(k)}">${esc(k)} ${n}</a>` : '';
  }).join('')}
  </div>
  <div class="card pad" style="margin-bottom:16px">
    <input class="toc-search" id="pq" type="search" aria-label="搜尋詩詞與判詞" placeholder="搜詩題、詩句、人物或註解…" value="${esc(q)}" />
  </div>
  <div>${items.length ? items.map(p => `
    <article class="card poem-item">
      <h3>${esc(p.title)}${p.kind === '判词' ? ' · ' + p.people.map(esc).join('、') : ''}</h3>
      <div class="filters" style="margin:6px 0 0">
        <span class="chip">${esc(p.kind)}</span>
        ${p.chapters.map(c => `<a class="chip qing" href="#/read/${c}">${chLabel(c)}</a>`).join('')}
        ${p.people.map(n => state.peopleNames && state.peopleNames.has(n)
          ? `<a class="chip gold" href="#/people/${encodeURIComponent(n)}">${esc(n)}</a>`
          : `<span class="chip gold">${esc(n)}</span>`).join('')}
      </div>
      ${p.lines.length ? `<div class="lines">${esc(p.lines.join('\n'))}</div>` : ''}
      ${p.painting ? `<p class="note"><b>【畫面】</b>${esc(p.painting)}</p>` : ''}
      ${p.text ? `<details class="anno"><summary>原資料全文</summary><p class="note">${esc(p.text)}</p></details>` : ''}
      ${p.explanation ? `<p class="note"><b>【說明】</b>${esc(p.explanation)}</p>` : ''}
      ${p.appreciation ? `<details class="anno"><summary>鑑賞</summary><p class="note">${esc(p.appreciation)}</p></details>` : ''}
      ${p.sourceNote ? `<p class="note">${esc(p.sourceNote)}</p>` : ''}
      ${p.qualityNote ? `<p class="tiny muted">${esc(p.qualityNote)}</p>` : ''}
      ${p.source && /^https?:\/\//.test(p.source) ? `<p class="tiny"><a href="${esc(p.source)}" target="_blank" rel="noopener noreferrer">詩詞來源</a></p>` : ''}
      ${p.annotations ? `<details class="anno"><summary>註釋</summary><p class="note">${esc(p.annotations)}</p></details>` : ''}
    </article>`).join('') : '<p class="muted">沒有符合的詩詞。</p>'}</div>`;

  const pq = $('#pq');
  pq.onkeydown = (e) => { if (e.key === 'Enter') location.hash = '#/poems?' + (kind !== 'all' ? 'kind=' + encodeURIComponent(kind) + '&' : '') + 'q=' + encodeURIComponent(pq.value.trim()); };
}

/* =============================================================
   進度
   ============================================================= */
async function viewPlan(view, r) {
  const renderId = state.renderId;
  const [plans, chs] = await Promise.all([D.plans(), D.chapters()]);
  if (renderId !== state.renderId) return;
  state.chapters = chs;
  const ps = planState();
  const pid = r.q.get('pace') || ps.paceId || 'steady60';
  const plan = plans.plans.find(p => p.id === pid) || plans.plans[1];
  const dayNo = ps.paceId === plan.id ? planDayNumber(ps) : null;
  const doneKey = 'hlm_plan_done_' + plan.id;
  const doneDays = new Set(store.get(doneKey, []));

  view.innerHTML = `
  <div class="page-head">
    <h1>每日進度建議</h1>
    <p>三種節奏，任選其一。每天的任務由回目自動排定：讀哪幾回、想什麼、誦哪幾首詩、練哪一道真題，
      再加一條固定動作——寫三行筆記。每七天有一次回顧，重要節點附有停頓建議。</p>
  </div>

  <div class="grid g3" style="margin-bottom:18px">
    ${plans.plans.map(p => `
      <div class="card pad ${p.id === plan.id ? '' : ''}" style="${p.id === plan.id ? 'border-color:var(--zhu)' : ''}">
        <h3 style="font-size:17px">${esc(p.name)}</h3>
        <p class="small muted" style="margin:6px 0 12px;min-height:3.4em">${esc(p.desc)}</p>
        <a class="btn ${p.id === plan.id ? 'primary' : ''}" href="#/plan?pace=${p.id}">查看</a>
        <button class="btn" data-start="${p.id}">${ps.paceId === p.id ? '重設起始日' : '選這個'}</button>
      </div>`).join('')}
  </div>

  <div class="card pad" style="margin-bottom:16px">
    ${ps.paceId === plan.id && ps.start
      ? `<div class="small">起始日 <b>${esc(ps.start)}</b>　·　今天是第 <b class="zhu">${dayNo}</b> 天　·　已完成 <b>${doneDays.size}</b> / ${plan.total} 天
         <button class="btn" style="margin-left:10px" id="reset-plan">重新開始</button></div>`
      : `<div class="small muted">尚未把這個節奏設為進行中的計畫。點上方「選這個」即可從今天算起。</div>`}
  </div>

  <div class="card pad">
    ${plan.days.map(d => `
      <div class="plan-day ${dayNo === d.d ? 'today' : ''} ${doneDays.has(d.d) ? 'done' : ''}" data-d="${d.d}">
        <div class="dn">${d.d}</div>
        <div>
          <h4>${d.chapters.map(chLabel).join('、')}　<span class="muted" style="font-weight:400">${esc(d.titles.join(' ／ '))}</span></h4>
          <ul>${d.tasks.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
          ${d.note ? `<p class="plan-note">◆ ${esc(d.note)}</p>` : ''}
          ${d.weekly ? `<p class="plan-note">◇ 週回顧：${esc(d.weekly)}</p>` : ''}
          <p style="margin:8px 0 0">
            <a class="chip qing" href="#/read/${d.chapters[0]}">開始讀</a>
            <button class="chip ${doneDays.has(d.d) ? 'on' : ''}" data-done="${d.d}">${doneDays.has(d.d) ? '✓ 完成' : '標記完成'}</button>
          </p>
        </div>
      </div>`).join('')}
  </div>`;

  $$('[data-start]', view).forEach(b => b.onclick = () => {
    store.set('hlm_plan', { paceId: b.dataset.start, start: localDate() });
    location.hash = '#/plan?pace=' + b.dataset.start;
    render();
  });
  const rp = $('#reset-plan');
  if (rp) rp.onclick = () => { store.set('hlm_plan', { paceId: plan.id, start: localDate() }); render(); };
  $$('[data-done]', view).forEach(b => b.onclick = () => {
    const d = +b.dataset.done;
    if (doneDays.has(d)) doneDays.delete(d); else doneDays.add(d);
    store.set(doneKey, [...doneDays]);
    b.classList.toggle('on', doneDays.has(d));
    b.textContent = doneDays.has(d) ? '✓ 完成' : '標記完成';
    b.closest('.plan-day').classList.toggle('done', doneDays.has(d));
  });
  const t = $('.plan-day.today', view);
  if (t) t.scrollIntoView({ block: 'center' });
}

/* =============================================================
   讀法
   ============================================================= */
async function viewMethod(view) {
  const renderId = state.renderId;
  const [m, research] = await Promise.all([D.method(), D.research()]);
  if (renderId !== state.renderId) return;
  view.className = 'wrap narrow';
  view.innerHTML = `
  <div class="page-head"><h1>${esc(m.meta.title)}</h1><p>${esc(m.meta.lead)}</p></div>
  ${m.sections.map(s => `
    <section class="method-sec">
      <h2>${esc(s.title)}</h2>
      ${s.blocks.map(b => `<div class="card pad method-block">
        ${b.h ? `<h4>${esc(b.h)}</h4>` : ''}
        <p>${esc(b.p)}</p>
      </div>`).join('')}
    </section>`).join('')}
  <div class="card pad">
    <h3 style="font-size:17px">論文導讀：十項閱讀自查</h3>
    <p class="small muted">依漆永祥「十宜十忌」整理，逐項附論文頁碼、閱讀任務與自查問題。</p>
    ${research.items.filter(x => x.sourceId === 'qi-method-2025').map(x => `<p class="small"><a href="#/research/${x.id}">${esc(x.title)}</a></p>`).join('')}
    <p><a class="btn" href="#/research">閱讀兩篇論文的全部考點卡</a></p>
    <h3 style="font-size:17px">接下來</h3>
    <p class="small muted" style="margin:8px 0 12px">方法要落到具體的一天上才有用。</p>
    <a class="btn primary" href="#/plan">挑一個進度計畫</a>
    <a class="btn" href="#/exam">看歷年真題怎麼考</a>
  </div>`;
}

/* =============================================================
   搜尋
   ============================================================= */
function hl(text, q) {
  const i = text.indexOf(q);
  if (i < 0) return esc(text.slice(0, 90));
  const a = Math.max(0, i - 32);
  return (a ? '…' : '') + esc(text.slice(a, i)) + '<mark>' + esc(q) + '</mark>' + esc(text.slice(i + q.length, i + q.length + 60)) + '…';
}

async function viewSearch(view, r) {
  const renderId = state.renderId;
  const q = (r.q.get('q') || '').trim();
  const withText = r.q.get('t') === '1';
  view.className = 'wrap narrow';
  view.innerHTML = `
  <div class="page-head"><h1>搜尋</h1></div>
  <div class="card pad" style="margin-bottom:16px">
    <input class="toc-search" id="sq" type="search" placeholder="搜回目、真題、人物、詩詞…" value="${esc(q)}" autofocus />
    <p class="tiny muted" style="margin:8px 0 0">按 Enter 搜尋。${q ? `<a href="#/search?q=${encodeURIComponent(q)}&t=${withText ? '0' : '1'}">${withText ? '不搜正文（較快）' : '同時搜一百二十回正文（約 2.5MB）'}</a>` : ''}</p>
  </div>
  <div id="sr">${q ? '<div class="skel"></div><div class="skel"></div>' : '<p class="muted small">輸入關鍵詞開始。</p>'}</div>`;

  const sq = $('#sq');
  sq.onkeydown = (e) => { if (e.key === 'Enter' && sq.value.trim()) location.hash = '#/search?q=' + encodeURIComponent(sq.value.trim()) + (withText ? '&t=1' : ''); };
  if (!q) return;

  const [chs, exams, people, poems, research] = await Promise.all([D.chapters(), D.exams(), D.people(), D.poems(), D.research()]);
  if (renderId !== state.renderId) return;
  const out = [];
  chs.items.forEach(c => {
    const s = c.title + ' ' + (c.focus || '');
    if (s.includes(q)) out.push(`<a class="card hit" href="#/read/${c.n}"><div class="where">回目 · ${chLabel(c.n)}</div><div class="txt">${hl(s, q)}</div></a>`);
  });
  people.items.forEach(p => {
    const s = [p.name, p.tagline, p.aliases.join('、'), p.traits.join(' '), p.keyScenes.map(x => x.text).join(' ')].join(' ');
    if (s.includes(q)) out.push(`<a class="card hit" href="#/people/${encodeURIComponent(p.name)}"><div class="where">人物 · ${esc(p.name)}</div><div class="txt">${hl(s, q)}</div></a>`);
  });
  exams.items.forEach(it => {
    const s = [it.topic, it.stem, it.answer, it.analysis, it.material ? it.material.text : ''].join(' ');
    if (s.includes(q)) out.push(`<a class="card hit" href="#/exam/${it.id}"><div class="where">真題 · ${it.year} 年北京卷</div><div class="txt">${hl(s, q)}</div></a>`);
  });
  poems.items.forEach(p => {
    const s = [p.title, p.lines.join(''), p.explanation || '', p.text || ''].join(' ');
    if (s.includes(q)) out.push(`<a class="card hit" href="#/poems?q=${encodeURIComponent(p.title)}"><div class="where">詩詞 · ${esc(p.title)}</div><div class="txt">${hl(s, q)}</div></a>`);
  });

  research.items.forEach(it => {
    const text = [it.title, it.summary, it.task, it.question].join(' ');
    if (text.includes(q)) out.push(`<a class="card hit" href="#/research/${it.id}"><div class="where">論文導讀 · ${esc(it.title)}</div><div class="txt">${hl(text, q)}</div></a>`);
  });

  if (withText) {
    const full = await D.full();
    if (renderId !== state.renderId) return;
    full.chapters.forEach((c, i) => {
      const t = c.content;
      let from = 0, hits = 0;
      while (hits < 3) {
        const k = t.indexOf(q, from);
        if (k < 0) break;
        out.push(`<a class="card hit" href="#/read/${i + 1}"><div class="where">正文 · ${chLabel(i + 1)} ${esc(c.title)}</div><div class="txt">${hl(t.slice(Math.max(0, k - 40)), q)}</div></a>`);
        from = k + q.length; hits++;
      }
    });
  }

  $('#sr').innerHTML = out.length
    ? `<p class="small muted">共 ${out.length} 條${withText ? '（含正文）' : ''}</p>` + out.join('')
    : `<p class="muted">沒有找到「${esc(q)}」。${withText ? '' : `試試 <a href="#/search?q=${encodeURIComponent(q)}&t=1">同時搜正文</a>。`}`;
}

/* ---------------- 論文導讀：與真題答案分層 ---------------- */
function researchLinks(research, key, value) {
  const items = (research?.items || []).filter(x => (x[key] || []).includes(value));
  if (!items.length) return '';
  return `<section class="card pad research-links" style="margin:14px 0"><h3>論文延伸與練習</h3>
    <p class="tiny muted">學術觀點與本站練習，非真題答案。</p>
    <ul class="bullet">${items.map(x => `<li><a href="#/research/${x.id}">${esc(x.title)}</a></li>`).join('')}</ul></section>`;
}

async function viewResearch(view, r) {
  const renderId = state.renderId;
  const research = await D.research();
  if (renderId !== state.renderId) return;
  const items = r.seg[1] ? research.items.filter(x => x.id === r.seg[1]) : research.items;
  view.className = 'wrap narrow';
  view.innerHTML = `<div class="page-head"><h1>${esc(research.meta.title)}</h1><p>${esc(research.meta.note)}</p></div>
    <p><a href="#/method">← 日常讀法</a> · <a href="#/research">全部 ${research.items.length} 張考點卡</a></p>
    ${items.length ? items.map(x => {
      const source = research.sources.find(s => s.id === x.sourceId);
      return `<article class="card pad research-item" style="margin:16px 0">
        <h2>${esc(x.title)}</h2>
        <p class="tiny muted">${esc(source.author)}〈${esc(source.title)}〉，${esc(source.publication)}，第 ${esc(x.pages)} 頁。</p>
        <p><b>論文觀點（轉述）</b></p><p>${esc(x.summary)}</p>
        <p><b>回到原著</b></p><p>${esc(x.task)}</p>
        <div class="filters">${x.chapters.map(n => `<a class="chip qing" href="#/read/${n}">${chLabel(n)}</a>`).join('')}
          ${x.people.map(n => `<a class="chip" href="#/people/${encodeURIComponent(n)}">${esc(n)}</a>`).join('')}</div>
        <details class="anno"><summary>本站練習與自查（非高考原題）</summary>
          <p>${esc(x.question)}</p><ul class="bullet">${x.checks.map(c => `<li>${esc(c)}</li>`).join('')}</ul></details>
        ${x.caveat ? `<p class="plan-note">使用限度：${esc(x.caveat)}</p>` : ''}
        ${x.examIds.length ? `<p class="small">可遷移到：${x.examIds.map(id => `<a href="#/exam/${id}">${esc(id.replace('bj', '北京卷 '))}</a>`).join(' · ')}（依各題要求選用）</p>` : ''}
      </article>`;
    }).join('') : '<p class="muted">找不到這張考點卡。</p>'}
    <section class="card pad"><h2>論文來源</h2>${research.sources.map(s => `<p class="small">${esc(s.author)}：〈${esc(s.title)}〉，${esc(s.publication)}，第 ${esc(s.pages)} 頁。${s.doi ? ` DOI：<a href="https://doi.org/${esc(s.doi)}">${esc(s.doi)}</a>` : ''}</p>`).join('')}
    <p class="tiny muted">引用按原刊頁碼標註。本站提供教學轉述；原文、作者推論與練習請分開使用。</p></section>`;
}

/* =============================================================
   AI 助讀
   ============================================================= */
let aiBusy = false;
const aiLog = () => $('#ai-log');
function openAI() { $('#ai-panel').classList.add('open'); $('#scrim').classList.add('on'); }
function closeAI() { $('#ai-panel').classList.remove('open'); $('#scrim').classList.remove('on'); }

function bubble(role, html) {
  const d = document.createElement('div');
  d.className = 'bubble ' + (role === 'me' ? 'me' : 'ai');
  d.innerHTML = html;
  aiLog().appendChild(d);
  aiLog().scrollTop = aiLog().scrollHeight;
  return d;
}
function md(t) {
  let e = esc(String(t || '').trim());
  e = e.replace(/^###\s+(.*)$/gm, '<h4>$1</h4>')
    .replace(/^##\s+(.*)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  e = e.replace(/(?:^[-*]\s+.*(?:\n|$))+/gm, m =>
    '<ul>' + m.trim().split('\n').map(l => '<li>' + l.replace(/^[-*]\s+/, '') + '</li>').join('') + '</ul>');
  return e.split(/\n{2,}/).map(b => /^<(h\d|ul|ol)/.test(b) ? b : '<p>' + b.replace(/\n/g, '<br>') + '</p>').join('');
}

async function callAI(prompt) {
  const res = await fetch('https://ai.bdfz.net/', {
    signal: AbortSignal.timeout(25000),
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const raw = await res.text();
  if (!res.ok) { const error = new Error('AI 服務暫時無法回應（HTTP ' + res.status + '）'); error.status = res.status; throw error; }
  let j;
  try { j = JSON.parse(raw); } catch (e) { throw new Error('回應格式異常'); }
  const a = typeof j?.answer === 'string' ? j.answer.trim() : '';
  if (!a) throw new Error('空回應');
  return a;
}

async function ask(prompt, label) {
  if (aiBusy) return;
  aiBusy = true;
  $('#ai-send').disabled = true;
  const b = bubble('ai', '<p class="muted">' + esc(label || '想一想…') + '</p>');
  try {
    let answer;
    try {
      answer = await callAI(prompt);
    } catch (first) {
      if (!(first.status === 429 || first.status >= 500 || ['TypeError', 'TimeoutError', 'AbortError'].includes(first.name))) throw first;
      console.warn('[hlm] AI retry', first.status || first.name);
      b.innerHTML = '<p class="muted">再試一次…</p>';
      answer = await callAI(prompt);
    }
    b.innerHTML = md(answer);
    try { archive(prompt, answer); } catch (_) { /* 回答成功不受歸檔失敗影響 */ }
  } catch (e) {
    console.error('[hlm] AI failed', e.status || e.name);
    b.innerHTML = '<p>這次沒答上來，上游暫時不可用。</p>'
      + '<p><button class="btn" data-retry="1">重試</button></p>';
    const r = b.querySelector('[data-retry]');
    if (r) r.onclick = () => { b.remove(); ask(prompt, label); };
  } finally {
    aiBusy = false;
    $('#ai-send').disabled = false;
    aiLog().scrollTop = aiLog().scrollHeight;
  }
}

let sessionKey = '';
const convo = [];
function archive(q, a) {
  convo.push({ role: 'user', content: q.slice(0, 400) }, { role: 'assistant', content: a });
  if (!sessionKey) sessionKey = identity()?.createSessionKey?.(SITE_KEY + '-chat') || SITE_KEY + '-' + Date.now().toString(36);
  identity()?.recordConversation?.({
    siteKey: SITE_KEY, sessionKey, title: '紅樓夢助讀',
    summary: (a || '').slice(0, 120), sourceUrl: location.href,
    messages: convo.slice(-16).map((m, i) => ({ id: String(i + 1), role: m.role, content: m.content })),
    meta: { route: location.hash },
  })?.catch?.(() => { });
}

const BASE = '你是一位既熟讀《紅樓夢》原著、又長期研究北京市高考語文命題的教師。回答用繁體中文，樸實準確，引原著時要說出回目，不編造情節與引文。若涉及後四十回，須說明那是通行本續書部分。依原著情節提出可核對的理由，不把人物簡化成善惡標籤，不臆測諧音密碼或佚稿結局。區分原文事實、論文作者觀點與本站推論；學術解讀不是官方評分標準。';

function askChapter(n, title) {
  if (aiBusy) return;
  $('#ai-title').textContent = chLabel(n) + ' 助讀';
  bubble('me', esc('請解讀 ' + chLabel(n) + '「' + title + '」'));
  ask(`${BASE}
請解讀《紅樓夢》${chLabel(n)}「${title}」，依序回答四點，總長不超過 900 字：
一、本回梗概（3 句以內），以及它在全書結構中的位置。
二、本回出場的 3–4 位人物各自的表現與心理，指出誰的處境或態度發生了變化。
三、本回的敘事技巧：伏筆、對照、讖語或細節見人，各舉一例。
四、若北京卷要用本回出題，最可能怎麼問？給一道兩問的模擬題並附答案要點。`, '正在讀這一回…');
}

function askExam(it, myAnswer) {
  if (aiBusy) return;
  $('#ai-title').textContent = it.year + ' 年真題批改';
  bubble('me', esc(myAnswer ? '請批改我的作答' : '請講講這道題'));
  ask(`${BASE}
以下是 ${it.year} 年北京卷《紅樓夢》試題。
${it.material ? '【材料】' + it.material.source + '\n' + it.material.text + '\n' : ''}
【題目】${it.stem}
【參考答案】${it.answer}
【答案來源與使用限度】${it.answerSource || '本站參考'}${it.authorityNote ? '\n' + it.authorityNote : ''}
請按上述來源表述答案權威性，不把本站分析或估分說成官方評分。

${myAnswer ? `【學生作答】\n${myAnswer}\n\n請按北京卷評分習慣批改：先按得分點逐條說明拿到了哪些、漏了哪些，再給一個估分（滿分 ${it.score} 分），最後給出兩條具體的修改建議。不要重寫整份答案。`
      : `請講解這道題：命題意圖是什麼、答題應分哪幾步、最常見的失分點是什麼。不超過 600 字。`}`,
    myAnswer ? '正在批改…' : '正在講解…');
}

function askPerson(p) {
  if (aiBusy) return;
  $('#ai-title').textContent = p.name + ' · 模擬命題';
  bubble('me', esc('就「' + p.name + '」出一道模擬題'));
  ask(`${BASE}
請仿照北京卷近年的名著閱讀題型（給一段原著材料 ＋ 兩問，共 10 分），就《紅樓夢》人物「${p.name}」命一道模擬題。
要求：
1. 材料須註明回目，內容必須是原著確有的情節（若你不能確定原文字句，就用準確的情節概述代替，並註明是概述）。
2. 第一問就材料分析人物，第二問要求結合原著其他情節印證。
3. 附答案要點與評分說明。`, '正在命題…');
}

function updateAIContext() {
  const quick = $('#ai-quick');
  const r = state.route || { seg: [] };
  let items = [];
  if (r.seg[0] === 'read' && r.seg[1]) {
    const n = +r.seg[1];
    items = [['本回考點', `${BASE}\n《紅樓夢》${chLabel(n)}若入北京卷，可能考哪些角度？列 3 條，每條說明問法與答題要點。`],
    ['本回人物', `${BASE}\n《紅樓夢》${chLabel(n)}中主要人物各自的表現與性格體現，分點說明，每人不超過 80 字。`]];
    $('#ai-title').textContent = chLabel(n) + ' 助讀';
  } else if (r.seg[0] === 'exam') {
    items = [['近年命題趨勢', `${BASE}\n北京卷《紅樓夢》名著閱讀題 2020—2026 年的命題結構與趨勢是什麼？考生應如何準備？不超過 600 字。`]];
    $('#ai-title').textContent = '真題助讀';
  } else {
    items = [['從哪讀起', `${BASE}\n一個高中生第一次讀《紅樓夢》，前五回讀不下去，該怎麼辦？給具體可執行的建議，不超過 500 字。`],
    ['判詞速記', `${BASE}\n請把《紅樓夢》第五回金陵十二釵正冊判詞逐首列出，正冊共十一首，釵黛合判；每首後面點明所指人物，用後文情節印證，並標出仍有爭議之處。`]];
    $('#ai-title').textContent = '問一問';
  }
  quick.innerHTML = items.map((x, i) => `<button class="chip" data-q="${i}">${esc(x[0])}</button>`).join('');
  $$('[data-q]', quick).forEach(b => b.onclick = () => {
    if (aiBusy) return;
    const [label, prompt] = items[+b.dataset.q];
    bubble('me', esc(label));
    ask(prompt, '想一想…');
  });
}

/* =============================================================
   啟動
   ============================================================= */
function boot() {
  applyPrefs();
  window.HLMAppearance.bind();
  $('#btn-theme').onclick = window.HLMAppearance.open;
  $('#btn-search').onclick = () => { location.hash = '#/search'; };
  $('#ai-fab').onclick = openAI;
  $('#ai-close').onclick = closeAI;
  $('#scrim').onclick = closeAI;
  $('#ai-clear').onclick = () => { if (aiBusy) return; aiLog().innerHTML = ''; convo.length = 0; sessionKey = ''; };
  const send = () => {
    if (aiBusy) return;
    const v = $('#ai-input').value.trim();
    if (!v) return;
    $('#ai-input').value = '';
    bubble('me', esc(v));
    const r = state.route || { seg: [] };
    const ctx = r.seg[0] === 'read' && r.seg[1] ? `（讀者目前在讀${chLabel(+r.seg[1])}）` : '';
    ask(`${BASE}\n${ctx}讀者的問題：${v}`, '想一想…');
  };
  $('#ai-send').onclick = send;
  $('#ai-input').onkeydown = (e) => { if (e.key === 'Enter') send(); };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAI();
    if (e.target.matches('input,textarea')) return;
    if (e.key === '/') { e.preventDefault(); location.hash = '#/search'; }
    const r = state.route || { seg: [] };
    if (r.seg[0] === 'read' && r.seg[1]) {
      const n = +r.seg[1];
      if (e.key === 'ArrowLeft' && n > 1) location.hash = '#/read/' + (n - 1);
      if (e.key === 'ArrowRight' && n < 120) location.hash = '#/read/' + (n + 1);
    }
  });

  D.people().then(p => { state.peopleNames = new Set(p.items.map(x => x.name)); }).catch(() => { });
  identity()?.mount?.({ siteKey: SITE_KEY });
  window.addEventListener('hashchange', render);
  render().then(hydrateProgress);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
