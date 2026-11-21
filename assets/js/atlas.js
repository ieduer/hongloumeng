/* 圖譜：全書脈絡、人物命運、關係網、賈府世系、地圖、時序、研究前沿。
 * Data: data/study/atlas.json (scripts/build_atlas.py). Every authored event carries a verbatim source
 * string (`ev`) checked against the chapter at build time; this module only draws. Plain SVG, no library. */
(function () {
'use strict';

const NAME_T = {
  '贾宝玉': '賈寶玉', '林黛玉': '林黛玉', '薛宝钗': '薛寶釵', '王熙凤': '王熙鳳', '贾母': '賈母', '史湘云': '史湘雲',
  '贾探春': '賈探春', '贾元春': '賈元春', '贾迎春': '賈迎春', '贾惜春': '賈惜春', '妙玉': '妙玉', '李纨': '李紈',
  '秦可卿': '秦可卿', '巧姐': '巧姐', '香菱': '香菱', '晴雯': '晴雯', '袭人': '襲人', '平儿': '平兒', '鸳鸯': '鴛鴦',
  '紫鹃': '紫鵑', '刘姥姥': '劉姥姥', '贾政': '賈政', '王夫人': '王夫人', '贾赦': '賈赦', '邢夫人': '邢夫人',
  '贾琏': '賈璉', '贾珍': '賈珍', '薛姨妈': '薛姨媽', '薛蟠': '薛蟠', '赵姨娘': '趙姨娘', '贾环': '賈環',
  '贾雨村': '賈雨村', '甄士隐': '甄士隱', '尤三姐': '尤三姐', '尤二姐': '尤二姐', '柳湘莲': '柳湘蓮', '秦钟': '秦鐘',
  '贾瑞': '賈瑞', '薛宝琴': '薛寶琴', '小红': '小紅', '司棋': '司棋', '金钏儿': '金釧兒', '麝月': '麝月', '焦大': '焦大',
  '贾蓉': '賈蓉', '贾兰': '賈蘭', '林如海': '林如海', '尤氏': '尤氏', '莺儿': '鶯兒', '贾芸': '賈芸', '蒋玉菡': '蔣玉菡',
};
const GROUP_T = {
  '金陵十二钗正册': '金陵十二釵正冊', '金陵十二钗副册': '金陵十二釵副冊', '金陵十二钗又副册': '金陵十二釵又副冊',
  '贾府主子': '賈府主子', '仆婢': '僕婢', '外围人物': '外圍人物', '其他': '其他',
};
const GROUP_CLASS = {
  '金陵十二钗正册': 'g1', '金陵十二钗副册': 'g2', '金陵十二钗又副册': 'g2', '贾府主子': 'g3', '仆婢': 'g4', '外围人物': 'g5', '其他': 'g6',
};
const END_T = { '死': '死', '出家': '出家', '遠嫁': '遠嫁', '婚': '婚嫁', '獲罪': '獲罪', '守': '守寡／守家', '存': '存世', '劫': '遭劫', '出走': '出走' };
const nm = id => NAME_T[id] || id;
const gname = g => GROUP_T[g] || g;
let X = null; // render context from app.js: { atlas, chapters, people, poems, chLabel, esc, icon, isRead, current }
const esc = s => X.esc(s);
const ch = n => X.chLabel(n);
const ico = (n, s) => X.icon(n, s);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const personLink = id => (X.people.items.some(p => p.name === id)
  ? `<a href="#/people/${encodeURIComponent(id)}">${esc(nm(id))}</a>` : esc(nm(id)));
const quote = (n, ev) => `<q class="ev" title="底本原文，建置時已逐條比對">${esc(ev)}</q><a class="ev-ch" href="#/read/${n}">${ch(n)}</a>`;

/* ---------- geometry helpers ---------- */
function monotone(pts) {
  const n = pts.length;
  if (n < 2) return '';
  const dx = [], m = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], h = dx[i] / 3;
    d += ` C${(x0 + h).toFixed(1)},${(y0 + t[i] * h).toFixed(1)} ${(x1 - h).toFixed(1)},${(y1 - t[i + 1] * h).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}
function catmull(pts) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}
const hatch = id => `<defs><pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" class="hatch-line"/></pattern></defs>`;

/* ---------- shell ---------- */
const SECTIONS = {
  plot: ['全書脈絡', '四十七個節點串起一百二十回：盛衰走勢、節令與北京卷涉及的回目。'],
  fates: ['人物命運時間線', '三十四位人物：從登場、轉折到結局，每一點都對應原文；底色是名字在各回出現的多寡。'],
  relations: ['人物關係網', '五十多位人物、六種關係，加上從正文算出的「同段共現」。點一個人，看他和誰相連。'],
  family: ['賈府世系與四大家族', '據第二回冷子興演說：寧榮二公到第五代，配偶、庶出與四大家族的姻親。'],
  map: ['地圖', '大觀園各處院落、兩府方位，以及書中人物在運河上下的行旅。'],
  time: ['時序', '故事過了多少年？每一年佔多少回？書中明寫的月日與年齡，連同前後矛盾之處。'],
  frontier: ['研究前沿', '2022—2026 年與本圖譜相關的紅學研究與動態，附原頁連結。'],
};
function figures(section) {
  const A = X.atlas;
  const examCh = (X.chapters?.items || []).filter(c => c.exams.length).length;
  const f = {
    plot: [[120, '回'], [A.plot.nodes.length, '情節節點'], [A.parts.length, '段落'], [examCh, '回涉北京卷']],
    fates: [[A.fates.people.length, '位人物'], [A.fates.people.reduce((n, p) => n + p.events.length, 0), '個事件'], [A.fates.people.filter(p => p.omen).length, '組判詞對照']],
    relations: [[A.relations.network.nodes.length, '位人物'], [A.relations.edges.length, '條標註關係'], [A.relations.network.cooc.length, '組同段共現']],
    family: [[A.relations.family.rows.length, '代'], [A.relations.family.nodes.length, '人'], [4, '大家族']],
    map: [[A.places.garden.places.length, '處園景'], [A.places.world.places.length, '個城鎮'], [A.places.world.journeys.length, '段行旅']],
    time: [[A.chrono.years.length, '個故事年'], [A.chrono.anchors.length, '個月日錨點'], [A.chrono.ages.filter(a => a.issue).length, '處年齡矛盾']],
    frontier: [[A.frontier.items.length, '條研究與動態'], ['2022—2026', '年']],
  }[section];
  return `<dl class="atlas-figures">${f.map(([n, t]) => `<div><dt>${esc(t)}</dt><dd>${esc(String(n))}</dd></div>`).join('')}</dl>`;
}
function head(section, extra) {
  const [title, lead] = SECTIONS[section];
  const m = X.atlas.meta;
  return `<div class="page-head atlas-head"><h1>${esc(title)}</h1><p>${esc(lead)}</p>${figures(section)}${extra || ''}
    <p class="atlas-proof">${ico('checks', 14)} ${section === 'frontier' ? '條目均附原頁連結' : `事件取自底本原文；全站圖譜共 ${m.checked} 條原文建置時逐條核對`}</p></div>`;
}
function method(...notes) {
  return `<details class="atlas-method"><summary>資料與方法</summary>${notes.filter(Boolean).map(t => `<p>${esc(t)}</p>`).join('')}</details>`;
}

function render(view, route, ctx) {
  X = ctx;
  const section = SECTIONS[route.section] ? route.section : 'plot';
  const fn = { plot: viewPlot, fates: viewFates, relations: viewRelations, family: viewFamily, map: viewMap, time: viewTime, frontier: viewFrontier }[section];
  fn(view, route);
}

/* =============================================================
   全書脈絡
   ============================================================= */
const PW = 1200, PL = 40, PR = 16;
const px = n => PL + (n - 1) / 119 * (PW - PL - PR);
function plotSVG(opts) {
  const A = X.atlas, H = opts.h, top = opts.top, bottom = opts.bottom;
  const py = lv => top + (100 - lv) / 100 * (bottom - top);
  const nodes = A.plot.nodes;
  const pts = nodes.map(nd => [px(nd.ch), py(nd.lv)]);
  const curve = monotone(pts);
  const area = curve + ` L${pts[pts.length - 1][0].toFixed(1)},${bottom} L${pts[0][0].toFixed(1)},${bottom} Z`;
  let s = `<svg class="atlas-svg plot-svg" viewBox="0 0 ${PW} ${H}" role="img" aria-label="${esc(opts.label)}">${hatch(opts.id + '-h')}`;
  A.parts.forEach((p, i) => {
    const x0 = px(p.from) - (p.from > 1 ? 0.5 * (PW - PL - PR) / 119 : 0), x1 = px(p.to) + (p.to < 120 ? 0.5 * (PW - PL - PR) / 119 : 0);
    s += `<rect class="band ${i % 2 ? 'odd' : ''}" x="${x0.toFixed(1)}" y="${opts.bandTop}" width="${(x1 - x0).toFixed(1)}" height="${(bottom - opts.bandTop).toFixed(1)}"/>`;
    if (opts.partLabels) s += `<text class="part-label" x="${((x0 + x1) / 2).toFixed(1)}" y="${opts.bandTop + 15}" text-anchor="middle">${esc(p.name)}</text>`;
  });
  s += `<rect x="${px(80.5).toFixed(1)}" y="${opts.bandTop}" width="${(px(120) - px(80.5) + 6).toFixed(1)}" height="${(bottom - opts.bandTop).toFixed(1)}" fill="url(#${opts.id}-h)" class="sequel"/>`;
  if (opts.partLabels) s += `<text class="sequel-label" x="${(px(80.5) + 6).toFixed(1)}" y="${bottom - 8}">後四十回（續書）</text>`;
  s += `<path class="lv-area" d="${area}"/><path class="lv-line" d="${curve}"/>`;
  if (opts.grid) [25, 50, 75].forEach(v => { s += `<line class="grid" x1="${PL}" x2="${PW - PR}" y1="${py(v)}" y2="${py(v)}"/>`; });
  if (opts.marker) {
    const x = px(opts.marker);
    s += `<line class="here" x1="${x}" x2="${x}" y1="${opts.bandTop}" y2="${bottom}"/><circle class="here-dot" cx="${x}" cy="${lvAt(opts.marker, py)}" r="5"/>`;
  }
  if (opts.nodes) nodes.forEach((nd, i) => {
    const r = [0, 4, 5.5, 7.5][nd.w];
    s += `<g class="pnode w${nd.w}" data-i="${i}" tabindex="0" role="button" aria-label="${esc(ch(nd.ch) + ' ' + nd.t)}"><title>${esc(ch(nd.ch) + '　' + nd.t)}</title><circle cx="${pts[i][0].toFixed(1)}" cy="${pts[i][1].toFixed(1)}" r="${r}"/></g>`;
  });
  if (opts.labels) {
    // Label key nodes where they fit: try above, below, then further out; a label that cannot fit is left to the tooltip.
    const boxes = pts.map(([x, y]) => [x - 8, y - 8, x + 8, y + 8]);
    const hit = b => boxes.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
    nodes.map((nd, i) => [nd, i]).filter(([nd]) => nd.w === 3).sort((a, b) => b[0].lv - a[0].lv).forEach(([nd, i]) => {
      const label = nd.t.length > 8 ? nd.t.slice(0, 8) + '…' : nd.t, w = label.length * 13.5 + 4;
      for (const dy of [-15, 26, -32, 43, -49]) {
        const x = Math.min(PW - PR - w / 2, Math.max(PL + w / 2, pts[i][0])), y = pts[i][1] + dy;
        const b = [x - w / 2, y - 13, x + w / 2, y + 3];
        if (y < (opts.festivals ? opts.festY + 16 : top - 4) || y > bottom - 4 || hit(b)) continue;
        boxes.push(b);
        s += `<text class="pnode-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle">${esc(label)}</text>`;
        break;
      }
    });
  }
  if (opts.festivals) {
    let lastX = -99, lift = 0;
    A.plot.festivals.slice().sort((a, b) => a.ch - b.ch).forEach(f => {
      const x = px(f.ch);
      lift = x - lastX < 46 ? (lift ? 0 : 16) : 0; lastX = x;
      const y = opts.festY - lift;
      s += `<g class="fest"><title>${esc(ch(f.ch) + '　' + f.k + '：' + f.note)}</title><path d="M${x},${y - 6} l6,6 l-6,6 l-6,-6z"/><text x="${x + 9}" y="${y + 4}">${esc(f.k)}</text></g>`;
    });
  }
  if (opts.axis) {
    [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120].forEach(n => {
      s += `<line class="tick" x1="${px(n)}" x2="${px(n)}" y1="${bottom}" y2="${bottom + 5}"/><text class="tick-label" x="${px(n)}" y="${bottom + 18}" text-anchor="middle">${n}</text>`;
    });
  }
  if (opts.exams) {
    const y = bottom + 34;
    s += `<text class="row-label" x="${PL - 6}" y="${y + 8}" text-anchor="end">真題</text>`;
    X.chapters.items.forEach(c => { if (c.exams.length) s += `<rect class="exam-tick" x="${(px(c.n) - 3).toFixed(1)}" y="${y}" width="6" height="10"><title>${esc(ch(c.n))}：北京卷 ${c.exams.length} 題</title></rect>`; });
  }
  return s + '</svg>';
}
function lvAt(n, py) {
  const nodes = X.atlas.plot.nodes;
  let a = nodes[0], b = nodes[nodes.length - 1];
  for (let i = 0; i < nodes.length - 1; i++) if (nodes[i].ch <= n && nodes[i + 1].ch >= n) { a = nodes[i]; b = nodes[i + 1]; break; }
  const t = b.ch === a.ch ? 0 : (n - a.ch) / (b.ch - a.ch);
  return py(a.lv + (b.lv - a.lv) * t).toFixed(1);
}
function nodeCard(nd) {
  return `<article class="pcard" id="pn-${nd.ch}"><div class="pcard-ch"><a href="#/read/${nd.ch}">${ch(nd.ch)}${nd.to ? '—' + ch(nd.to).replace('第', '') : ''}</a>${nd.ch > 80 ? '<span class="tag seq">續書</span>' : ''}</div>
    <h3>${esc(nd.t)}</h3><p>${esc(nd.d)}</p><p class="small">原文：${quote(nd.ch, nd.ev)}</p></article>`;
}
function viewPlot(view) {
  const A = X.atlas, P = A.plot;
  view.innerHTML = head('plot') + `
    <section class="card pad atlas-card">
      <div class="legend"><span><i class="lg-line"></i>家勢（本站示意）</span><span><i class="lg-dot"></i>情節節點（大＝關鍵）</span><span><i class="lg-diamond"></i>節令</span><span><i class="lg-hatch"></i>後四十回</span><span><i class="lg-exam"></i>北京卷涉及</span></div>
      <div class="chart-scroll">${plotSVG({ id: 'plot', h: 440, top: 86, bottom: 370, bandTop: 6, partLabels: true, nodes: true, labels: true, festivals: true, festY: 54, axis: true, exams: true, grid: true, label: '全書一百二十回的家勢曲線與重要節點' })}</div>
      <div class="plot-detail" id="plot-detail" aria-live="polite"><p class="muted small">點曲線上的圓點，看該節點的情節與原文。</p></div>
    </section>
    ${method(P.meta.method, P.meta.levelNote, P.meta.authorship)}
    ${A.parts.map(p => {
      const list = P.nodes.filter(nd => nd.ch >= p.from && nd.ch <= p.to);
      return `<section class="plot-part"><h2><span>${p.from}—${p.to}</span>${esc(p.name)}</h2><p class="muted small">${esc(p.desc)}</p><div class="pcards">${list.map(nodeCard).join('')}</div></section>`;
    }).join('')}`;
  const detail = $('#plot-detail');
  const pick = i => {
    const nd = P.nodes[i];
    $$('.pnode', view).forEach(g => g.classList.toggle('on', +g.dataset.i === i));
    detail.innerHTML = nodeCard(nd).replace('class="pcard"', 'class="pcard solo"');
  };
  $$('.pnode', view).forEach(g => {
    g.addEventListener('click', () => pick(+g.dataset.i));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(+g.dataset.i); } });
  });
}

