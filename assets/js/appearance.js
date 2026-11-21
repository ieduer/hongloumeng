/* Palette names and light tokens: RDFZ Blog packages/themes/src/palettes.ts.
 * Snapshot SHA-256: 0f9c7fb3fe783dde7119c58056e5cf70e57c677fd4278c31a112100c8ac3b39d
 * Local adaptation only; no runtime dependency. */
(function () {
'use strict';
const PALETTES = [
  { "id": "ink", "name": "墨黑", "neutral": true, "accent": "#ededed", "background": "#000000" },
  { "id": "paper", "name": "紙白", "neutral": true, "accent": "#1e1e1e", "background": "#ffffff" },
  {
    "id": "classic",
    "name": "紅樓原色",
    "accent": "#9c3833",
    "link": "#9c3833",
    "wash": "#efe7d9",
    "background": "#f6f1e7",
    "surface": "#fffdf9",
    "commentSurface": "#fbf8f2",
    "text": "#2a2521",
    "textMuted": "#574d44",
    "border": "#e2d8c8"
  },
  {
    "id": "yutanqing",
    "name": "雨潭青",
    "accent": "#63BBD0",
    "link": "#3D7481",
    "wash": "#FFE6E3",
    "background": "#FFF8F7",
    "surface": "#FFFFFF",
    "commentSurface": "#FFEEEB",
    "text": "#243133",
    "textMuted": "#5C6D72",
    "border": "#EADEDD"
  },
  {
    "id": "yuhonglan",
    "name": "雨泓藍",
    "accent": "#63BBD0",
    "link": "#3D7481",
    "wash": "#FFEEC0",
    "background": "#FFFAED",
    "surface": "#FFFFFF",
    "commentSurface": "#FFF1CA",
    "text": "#243133",
    "textMuted": "#5C6D72",
    "border": "#EAE2CD"
  },
  {
    "id": "jianyunbao",
    "name": "澗筠薄",
    "accent": "#83A78D",
    "link": "#597260",
    "wash": "#F6EAA9",
    "background": "#FCF9E7",
    "surface": "#FFFFFF",
    "commentSurface": "#F9F2CB",
    "text": "#292E2A",
    "textMuted": "#626964",
    "border": "#E6E0C3"
  },
  {
    "id": "jiangliuzhuo",
    "name": "絳榴灼",
    "accent": "#EE1969",
    "link": "#D1165C",
    "wash": "#F9E5E0",
    "background": "#FDF8F6",
    "surface": "#FFFFFF",
    "commentSurface": "#FBEFEC",
    "text": "#381A25",
    "textMuted": "#784D5D",
    "border": "#E7DEDC"
  },
  {
    "id": "wuaizi",
    "name": "霧靄紫",
    "accent": "#615EA8",
    "link": "#615EA8",
    "wash": "#ECECF5",
    "background": "#FAFAFC",
    "surface": "#FFFFFF",
    "commentSurface": "#F6F5FA",
    "text": "#24242E",
    "textMuted": "#5B5B6A",
    "border": "#E1E1E5"
  },
  {
    "id": "danshenqian",
    "name": "丹椹淺",
    "accent": "#FC8A3A",
    "link": "#A15825",
    "wash": "#C4F1FF",
    "background": "#EEFBFF",
    "surface": "#FFFFFF",
    "commentSurface": "#DAF6FF",
    "text": "#3A2A1E",
    "textMuted": "#7A6454",
    "border": "#CFE3EA"
  },
  {
    "id": "maerselv",
    "name": "馬爾斯綠",
    "accent": "#01847F",
    "link": "#017975",
    "wash": "#FBE2EE",
    "background": "#FEF7FA",
    "surface": "#FFFFFF",
    "commentSurface": "#FDEDF4",
    "text": "#172928",
    "textMuted": "#486261",
    "border": "#E8DDE2"
  },
  {
    "id": "zhusha",
    "name": "朱砂",
    "accent": "#D30121",
    "link": "#D30121",
    "wash": "#D7EBFF",
    "background": "#F4F9FF",
    "surface": "#FFFFFF",
    "commentSurface": "#E8F3FF",
    "text": "#34171B",
    "textMuted": "#72484F",
    "border": "#D8E1EA"
  },
  {
    "id": "qingshuilan",
    "name": "清水藍",
    "accent": "#3F389F",
    "link": "#3F389F",
    "wash": "#FDE3E2",
    "background": "#FEF7F7",
    "surface": "#FFFFFF",
    "commentSurface": "#FEEFEE",
    "text": "#1F1E2D",
    "textMuted": "#555368",
    "border": "#E9DDDD"
  },
  {
    "id": "diwangzi",
    "name": "帝王紫",
    "accent": "#6A0DAD",
    "link": "#6A0DAD",
    "wash": "#FFF000",
    "background": "#FFFBB8",
    "surface": "#FFFFFF",
    "commentSurface": "#FFF661",
    "text": "#25182F",
    "textMuted": "#5D4B6B",
    "border": "#EAE377"
  },
  {
    "id": "qinglan",
    "name": "青藍",
    "accent": "#00B7C7",
    "link": "#007983",
    "wash": "#D6F3F6",
    "background": "#F4FCFC",
    "surface": "#FFFFFF",
    "commentSurface": "#E6F8F9",
    "text": "#163032",
    "textMuted": "#486D70",
    "border": "#D7E4E6"
  },
  {
    "id": "tailv",
    "name": "苔綠",
    "accent": "#4D613C",
    "link": "#4D613C",
    "wash": "#F9E4E9",
    "background": "#FDF7F9",
    "surface": "#FFFFFF",
    "commentSurface": "#FCEFF2",
    "text": "#21241F",
    "textMuted": "#575B54",
    "border": "#E7DDE0"
  },
  {
    "id": "qingque",
    "name": "青雀頭黛",
    "accent": "#153C46",
    "link": "#153C46",
    "wash": "#FDE8AD",
    "background": "#FEF9E8",
    "surface": "#FFFFFF",
    "commentSurface": "#FEF1CC",
    "text": "#191F20",
    "textMuted": "#4C5456",
    "border": "#E9DFC5"
  },
  {
    "id": "hailan",
    "name": "海藍",
    "accent": "#1E9BFF",
    "link": "#1670B8",
    "wash": "#F0FF0A",
    "background": "#FBFFBA",
    "surface": "#FFFFFF",
    "commentSurface": "#F0FF0A",
    "text": "#1B2C3A",
    "textMuted": "#4E677B",
    "border": "#E3EA7B"
  },
  {
    "id": "zhuanhezong",
    "name": "磚褐棕",
    "accent": "#8D4726",
    "link": "#8D4726",
    "wash": "#C3F2ED",
    "background": "#EEFBFA",
    "surface": "#FFFFFF",
    "commentSurface": "#DAF7F4",
    "text": "#2A201C",
    "textMuted": "#645650",
    "border": "#CFE4E1"
  },
  {
    "id": "nenyahuang",
    "name": "嫩芽黃",
    "accent": "#90E8E0",
    "link": "#487470",
    "wash": "#DAEFCF",
    "background": "#F5FBF2",
    "surface": "#FFFFFF",
    "commentSurface": "#E9F6E3",
    "text": "#2B3736",
    "textMuted": "#5F6F6E",
    "border": "#D9E2D4"
  },
  {
    "id": "canglang",
    "name": "蒼浪",
    "accent": "#ACD6CC",
    "link": "#596F6A",
    "wash": "#F8E8C6",
    "background": "#FDF9EF",
    "surface": "#FFFFFF",
    "commentSurface": "#FBF1DD",
    "text": "#2E3433",
    "textMuted": "#666E6C",
    "border": "#E6DFD0"
  }
];
const rgb = h => h.slice(1).match(/../g).map(x => parseInt(x, 16));
const mix = (a, b, t) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
const lum = h => rgb(h).map(v => (v /= 255) <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
function fit(color, backgrounds, target, dark) {
  for (let i = 0; i <= 100; i++) {
    const c = mix(color, dark ? '#ffffff' : '#000000', i / 100);
    if (backgrounds.every(bg => contrast(c, bg) >= target)) return c;
  }
  return dark ? '#ffffff' : '#000000';
}
// 墨黑／紙白 follow ly.bdfz.net's neutral base exactly: one base in two brightnesses.
function neutral(dark) {
  const paper = dark ? '#000000' : '#ffffff', card = dark ? '#080808' : '#f7f7f7';
  const paper2 = dark ? '#111111' : '#eeeeee', wash = dark ? '#1c1c1c' : '#e4e4e4';
  const bg = [paper, card, paper2, wash];
  const ink = fit(dark ? '#ededed' : '#1e1e1e', bg, 7, dark);
  const zhu = fit(dark ? '#ededed' : '#1e1e1e', bg, 4.5, dark);
  return {paper, 'paper-2': paper2, card, ink, 'ink-2': fit(dark ? '#c7c7c7' : '#454545', bg, 4.5, dark),
    'ink-3': fit(dark ? '#c7c7c7' : '#454545', bg, 4.5, dark), line: mix(paper, ink, .22), 'line-2': wash, zhu, 'zhu-soft': zhu,
    qing: fit(dark ? '#8fc1cc' : '#3c6b78', bg, 4.5, dark), gold: fit(dark ? '#d8b878' : '#8a6d33', bg, 4.5, dark),
    ok: fit(dark ? '#8fcf9a' : '#3f6e47', bg, 4.5, dark), 'on-accent': dark ? '#000000' : '#ffffff', 'on-ok': dark ? '#000000' : '#ffffff'};
}
function colors(p, dark) {
  if (p.neutral) return neutral(dark);
  // Expand the pastel wash's hue before dimming, so complementary palettes
  // do not collapse into gray at night. Preserve neutral washes if present.
  const channels = rgb(p.wash), low = Math.min(...channels), high = Math.max(...channels);
  const hue = high - low < 8 ? p.wash : '#' + channels.map(v =>
    Math.round(72 + (v - low) * 168 / (high - low)).toString(16).padStart(2, '0')).join('');
  const tint = mix(p.accent, hue, .8);
  const paper = dark ? mix('#101116', tint, .18) : mix(p.background, p.wash, .55);
  const card = dark ? mix('#191a21', tint, .23) : mix(p.surface, p.wash, .24);
  const paper2 = dark ? mix('#202128', tint, .26) : mix(p.commentSurface, p.wash, .32);
  const wash = dark ? mix('#262730', tint, .24) : p.wash;
  const bg = [paper, card, paper2, wash];
  const zhu = fit(dark ? p.accent : p.link, bg, 4.5, dark);
  const onAccent = contrast(zhu, '#ffffff') >= contrast(zhu, '#101116') ? '#ffffff' : '#101116';
  return {'paper':paper,'paper-2':paper2,card,'ink':fit(dark ? '#eee8e0' : p.text,bg,7,dark),
    'ink-2':fit(dark ? '#bdb9b4' : p.textMuted,bg,4.5,dark),'ink-3':fit(dark ? '#bdb9b4' : p.textMuted,bg,4.5,dark),
    line:dark ? mix('#45454b',tint,.28) : p.border,'line-2':wash,zhu,'zhu-soft':zhu,
    qing:fit('#3c6b78',bg,4.5,dark),gold:fit('#a9884a',bg,4.5,dark),ok:fit('#4a7a52',bg,4.5,dark),
    'on-accent':onAccent,'on-ok':dark ? '#101116' : '#ffffff'};
}
// ly.bdfz.net's token names, derived from the same colours, for the shared shell.
function tokens(c, dark) {
  return {'ui-bg': c.paper, 'ui-fg': c.ink, 'ui-surface': c.card, 'ui-shade': c['paper-2'], 'ui-muted': c['ink-2'],
    'ui-border': c.line, 'ui-control': fit(mix(c.paper, c.ink, .45), [c.paper, c.card, c['paper-2']], 3, dark),
    'ui-accent': c.zhu, 'ui-accent-text': c.zhu, 'ui-on-accent': c['on-accent'], 'ui-accent-soft': c['line-2'], 'ui-mark': c['line-2']};
}
const MODES = [['light', '淺色'], ['dark', '深色'], ['auto', '跟隨系統']];
const media = matchMedia('(prefers-color-scheme: dark)');
// Default follows ly.bdfz.net: 墨黑 in dark. Earlier explicit choices (hlm_appearance, legacy hlm_theme) are kept.
let pref = {palette:'ink',mode:'dark'};
try {
  const old = JSON.parse(localStorage.getItem('hlm_theme') || 'null');
  const saved = JSON.parse(localStorage.getItem('hlm_appearance') || 'null');
  if (['dark','light'].includes(old)) pref = {palette:'classic',mode:old};
  if (saved && typeof saved === 'object') pref = Object.assign({palette:'classic',mode:'auto'}, saved);
} catch (_) { }
if (!PALETTES.some(p=>p.id===pref.palette)) pref.palette='ink';
if (!['light','dark','auto'].includes(pref.mode)) pref.mode='dark';
const listeners = [];
function isDark() { return pref.mode==='dark'||(pref.mode==='auto'&&media.matches); }
function apply(persist) {
  const p=PALETTES.find(p=>p.id===pref.palette), dark=isDark();
  const root=document.documentElement,c=colors(p,dark);
  root.dataset.theme=dark?'dark':'light';root.dataset.palette=p.id;
  for (const [k,v] of Object.entries(c)) root.style.setProperty('--'+k,v);
  for (const [k,v] of Object.entries(tokens(c,dark))) root.style.setProperty('--'+k,v);
  root.style.setProperty('color-scheme', dark ? 'dark' : 'light');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',c.paper);
  if (persist) {try {localStorage.setItem('hlm_appearance',JSON.stringify(pref));} catch (_) {}}
  listeners.forEach(fn => { try { fn(state()); } catch (_) {} });
}
function state() {
  const at = PALETTES.findIndex(p=>p.id===pref.palette), p = PALETTES[at];
  const mode = MODES.find(m=>m[0]===pref.mode);
  return {palette:p.id, name:p.name, index:at, total:PALETTES.length, swatch:p.background, accent:p.accent,
    mode:pref.mode, modeName:mode[1], dark:isDark()};
}
// One button per setting (ly.bdfz.net): each press moves to the next choice.
function nextPalette() {
  const p = PALETTES[(PALETTES.findIndex(x=>x.id===pref.palette)+1)%PALETTES.length];
  pref = {palette:p.id, mode:p.id==='ink'?'dark':p.id==='paper'?'light':pref.mode};
  apply(true); return state();
}
function nextMode() {
  const at = MODES.findIndex(m=>m[0]===pref.mode);
  pref = {palette:pref.palette, mode:MODES[(at+1)%MODES.length][0]};
  apply(true); return state();
}
function onChange(fn) { listeners.push(fn); }
media.addEventListener('change',()=>{if(pref.mode==='auto')apply(false);});
window.HLMAppearance={palettes:PALETTES,colors,contrast,tokens,state,nextPalette,nextMode,onChange};
apply(false);
})();