/* =============================================================
   人物命運
   ============================================================= */
const LANES = [['all', '全部'], ['十二釵', '十二釵正冊'], ['副冊', '副冊／又副冊'], ['丫鬟', '丫鬟'], ['長輩', '長輩'], ['親眷', '親眷'], ['框架', '框架人物']];
function laneOf(p) { return p.lane === '正冊' || p.lane === '主線' ? '十二釵' : p.lane === '又副冊' ? '副冊' : p.lane; }
function endShape(kind, x, y) {
  const k = {
    '死': `<path class="end end-die" d="M${x - 5},${y - 5} L${x + 5},${y + 5} M${x + 5},${y - 5} L${x - 5},${y + 5}"/>`,
    '出家': `<circle class="end end-monk" cx="${x}" cy="${y}" r="5.5"/><circle class="end-core" cx="${x}" cy="${y}" r="2"/>`,
    '遠嫁': `<path class="end end-far" d="M${x - 6},${y} L${x + 4},${y} M${x},${y - 4} L${x + 5},${y} L${x},${y + 4}"/>`,
    '婚': `<circle class="end end-wed" cx="${x - 2.5}" cy="${y}" r="4"/><circle class="end end-wed" cx="${x + 2.5}" cy="${y}" r="4"/>`,
    '獲罪': `<rect class="end end-guilt" x="${x - 5}" y="${y - 5}" width="10" height="10"/>`,
    '劫': `<path class="end end-die" d="M${x},${y - 6} L${x + 6},${y + 5} L${x - 6},${y + 5}Z"/>`,
    '出走': `<path class="end end-far" d="M${x - 6},${y} L${x + 4},${y} M${x},${y - 4} L${x + 5},${y} L${x},${y + 4}"/>`,
  }[kind];
  return k || `<rect class="end end-live" x="${x - 1.5}" y="${y - 6}" width="3" height="12"/>`;
}
function fateRows(list, opts) {
  const W = 1200, L = opts.label ? 112 : 10, R = 14, rowH = opts.rowH || 30;
  const fx = n => L + (n - 1) / 119 * (W - L - R);
  const H = 34 + list.length * rowH + 10;
  let s = `<svg class="atlas-svg fate-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria)}">${hatch('fh' + (opts.key || ''))}`;
  s += `<rect x="${fx(80.5)}" y="22" width="${fx(120) - fx(80.5) + 8}" height="${H - 26}" fill="url(#fh${opts.key || ''})" class="sequel"/>`;
  [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120].forEach(n => {
    s += `<line class="vgrid" x1="${fx(n)}" x2="${fx(n)}" y1="22" y2="${H - 4}"/><text class="tick-label" x="${fx(n)}" y="14" text-anchor="middle">${n}</text>`;
  });
  list.forEach((p, i) => {
    const y = 34 + i * rowH + rowH / 2;
    s += `<g class="frow" data-id="${esc(p.id)}">`;
    if (opts.label) s += `<text class="frow-label" x="${L - 10}" y="${y + 5}" text-anchor="end" tabindex="0" role="button" data-pick="${esc(p.id)}">${esc(nm(p.id))}</text>`;
    if (opts.heat && p.dist) {
      const max = Math.max(...p.dist, 1), bw = (W - L - R) / 119;
      p.dist.forEach((v, k) => { if (v) s += `<rect class="heat" x="${(fx(k + 1) - bw / 2).toFixed(1)}" y="${y - 7}" width="${bw.toFixed(2)}" height="14" opacity="${(0.07 + 0.5 * Math.sqrt(v / max)).toFixed(2)}"/>`; });
    }
    const hasEnter = p.events.some(e => e.k === 'enter'), first = Math.min(p.events[0].ch, hasEnter ? 120 : (p.first || 120)), endE = p.events.find(e => e.k === 'end');
    s += `<line class="life" x1="${fx(first)}" x2="${fx(endE.ch)}" y1="${y}" y2="${y}"/>`;
    if (!hasEnter && p.first && p.first < p.events[0].ch) s += `<g class="ev-mark"><title>${esc(nm(p.id) + '｜' + ch(p.first) + '｜首見（據人物資料）')}</title><circle class="enter" cx="${fx(p.first).toFixed(1)}" cy="${y}" r="4.5"/></g>`;
    p.events.forEach(e => {
      const x = fx(e.ch).toFixed(1), tip = `<title>${esc(nm(p.id) + '｜' + ch(e.ch) + '｜' + e.t)}</title>`;
      if (e.k === 'end') s += `<g class="ev-mark">${tip}${endShape(p.endKind, +x, y)}</g>`;
      else if (e.k === 'enter') s += `<g class="ev-mark">${tip}<circle class="enter" cx="${x}" cy="${y}" r="4.5"/></g>`;
      else if (e.k === 'after') s += `<g class="ev-mark">${tip}<path class="after" d="M${x},${y - 4} l4,4 l-4,4 l-4,-4z"/></g>`;
      else s += `<g class="ev-mark">${tip}<circle class="turn" cx="${x}" cy="${y}" r="3.8"/></g>`;
    });
    s += '</g>';
  });
  return s + '</svg>';
}
function fateDetail(p) {
  const person = X.people.items.find(x => x.name === p.id);
  return `<article class="fate-detail">
    <header><h3>${personLink(p.id)}</h3><span class="tag">${esc(END_T[p.endKind] || p.endKind)}</span>${person ? `<span class="muted small">${esc(gname(person.group))}</span>` : ''}</header>
    <p class="fate-line">${esc(p.fate)}</p>
    <ol class="fate-events">${p.events.map(e => `<li class="k-${e.k}"><span class="k">${esc(X.atlas.fates.meta.kinds[e.k])}</span><span class="t">${esc(e.t)}</span><span class="q">${quote(e.ch, e.ev)}</span>${e.ch > 80 ? '<span class="tag seq">續書</span>' : ''}</li>`).join('')}</ol>
    ${p.omen ? `<div class="omen"><div><h4>判詞所示</h4><p>「${esc(p.omen)}」　${esc(p.verdictSays)}</p></div><div><h4>續書所寫</h4><p>${esc(p.sequelWrites)}</p></div><p class="omen-note">${ico('bulb', 14)} ${esc(p.match)}</p></div>` : ''}
  </article>`;
}
function viewFates(view, route) {
  const F = X.atlas.fates;
  const lane = route.q.get('lane') || 'all', sort = route.q.get('sort') || 'first';
  let list = F.people.filter(p => lane === 'all' || laneOf(p) === lane);
  list = list.slice().sort(sort === 'end' ? (a, b) => a.end - b.end : (a, b) => a.events[0].ch - b.events[0].ch);
  const pick = route.sub && F.people.find(p => p.id === route.sub);
  const omens = F.people.filter(p => p.omen);
  view.innerHTML = head('fates') + `
    <div class="filters atlas-filters">${LANES.map(([k, t]) => `<a class="chip ${lane === k ? 'on' : ''}" href="#/atlas/fates?lane=${encodeURIComponent(k)}&sort=${sort}">${esc(t)}</a>`).join('')}
      <span class="spacer"></span><span class="segment" role="group" aria-label="排序"><a href="#/atlas/fates?lane=${encodeURIComponent(lane)}&sort=first" aria-pressed="${sort === 'first'}">按登場</a><a href="#/atlas/fates?lane=${encodeURIComponent(lane)}&sort=end" aria-pressed="${sort === 'end'}">按結局</a></span></div>
    <section class="card pad atlas-card">
      <div class="legend"><span><svg width="14" height="14"><circle class="enter" cx="7" cy="7" r="4.5"/></svg>登場</span><span><svg width="14" height="14"><circle class="turn" cx="7" cy="7" r="3.2"/></svg>轉折</span>
        <span><svg width="14" height="14">${endShape('死', 7, 7)}</svg>死</span><span><svg width="14" height="14">${endShape('出家', 7, 7)}</svg>出家</span><span><svg width="16" height="14">${endShape('遠嫁', 8, 7)}</svg>遠嫁／出走</span>
        <span><svg width="16" height="14">${endShape('婚', 8, 7)}</svg>婚嫁</span><span><svg width="14" height="14">${endShape('獲罪', 7, 7)}</svg>獲罪</span><span><svg width="14" height="14">${endShape('存', 7, 7)}</svg>存世／守</span>
        <span><svg width="14" height="14"><path class="after" d="M7,3 l4,4 l-4,4 l-4,-4z"/></svg>身後</span><span><i class="lg-heat"></i>名字出現多寡</span><span><i class="lg-hatch"></i>續書</span></div>
      <div class="chart-scroll">${fateRows(list, { label: true, heat: true, aria: '人物命運時間線', key: 'all' })}</div>
      <div id="fate-detail" aria-live="polite">${pick ? fateDetail(pick) : '<p class="muted small">點人物名字，看每個事件的原文與判詞對照。</p>'}</div>
    </section>
    ${method(F.meta.method, F.meta.compareNote)}
    <section class="card pad atlas-card"><h2 class="sec-h">判詞所示與續書所寫</h2>
      <p class="muted small">${esc(F.meta.compareNote)}</p>
      <div class="table-scroll"><table class="omen-table"><thead><tr><th>人物</th><th>判詞</th><th>續書寫法</th><th>常見討論</th></tr></thead><tbody>
      ${omens.map(p => `<tr><th>${personLink(p.id)}</th><td>「${esc(p.omen)}」<br><span class="muted small">${esc(p.verdictSays)}</span></td><td>${esc(p.sequelWrites)}</td><td>${esc(p.match)}</td></tr>`).join('')}
      </tbody></table></div></section>`;
  const show = id => {
    const p = F.people.find(x => x.id === id);
    if (!p) return;
    $('#fate-detail').innerHTML = fateDetail(p);
    $$('.frow', view).forEach(g => g.classList.toggle('on', g.dataset.id === id));
    history.replaceState(null, '', '#/atlas/fates/' + encodeURIComponent(id) + (location.hash.includes('?') ? '?' + location.hash.split('?')[1] : ''));
  };
  $$('[data-pick]', view).forEach(t => {
    t.addEventListener('click', () => show(t.dataset.pick));
    t.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(t.dataset.pick); } });
  });
  if (pick) $$('.frow', view).forEach(g => g.classList.toggle('on', g.dataset.id === pick.id));
}

/* =============================================================
   關係網
   ============================================================= */
function viewRelations(view, route) {
  const R = X.atlas.relations, N = R.network, types = R.meta.types;
  const pos = Object.fromEntries(N.nodes.map(n => [n.id, n]));
  const state = { mode: route.q.get('mode') || 'typed', focus: route.sub || null, off: new Set(), k: 1, tx: 0, ty: 0 };
  view.innerHTML = head('relations') + `
    <div class="filters atlas-filters">
      <span class="segment" role="group" aria-label="連線">${[['typed', '關係類型'], ['cooc', '同段共現'], ['both', '兩者']].map(([k, t]) => `<button type="button" data-mode="${k}" aria-pressed="${state.mode === k}">${t}</button>`).join('')}</span>
      <span class="spacer"></span>
      <label class="atlas-search">${ico('search', 15)}<input id="rel-q" type="search" placeholder="找人物" list="rel-names" aria-label="找人物"><datalist id="rel-names">${N.nodes.map(n => `<option value="${esc(nm(n.id))}">`).join('')}</datalist></label>
    </div>
    <div class="filters type-filters">${Object.entries(types).map(([k, t]) => `<button type="button" class="chip t-${k}" data-type="${k}" aria-pressed="true"><i></i>${esc(t)}</button>`).join('')}</div>
    <section class="card atlas-card net-wrap">
      <div class="zoom">${[['plus', '放大'], ['minus', '縮小'], ['reset', '重設']].map(([k, t]) => `<button type="button" class="icon-btn" data-zoom="${k}" aria-label="${t}">${ico(k, 16)}</button>`).join('')}</div>
      <div class="net-scroll"><svg class="atlas-svg net-svg" id="net" viewBox="0 0 ${N.w} ${N.h}" role="img" aria-label="人物關係網"><g id="net-vp"></g></svg></div>
      <div class="net-side" id="net-side" aria-live="polite"></div>
    </section>
    ${method(R.meta.networkNote, '節點大小依名字出現的段數；位置由力導向演算法計算（固定亂數種子），只表示親疏，不表示地理或尊卑。')}`;
  const vp = $('#net-vp'), side = $('#net-side');
  const neighbors = id => {
    const set = new Set([id]);
    R.edges.forEach(e => { if (e.a === id) set.add(e.b); if (e.b === id) set.add(e.a); });
    if (state.mode !== 'typed') N.cooc.forEach(([a, b]) => { if (a === id) set.add(b); if (b === id) set.add(a); });
    return set;
  };
  const maxCo = Math.max(...N.cooc.map(c => c[2]));
  function draw() {
    const near = state.focus ? neighbors(state.focus) : null;
    let s = '';
    if (state.mode !== 'typed') N.cooc.forEach(([a, b, c]) => {
      if (!pos[a] || !pos[b]) return;
      const on = !near || (near.has(a) && near.has(b) && (a === state.focus || b === state.focus));
      s += `<line class="co ${on ? '' : 'dim'}" x1="${pos[a].x}" y1="${pos[a].y}" x2="${pos[b].x}" y2="${pos[b].y}" stroke-width="${(0.6 + 3.4 * Math.sqrt(c / maxCo)).toFixed(2)}"><title>${esc(nm(a) + '—' + nm(b) + '：同段 ' + c + ' 次')}</title></line>`;
    });
    if (state.mode !== 'cooc') R.edges.forEach(e => {
      if (state.off.has(e.type) || !pos[e.a] || !pos[e.b]) return;
      const on = !near || e.a === state.focus || e.b === state.focus;
      s += `<line class="te t-${e.type} ${on ? '' : 'dim'}" x1="${pos[e.a].x}" y1="${pos[e.a].y}" x2="${pos[e.b].x}" y2="${pos[e.b].y}"><title>${esc(nm(e.a) + '—' + nm(e.b) + '：' + types[e.type] + '・' + e.t)}</title></line>`;
    });
    N.nodes.forEach(n => {
      const r = 5 + Math.sqrt(n.mentions) / 5, on = !near || near.has(n.id);
      s += `<g class="nn ${GROUP_CLASS[n.group] || 'g6'} ${on ? '' : 'dim'} ${state.focus === n.id ? 'focus' : ''}" data-id="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(nm(n.id))}">
        <circle cx="${n.x}" cy="${n.y}" r="${r.toFixed(1)}"/><text x="${n.x}" y="${(n.y + r + 13).toFixed(1)}" text-anchor="middle">${esc(nm(n.id))}</text></g>`;
    });
    vp.innerHTML = s;
    vp.setAttribute('transform', `translate(${state.tx},${state.ty}) scale(${state.k})`);
    $$('.nn', vp).forEach(g => {
      g.addEventListener('click', ev => { ev.stopPropagation(); focus(g.dataset.id); });
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focus(g.dataset.id); } });
    });
    sidePanel();
  }
  function sidePanel() {
    const id = state.focus;
    if (!id) {
      side.innerHTML = `<p class="muted small">點一個人物（或用右上角搜尋），看與他直接相連的人。</p>
        <h4>出現最多的十人</h4><ol class="rank">${N.nodes.slice().sort((a, b) => b.mentions - a.mentions).slice(0, 10).map(n => `<li><button type="button" data-go="${esc(n.id)}">${esc(nm(n.id))}</button><span>${n.mentions} 段</span></li>`).join('')}</ol>`;
    } else {
      const n = pos[id], person = X.people.items.find(p => p.name === id);
      const typed = R.edges.filter(e => e.a === id || e.b === id);
      const co = N.cooc.filter(c => c[0] === id || c[1] === id).slice(0, 8);
      side.innerHTML = `<h3>${personLink(id)}</h3><p class="muted small">${esc(gname(n.group))}・名字出現於 ${n.mentions} 段</p>
        ${person ? `<p class="small">${esc(person.tagline)}</p>` : ''}
        <h4>標註的關係</h4>${typed.length ? `<ul class="rel-list">${typed.map(e => { const o = e.a === id ? e.b : e.a; return `<li><span class="sw t-${e.type}"></span><button type="button" data-go="${esc(o)}">${esc(nm(o))}</button><span class="small">${esc(types[e.type])}・${esc(e.t)}</span>${e.ev ? `<span class="q small">${quote(e.ch, e.ev)}</span>` : ''}</li>`; }).join('')}</ul>` : '<p class="muted small">本站未標註。</p>'}
        <h4>同段共現最多</h4><ol class="rank">${co.map(([a, b, c]) => { const o = a === id ? b : a; return `<li><button type="button" data-go="${esc(o)}">${esc(nm(o))}</button><span>${c} 段</span></li>`; }).join('')}</ol>
        <p><button type="button" class="btn" data-go="">清除選取</button></p>`;
    }
    $$('[data-go]', side).forEach(b => b.onclick = () => focus(b.dataset.go || null));
  }
  function focus(id) {
    state.focus = id;
    if (id) {
      const n = pos[id];
      state.k = Math.max(state.k, 1.4);
      state.tx = N.w / 2 - n.x * state.k; state.ty = N.h / 2 - n.y * state.k;
    }
    draw();
  }
  $$('[data-mode]', view).forEach(b => b.onclick = () => { state.mode = b.dataset.mode; $$('[data-mode]', view).forEach(x => x.setAttribute('aria-pressed', String(x === b))); draw(); });
  $$('[data-type]', view).forEach(b => b.onclick = () => {
    const t = b.dataset.type;
    if (state.off.has(t)) state.off.delete(t); else state.off.add(t);
    b.setAttribute('aria-pressed', String(!state.off.has(t))); draw();
  });
  $$('[data-zoom]', view).forEach(b => b.onclick = () => {
    const z = b.dataset.zoom, cx = N.w / 2, cy = N.h / 2;
    if (z === 'reset') { state.k = 1; state.tx = 0; state.ty = 0; state.focus = null; }
    else { const k2 = Math.min(4, Math.max(0.6, state.k * (z === 'plus' ? 1.3 : 1 / 1.3))); state.tx = cx - (cx - state.tx) * k2 / state.k; state.ty = cy - (cy - state.ty) * k2 / state.k; state.k = k2; }
    draw();
  });
  const q = $('#rel-q');
  q.addEventListener('change', () => {
    const v = q.value.trim();
    const hit = N.nodes.find(n => nm(n.id) === v || n.id === v) || N.nodes.find(n => nm(n.id).includes(v) || n.id.includes(v));
    if (hit) { focus(hit.id); q.value = ''; }
  });
  // Drag to pan (pointer events; works with touch).
  const svg = $('#net');
  let drag = null;
  svg.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' || e.target.closest('.nn')) return; drag = { x: e.clientX, y: e.clientY, tx: state.tx, ty: state.ty }; svg.setPointerCapture(e.pointerId); });
  svg.addEventListener('pointermove', e => {
    if (!drag) return;
    const r = svg.getBoundingClientRect(), f = N.w / r.width;
    state.tx = drag.tx + (e.clientX - drag.x) * f; state.ty = drag.ty + (e.clientY - drag.y) * f;
    vp.setAttribute('transform', `translate(${state.tx},${state.ty}) scale(${state.k})`);
  });
  svg.addEventListener('pointerup', () => { drag = null; });
  if (state.focus && !pos[state.focus]) state.focus = null;
  if (state.focus) focus(state.focus); else draw();
}

/* =============================================================
   賈府世系
   ============================================================= */
function viewFamily(view) {
  const F = X.atlas.relations.family, R = X.atlas.relations;
  const W = 1420, gx = col => 54 + col * 96, gy = gen => 58 + gen * 124;
  const byId = Object.fromEntries(F.nodes.map(n => [n.id, n]));
  const bw = 90, bh = 34;
  let s = `<svg class="atlas-svg fam-svg" viewBox="0 0 ${W} ${gy(4) + 56}" role="img" aria-label="賈府世系圖">`;
  F.rows.forEach((r, i) => { s += `<text class="gen-label" x="6" y="${gy(i) - 30}">${esc(r)}</text><line class="gen-line" x1="0" x2="${W}" y1="${gy(i) - 46}" y2="${gy(i) - 46}"/>`; });
  // Bus routing: down from the parent, along a bus just above the children's row, then down to each child.
  F.parents.forEach(([a, b]) => {
    const p = byId[a], c = byId[b];
    const x1 = gx(p.col), y1 = gy(p.gen) + bh / 2, x2 = gx(c.col), y2 = gy(c.gen) - bh / 2, bus = y2 - 16;
    s += `<path class="kin" d="M${x1},${y1} V${bus} H${x2} V${y2}"/>`;
  });
  F.nodes.filter(n => n.spouseOf).forEach(n => {
    const o = byId[n.spouseOf];
    const y = gy(n.gen), [l, r] = o.col < n.col ? [o, n] : [n, o];
    s += `<line class="spouse" x1="${gx(l.col) + bw / 2}" x2="${gx(r.col) - bw / 2}" y1="${y}" y2="${y}"/>`;
  });
  F.nodes.forEach(n => {
    const x = gx(n.col), y = gy(n.gen);
    const tip = n.ev ? `${ch(n.ev.ch)}：「${n.ev.text}」` : (n.note || '');
    s += `<g class="fnode h-${esc(n.house || 'x')} ${n.person ? 'has-p' : ''}" data-id="${n.id}" tabindex="0" role="button" aria-label="${esc(n.label)}"><title>${esc(n.label + (tip ? '｜' + tip : ''))}</title>
      <rect x="${x - bw / 2}" y="${y - bh / 2}" width="${bw}" height="${bh}" rx="6"/><text x="${x}" y="${y + 5}" text-anchor="middle">${esc(n.label)}</text>
      ${n.minor ? `<text class="minor" x="${x}" y="${y + bh / 2 + 14}" text-anchor="middle">${esc(n.minor)}</text>` : ''}</g>`;
  });
  s += '</svg>';
  const al = F.allies[0];
  view.innerHTML = head('family') + `
    <section class="card pad atlas-card">
      <div class="legend"><span><i class="lg-ning"></i>寧國府一支</span><span><i class="lg-rong"></i>榮國府一支</span><span><i class="lg-out"></i>外姓（史、王、薛、林、李、秦等）</span><span><i class="lg-spouse"></i>婚配</span></div>
      <div class="chart-scroll">${s}</div>
      <div id="fam-detail" aria-live="polite"><p class="muted small">點方塊看出處；有人物檔案的可直接前往。</p></div>
    </section>
    ${method(R.meta.familyNote)}
    <section class="card pad atlas-card"><h2 class="sec-h">${esc(al.label)}</h2><p class="small">${esc(al.note)}　${quote(al.ch, al.ev)}</p>
      <div class="houses">${al.houses.map(h => `<div class="house"><b>${esc(h.label)}</b><p>${esc(h.line)}</p>${(h.members || []).length ? `<p class="small">${h.members.map(personLink).join('、')}</p>` : ''}</div>`).join('')}</div>
      <h3 class="sub-h">姻親連結</h3><ul class="bullet">${al.links.map(l => `<li>${personLink(l.a)} — ${personLink(l.b)}：${esc(l.t)}${l.ev ? ' ' + quote(l.ch, l.ev) : ''}</li>`).join('')}</ul></section>`;
  const det = $('#fam-detail');
  $$('.fnode', view).forEach(g => {
    const go = () => {
      const n = byId[g.dataset.id];
      $$('.fnode', view).forEach(x => x.classList.toggle('on', x === g));
      det.innerHTML = `<div class="fam-card"><h3>${n.person ? personLink(n.person) : esc(n.label)}</h3>
        ${n.ev ? `<p class="small">出處：${quote(n.ev.ch, n.ev.text)}</p>` : ''}${n.note ? `<p class="small muted">${esc(n.note)}</p>` : ''}
        ${n.person && X.atlas.fates.people.some(p => p.id === n.person) ? `<p><a class="chip" href="#/atlas/fates/${encodeURIComponent(n.person)}">${ico('hourglass', 14)} 命運時間線</a></p>` : ''}</div>`;
    };
    g.addEventListener('click', go);
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
}

/* =============================================================
   地圖
   ============================================================= */
const KIND_SHAPE = { 門: 'gate', 山: 'hill', 水: 'water', 亭: 'pavilion', 榭: 'pavilion', 橋: 'pavilion', 庵: 'temple', 冢: 'small', 坊: 'small', 樓: 'hall', 堂: 'hall' };
function placeMark(p) {
  const shape = KIND_SHAPE[p.kind] || 'house', x = p.x, y = p.y;
  if (shape === 'pavilion') return `<path class="pm pm-${shape}" d="M${x},${y - 7} L${x + 7},${y} L${x},${y + 7} L${x - 7},${y}Z"/>`;
  if (shape === 'temple' || shape === 'hill') return `<path class="pm pm-${shape}" d="M${x},${y - 8} L${x + 8},${y + 6} L${x - 8},${y + 6}Z"/>`;
  if (shape === 'water' || shape === 'small') return `<circle class="pm pm-${shape}" cx="${x}" cy="${y}" r="5.5"/>`;
  if (shape === 'gate') return `<rect class="pm pm-gate" x="${x - 12}" y="${y - 4}" width="24" height="8"/>`;
  return `<rect class="pm pm-${shape}" x="${x - 7}" y="${y - 7}" width="14" height="14" rx="2"/>`;
}
function placeDetail(p) {
  return `<article class="place-card"><h3>${esc(p.label)}</h3>${p.alias ? `<p class="muted small">${esc(p.alias)}</p>` : ''}
    ${(p.residents || []).length ? `<p class="small">住：${p.residents.map(personLink).join('、')}</p>` : ''}
    <ul class="place-events">${(p.events || []).map(e => `<li><span class="t">${esc(e.t)}</span><span class="q small">${quote(e.ch, e.ev)}</span></li>`).join('')}</ul></article>`;
}
function gardenSVG(G, route) {
  let s = `<svg class="atlas-svg garden-svg" viewBox="0 0 ${G.w} ${G.h}" role="img" aria-label="大觀園示意圖">
    <rect class="wall" x="14" y="14" width="${G.w - 28}" height="${G.h - 28}" rx="26"/>`;
  G.hills.forEach(h => { s += `<path class="hill" d="${catmull(h.concat([h[0]]))}Z"/>`; });
  s += `<path class="water-w" d="${catmull(G.water)}"/><path class="water" d="${catmull(G.water)}"/>`;
  s += `<text class="map-note" x="${G.w - 30}" y="${G.h - 26}" text-anchor="end">沁芳溪（示意）</text><text class="compass" x="${G.w - 40}" y="54" text-anchor="middle">北</text><path class="compass-arrow" d="M${G.w - 40},62 l-6,14 l6,-4 l6,4z"/>`;
  const byId = Object.fromEntries(G.places.map(p => [p.id, p]));
  if (route) {
    const pts = G.route.map(id => [byId[id].x, byId[id].y]);
    s += `<path class="route" d="${pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join(' ')}"/>`;
    G.route.slice(0, -1).forEach((id, i) => { const p = byId[id]; s += `<g class="route-step"><circle cx="${p.x + 15}" cy="${p.y - 15}" r="9"/><text x="${p.x + 15}" y="${p.y - 11}" text-anchor="middle">${i + 1}</text></g>`; });
  }
  G.places.forEach(p => {
    const left = p.x > G.w - 170;
    s += `<g class="place k-${KIND_SHAPE[p.kind] || 'house'} ${(p.residents || []).length ? 'lived' : ''}" data-id="${p.id}" tabindex="0" role="button" aria-label="${esc(p.label)}"><title>${esc(p.label)}</title>${placeMark(p)}
      <text x="${left ? p.x - 12 : p.x + 12}" y="${p.y + 4}" text-anchor="${left ? 'end' : 'start'}">${esc(p.label)}</text></g>`;
  });
  return s + '</svg>';
}
function mansionSVG(M) {
  let s = `<svg class="atlas-svg mansion-svg" viewBox="0 0 ${M.w} ${M.h}" role="img" aria-label="寧榮二府示意圖">`;
  M.blocks.forEach(b => {
    s += `<g class="blk blk-${b.kind}" data-id="${b.id}" tabindex="0" role="button" aria-label="${esc(b.label)}"><title>${esc(b.label + '｜' + b.note)}</title><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="8"/>
      <text x="${b.x + 12}" y="${b.y + 24}">${esc(b.label)}</text></g>`;
  });
  s += `<line class="street" x1="30" x2="${M.w - 30}" y1="${M.street.y}" y2="${M.street.y}"/><text class="map-note" x="${M.w / 2}" y="${M.street.y + 24}" text-anchor="middle">${esc(M.street.label)}</text>
    <text class="compass" x="${M.w - 40}" y="40" text-anchor="middle">北</text><path class="compass-arrow" d="M${M.w - 40},48 l-6,14 l6,-4 l6,4z"/>
    <text class="map-note" x="${M.w - 30}" y="${M.street.y - 8}" text-anchor="end">東 →</text><text class="map-note" x="30" y="${M.street.y - 8}">← 西</text>`;
  return s + '</svg>';
}
function worldSVG(Wd, active) {
  const W = 1000, H = 900;
  const byId = Object.fromEntries(Wd.places.map(p => [p.id, p]));
  // Main map: the Grand Canal corridor. Inset: 江南, where most places cluster.
  const frames = [
    { key: 'main', lon: [114.6, 123.2], lat: [29.4, 41.0], x: 0, y: 0, w: 560, h: 900 },
    { key: 'inset', lon: [118.0, 121.3], lat: [30.5, 32.9], x: 592, y: 440, w: 400, h: 400 },
  ];
  const proj = f => ([lon, lat]) => [f.x + (lon - f.lon[0]) / (f.lon[1] - f.lon[0]) * f.w, f.y + (f.lat[1] - lat) / (f.lat[1] - f.lat[0]) * f.h];
  const line = (P, pts) => pts.map((p, i) => { const [x, y] = P(p); return (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1); }).join(' ');
  const curve = (P, ids, k) => {
    let d = '';
    ids.forEach((id, i) => {
      const [x, y] = P([byId[id].lon, byId[id].lat]);
      if (!i) { d = `M${x.toFixed(1)},${y.toFixed(1)}`; return; }
      const [x0, y0] = P([byId[ids[i - 1]].lon, byId[ids[i - 1]].lat]);
      const len = Math.hypot(x - x0, y - y0) || 1, off = k * Math.min(1, len / 120);
      const cx = (x0 + x) / 2 - (y - y0) / len * off, cy = (y0 + y) / 2 + (x - x0) / len * off;
      d += ` Q${cx.toFixed(1)},${cy.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return d;
  };
  const south = ['jinling', 'gusu', 'xuanmu', 'yangzhou', 'huzhou', 'piling'];
  const labelSide = { jing: 'r', yangzhou: 'r', piling: 'r', gusu: 't', huzhou: 'r', jinling: 'b', xuanmu: 'b' };
  let s = `<svg class="atlas-svg world-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="書中地理示意圖"><defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10z" class="arrow-head"/></marker>
    ${frames.map(f => `<clipPath id="clip-${f.key}"><rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}"/></clipPath>`).join('')}</defs>`;
  frames.forEach(f => {
    const P = proj(f), inset = f.key === 'inset';
    if (inset) s += `<rect class="inset-box" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="8"/><text class="map-note" x="${f.x + 12}" y="${f.y + 22}">江南放大</text>`;
    s += `<g clip-path="url(#clip-${f.key})">`;
    s += `<path class="coast" d="${line(P, Wd.coast)}"/>`;
    Wd.rivers.forEach(r => { s += `<path class="river r-${r.id}" d="${line(P, r.pts)}"><title>${esc(r.label)}</title></path>`; });
    if (!inset) {
      const cm = P(Wd.rivers.find(r => r.id === 'canal').pts[4]);
      s += `<text class="river-label" x="${(cm[0] - 18).toFixed(1)}" y="${cm[1].toFixed(1)}" text-anchor="end">大運河</text>`;
      const yz = P(Wd.rivers.find(r => r.id === 'yangtze').pts[7]);
      s += `<text class="river-label" x="${yz[0].toFixed(1)}" y="${(yz[1] - 10).toFixed(1)}">長江</text>`;
      s += `<text class="sea" x="${P([122.2, 34.2])[0].toFixed(1)}" y="${P([122.2, 34.2])[1].toFixed(1)}">黃海</text><text class="sea" x="${P([119.6, 38.9])[0].toFixed(1)}" y="${P([119.6, 38.9])[1].toFixed(1)}">渤海</text>`;
      const [ax, ay] = P([118.0, 32.9]), [bx, by] = P([121.3, 30.5]);
      s += `<rect class="inset-mark" x="${ax.toFixed(1)}" y="${ay.toFixed(1)}" width="${(bx - ax).toFixed(1)}" height="${(by - ay).toFixed(1)}"/><line class="inset-mark" x1="${bx.toFixed(1)}" y1="${ay.toFixed(1)}" x2="592" y2="440"/><line class="inset-mark" x1="${bx.toFixed(1)}" y1="${by.toFixed(1)}" x2="592" y2="840"/>`;
    }
    Wd.journeys.forEach((j, i) => {
      const on = !active || active === j.id;
      s += `<path class="journey j${i % 6} ${on ? '' : 'dim'}" d="${curve(P, j.path, (i - 3) * (inset ? 9 : 16))}" ${inset ? '' : 'marker-end="url(#arrow)"'}><title>${esc(j.label + '（' + ch(j.ch) + (j.to ? '—' + ch(j.to) : '') + '）')}</title></path>`;
    });
    Wd.places.forEach(p => {
      if (!inset && south.includes(p.id)) { const [x, y] = P([p.lon, p.lat]); s += `<circle class="wdot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3"/>`; return; }
      if (inset && !south.includes(p.id)) return;
      const [x, y] = P([p.lon, p.lat]), side = labelSide[p.id] || 'r';
      const tx = side === 'r' ? x + 11 : side === 'l' ? x - 11 : x, ty = side === 't' ? y - 12 : side === 'b' ? y + 24 : y + 5;
      s += `<g class="wplace ${p.real === '書中未明言' ? 'vague' : ''}" data-id="${p.id}" tabindex="0" role="button" aria-label="${esc(p.label)}"><title>${esc(p.label)}</title><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6"/>
        <text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${side === 'r' ? 'start' : side === 'l' ? 'end' : 'middle'}">${esc(p.label)}</text></g>`;
    });
    s += '</g>';
  });
  return s + '</svg>';
}
function viewMap(view, route) {
  const PL_ = X.atlas.places, sub = ['garden', 'mansion', 'world'].includes(route.sub) ? route.sub : 'garden';
  const tabs = [['garden', '大觀園'], ['mansion', '兩府'], ['world', '書中地理']];
  const residents = [...new Set(PL_.garden.places.flatMap(p => p.residents || []))];
  view.innerHTML = head('map') + `
    <div class="filters atlas-filters"><span class="segment" role="group" aria-label="地圖">${tabs.map(([k, t]) => `<a href="#/atlas/map/${k}" aria-pressed="${sub === k}">${t}</a>`).join('')}</span></div>
    <section class="card pad atlas-card map-card">${sub === 'garden' ? `
      <div class="filters map-tools"><button type="button" class="chip" id="route-tog" aria-pressed="false">${ico('route', 14)}第十七回遊園路線</button>
        <span class="spacer"></span><span class="small muted">誰住哪裡：</span>${residents.map(id => `<button type="button" class="chip" data-res="${esc(id)}">${esc(nm(id))}</button>`).join('')}</div>
      <div class="map-grid"><div class="chart-scroll" id="map-box">${gardenSVG(PL_.garden, false)}</div><div class="map-side" id="map-side"><p class="muted small">點地圖上的院落、亭榭，看誰住、發生過什麼。</p></div></div>
      ${method(PL_.meta.gardenNote, PL_.garden.routeNote, PL_.meta.variantNote)}` : sub === 'mansion' ? `
      <div class="map-grid"><div class="chart-scroll">${mansionSVG(PL_.mansion)}</div><div class="map-side" id="map-side"><p class="muted small">點方塊看原文依據。</p></div></div>
      ${method(PL_.meta.mansionNote)}` : `
      <div class="filters map-tools"><button type="button" class="chip" data-j="" aria-pressed="true">全部行旅</button>${PL_.world.journeys.map(j => `<button type="button" class="chip" data-j="${j.id}" aria-pressed="false">${esc(nm(j.who))}</button>`).join('')}</div>
      <div class="map-grid world-grid"><div class="chart-scroll" id="map-box">${worldSVG(PL_.world, null)}</div><div class="map-side" id="map-side">${worldSide(null)}</div></div>
      ${method(PL_.meta.worldNote, PL_.meta.variantNote)}`}
    </section>`;
  const side = $('#map-side');
  if (sub === 'garden') {
    const G = PL_.garden;
    let route = false;
    const bind = () => $$('.place', view).forEach(g => {
      const go = () => { $$('.place', view).forEach(x => x.classList.toggle('on', x === g)); side.innerHTML = placeDetail(G.places.find(p => p.id === g.dataset.id)); };
      g.addEventListener('click', go);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    bind();
    $('#route-tog').onclick = e => {
      route = !route; e.currentTarget.setAttribute('aria-pressed', String(route));
      $('#map-box').innerHTML = gardenSVG(G, route); bind();
      if (route) side.innerHTML = `<h3>第十七回遊園</h3><ol class="route-list">${G.route.slice(0, -1).map(id => { const p = G.places.find(x => x.id === id); return `<li>${esc(p.label)}</li>`; }).join('')}<li>出正門</li></ol><p class="small muted">${esc(G.routeNote)}</p>`;
    };
    $$('[data-res]', view).forEach(b => b.onclick = () => {
      const id = b.dataset.res;
      $$('[data-res]', view).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      $$('.place', view).forEach(g => { const p = G.places.find(x => x.id === g.dataset.id); g.classList.toggle('on', (p.residents || []).includes(id)); });
      const homes = G.places.filter(p => (p.residents || []).includes(id));
      side.innerHTML = homes.map(placeDetail).join('') + `<p><a class="chip" href="#/people/${encodeURIComponent(id)}">${esc(nm(id))}的人物檔案</a></p>`;
    });
  } else if (sub === 'mansion') {
    $$('.blk', view).forEach(g => {
      const go = () => { const b = PL_.mansion.blocks.find(x => x.id === g.dataset.id); $$('.blk', view).forEach(x => x.classList.toggle('on', x === g)); side.innerHTML = `<article class="place-card"><h3>${esc(b.label)}</h3><p class="small">${esc(b.note)}</p><p class="small">依據：${quote(b.ch, b.ev)}</p></article>`; };
      g.addEventListener('click', go);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  } else {
    const bindW = () => $$('.wplace', view).forEach(g => {
      const go = () => { const p = PL_.world.places.find(x => x.id === g.dataset.id); side.innerHTML = `<article class="place-card"><h3>${esc(p.label)}</h3><p class="tag">${esc(p.real)}</p><p class="small">${esc(p.note)}</p><ul class="place-events">${p.events.map(e => `<li><span class="t">${esc(e.t)}</span><span class="q small">${quote(e.ch, e.ev)}</span></li>`).join('')}</ul></article>` + worldSide(null, true); };
      g.addEventListener('click', go);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    bindW();
    $$('[data-j]', view).forEach(b => b.onclick = () => {
      const id = b.dataset.j || null;
      $$('[data-j]', view).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      $('#map-box').innerHTML = worldSVG(PL_.world, id); bindW();
      side.innerHTML = worldSide(id);
    });
  }
}
function worldSide(active, onlyFiction) {
  const Wd = X.atlas.places.world;
  const js = active ? Wd.journeys.filter(j => j.id === active) : Wd.journeys;
  return `${onlyFiction ? '' : `<h4>行旅</h4><ul class="place-events">${js.map(j => `<li><span class="t">${personLink(j.who)}：${esc(j.label)}</span><span class="q small">${quote(j.ch, j.ev)}</span></li>`).join('')}</ul>`}
    <h4>書中虛構或未指明的地方</h4><ul class="place-events">${Wd.fictional.map(f => `<li><span class="t">${esc(f.label)}：${esc(f.note)}</span><span class="q small">${quote(f.ch, f.ev)}</span></li>`).join('')}</ul>`;
}

/* =============================================================
   時序
   ============================================================= */
function viewTime(view) {
  const T = X.atlas.chrono, W = 1200, L = 132, R = 16, top = 30, rowH = 22;
  const tx = n => L + (n - 1) / 119 * (W - L - R);
  const H = top + T.years.length * rowH + 40;
  let s = `<svg class="atlas-svg time-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="故事年與回目對照">${hatch('th')}`;
  s += `<rect x="${tx(80.5)}" y="${top - 8}" width="${tx(120) - tx(80.5) + 8}" height="${T.years.length * rowH + 8}" fill="url(#th)" class="sequel"/>`;
  [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120].forEach(n => { s += `<line class="vgrid" x1="${tx(n)}" x2="${tx(n)}" y1="${top - 8}" y2="${H - 34}"/><text class="tick-label" x="${tx(n)}" y="${H - 16}" text-anchor="middle">${n}</text>`; });
  s += `<text class="tick-label" x="${tx(60)}" y="${H - 1}" text-anchor="middle">回目</text>`;
  T.years.forEach((y, i) => {
    const yy = top + i * rowH;
    const x0 = tx(y.from) - 4, x1 = tx(y.to) + 4;
    s += `<text class="year-label ${y.y === 12 ? 'em' : ''}" x="${L - 10}" y="${yy + 14}" text-anchor="end">${esc(y.label)}・${y.y}歲</text>
      <rect class="year-bar ${y.y === 12 ? 'em' : ''}" x="${x0.toFixed(1)}" y="${yy + 4}" width="${(x1 - x0).toFixed(1)}" height="${rowH - 8}" rx="3"><title>${esc(y.label + '（' + y.gz + '）：第' + y.from + '—' + y.to + '回' + (y.note ? '。' + y.note : ''))}</title></rect>`;
  });
  T.anchors.forEach(a => {
    const i = T.years.findIndex(y => y.y === a.y), yy = top + i * rowH + rowH / 2;
    s += `<g class="anchor"><title>${esc(ch(a.ch) + '　' + a.when + '：' + a.t)}</title><circle cx="${tx(a.ch)}" cy="${yy}" r="3.6"/></g>`;
  });
  s += '</svg>';
  const span = T.years.map(y => ({ ...y, n: y.to - y.from + 1 }));
  view.innerHTML = head('time') + `
    <section class="card pad atlas-card">
      <h2 class="sec-h">寶玉一到二十歲，各佔多少回</h2>
      <p class="small">${esc('紅十二年（寶玉十二歲，省親之年）從第十八回元宵寫到第五十三回除夕，一年佔了三十六回；前十一年合起來只有十八回。全書的篇幅集中在大觀園最熱鬧的三年（第十八至八十回）。')}</p>
      <div class="legend"><span><i class="lg-bar"></i>該年所跨回目</span><span><i class="lg-anchor"></i>書中明寫的月日、節令</span><span><i class="lg-hatch"></i>續書</span></div>
      <div class="chart-scroll">${s}</div>
      ${method(T.meta.scheme, T.meta.otherSchemes, T.meta.anchorNote)}
      <p class="small muted">紀年來源：${esc(T.meta.source.author)}〈${esc(T.meta.source.title)}〉，<a href="${esc(T.meta.source.url)}" target="_blank" rel="noopener">${esc(T.meta.source.access)}</a></p>
    </section>
    <section class="card pad atlas-card"><h2 class="sec-h">時間錨點</h2>
      <ol class="anchors">${T.anchors.map(a => `<li><span class="when">${esc(a.when)}</span><span class="t">${esc(a.t)}<small>紅${a.y}年</small></span><span class="q small">${quote(a.ch, a.ev)}</span></li>`).join('')}</ol></section>
    <section class="card pad atlas-card"><h2 class="sec-h">書中年齡與前後矛盾</h2><p class="small muted">${esc(T.meta.ageNote)}</p>
      <div class="table-scroll"><table class="age-table"><thead><tr><th>回目</th><th>人物</th><th>原文所說</th><th>矛盾（周紹良按語等）</th></tr></thead><tbody>
      ${T.ages.map(a => `<tr class="${a.issue ? 'flag' : ''}"><td><a href="#/read/${a.ch}">${ch(a.ch)}</a></td><td>${personLink(a.who)}</td><td>${esc(a.t)}<br><q class="ev">${esc(a.ev)}</q></td><td>${a.issue ? `${ico('bulb', 14)} ${esc(a.issue)}` : '<span class="muted">—</span>'}</td></tr>`).join('')}
      </tbody></table></div></section>
    <section class="card pad atlas-card"><h2 class="sec-h">每年回數</h2><div class="year-spans">${span.filter(y => y.y >= 7).map(y => `<div class="ys ${y.y === 12 ? 'em' : ''}"><span>${esc(y.label)}</span><i style="width:${(y.n / 36 * 100).toFixed(1)}%"></i><b>${y.n} 回</b></div>`).join('')}</div>
      <p class="tiny muted">跨年之回在兩年各計一次，故總和大於一百二十。紅元年至紅六年合在第一、二回，未列。</p></section>`;
}

/* =============================================================
   研究前沿
   ============================================================= */
function viewFrontier(view, route) {
  const F = X.atlas.frontier, topic = route.q.get('topic') || 'all';
  const topics = [...new Set(F.items.map(i => i.topic))];
  const items = F.items.filter(i => topic === 'all' || i.topic === topic);
  view.innerHTML = head('frontier', `<p class="small muted">${esc(F.meta.note)}</p>`) + `
    <div class="filters atlas-filters"><a class="chip ${topic === 'all' ? 'on' : ''}" href="#/atlas/frontier">全部</a>${topics.map(t => `<a class="chip ${topic === t ? 'on' : ''}" href="#/atlas/frontier?topic=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div>
    <div class="frontier">${items.map(i => `<article class="card pad fr-item"><div class="fr-meta"><span class="tag">${esc(i.topic)}</span><span class="tag ${i.kind === '普及' ? 'soft' : ''}">${esc(i.kind)}</span><span class="muted small">${esc(i.date)}</span></div>
      <h3><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)} ${ico('external', 14)}</a></h3><p class="muted small">${esc(i.who)}</p>
      <p>${esc(i.summary)}</p><p class="small fr-use">${ico('compass', 14)} ${esc(i.use)}</p></article>`).join('')}</div>`;
}

/* =============================================================
   嵌入其他頁面的小圖
   ============================================================= */
function homeCard(atlas, ctx) {
  X = Object.assign({}, X || {}, ctx, { atlas, chapters: X?.chapters || { items: [] } });
  const last = (() => { try { return JSON.parse(localStorage.getItem('hlm_last') || 'null'); } catch (_) { return null; } })();
  return `<div class="home-atlas-in"><div><h3>${ico('compass', 18)} 全書脈絡</h3>
      <p class="small muted">家勢起落、四十七個節點與三個元宵。${last?.n ? `你讀到${ch(last.n)}。` : ''}</p></div>
    <a class="home-atlas-chart" href="#/atlas/plot" aria-label="打開全書脈絡">${plotSVG({ id: 'home', h: 120, top: 12, bottom: 104, bandTop: 4, partLabels: false, nodes: false, marker: last?.n || null, label: '全書家勢曲線縮圖' })}</a>
    <div class="home-atlas-links"><a class="chip" href="#/atlas/fates">${ico('hourglass', 14)} 人物命運</a><a class="chip" href="#/atlas/relations">${ico('waypoints', 14)} 關係網</a><a class="chip" href="#/atlas/map">${ico('map', 14)} 大觀園地圖</a><a class="chip" href="#/atlas/time">${ico('clock', 14)} 時序</a></div></div>`;
}
function chapterStrip(atlas, n, ctx) {
  X = Object.assign({}, X || {}, ctx, { atlas, chapters: X?.chapters || { items: [] } });
  const nodes = atlas.plot.nodes, part = atlas.parts.find(p => n >= p.from && n <= p.to);
  const here = nodes.find(nd => n >= nd.ch && n <= (nd.to || nd.ch));
  const near = here || nodes.slice().sort((a, b) => Math.abs(a.ch - n) - Math.abs(b.ch - n))[0];
  const year = atlas.chrono.years.filter(y => n >= y.from && n <= y.to).pop();
  return `<a class="strip-chart" href="#/atlas/plot" aria-label="在全書脈絡中查看">${plotSVG({ id: 'strip', h: 46, top: 6, bottom: 40, bandTop: 2, partLabels: false, nodes: false, marker: n, label: '本回在全書中的位置' })}</a>
    <p class="strip-text small">${part ? `<b>${esc(part.name)}</b>　` : ''}${here ? `本回是節點「${esc(here.t)}」` : `最近的節點：${ch(near.ch)}「${esc(near.t)}」`}${year ? `　·　${esc(year.label)}，寶玉${year.y}歲` : ''}${n > 80 ? '　·　<span class="tag seq">續書</span>' : ''}
      <a href="#/atlas/plot">${ico('compass', 13)} 全書脈絡</a></p>`;
}
function personCard(atlas, name, ctx) {
  X = Object.assign({}, X || {}, ctx, { atlas });
  const p = atlas.fates.people.find(x => x.id === name);
  if (!p) return '';
  return `<section class="card pad person-fate" style="margin-bottom:14px"><h3 style="font-size:17px">命運時間線</h3>
    <p class="small">${esc(p.fate)}</p>
    <div class="chart-scroll">${fateRows([p], { label: false, heat: true, rowH: 34, aria: nm(name) + '的命運時間線', key: 'p' })}</div>
    <ol class="fate-events compact">${p.events.map(e => `<li class="k-${e.k}"><span class="k">${esc(atlas.fates.meta.kinds[e.k])}</span><span class="t">${esc(e.t)}</span><span class="q">${quote(e.ch, e.ev)}</span></li>`).join('')}</ol>
    ${p.omen ? `<p class="small omen-note">${ico('bulb', 14)} 判詞「${esc(p.omen)}」對照續書：${esc(p.match)}</p>` : ''}
    <p><a class="chip" href="#/atlas/fates/${encodeURIComponent(name)}">${ico('hourglass', 14)} 在全部人物中比較</a> <a class="chip" href="#/atlas/relations/${encodeURIComponent(name)}">${ico('waypoints', 14)} 關係網</a></p></section>`;
}

window.HLMAtlas = { render, homeCard, chapterStrip, personCard, names: NAME_T };
})();
