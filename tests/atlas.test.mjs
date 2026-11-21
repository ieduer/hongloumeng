// 圖譜資料的發布閘門：每條原文要在所標回目的正文裡找得到；所有顯示文字一律正體；
// 圖上出現的人物都有正體名稱；續書分界、紀年與人物命運的結構不變形。
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const json = p => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const atlas = json('data/study/atlas.json');
const text = n => json(`data/text/ch${String(n).padStart(3, '0')}.json`).content;
const source = json('data/hongloumeng.json').chapters.map(c => c.content);

function evidence() {
  const out = [];
  const add = (ch, ev, where, to) => out.push({ ch, to: to || ch, ev, where });
  atlas.plot.nodes.forEach(n => add(n.ch, n.ev, 'plot ' + n.t, n.to));
  atlas.plot.festivals.forEach(f => add(f.ch, f.ev, 'festival ' + f.k));
  atlas.fates.people.forEach(p => p.events.forEach(e => add(e.ch, e.ev, 'fate ' + p.id)));
  atlas.places.garden.places.forEach(p => (p.events || []).forEach(e => add(e.ch, e.ev, 'garden ' + p.id)));
  atlas.places.mansion.blocks.forEach(b => add(b.ch, b.ev, 'mansion ' + b.id));
  atlas.places.world.places.forEach(p => p.events.forEach(e => add(e.ch, e.ev, 'world ' + p.id)));
  atlas.places.world.fictional.forEach(f => add(f.ch, f.ev, 'fictional ' + f.label));
  atlas.places.world.journeys.forEach(j => add(j.ch, j.ev, 'journey ' + j.id, j.to));
  atlas.relations.family.nodes.forEach(n => n.ev && add(n.ev.ch, n.ev.text, 'family ' + n.id));
  atlas.relations.family.allies.forEach(a => { add(a.ch, a.ev, 'allies'); a.houses.forEach(h => add(a.ch, h.ev, 'house ' + h.id)); a.links.forEach(l => l.ev && add(l.ch, l.ev, 'ally link')); });
  atlas.relations.edges.forEach(e => e.ev && add(e.ch, e.ev, `edge ${e.a}-${e.b}`));
  atlas.chrono.anchors.forEach(a => add(a.ch, a.ev, 'anchor ' + a.when));
  atlas.chrono.ages.forEach(a => add(a.ch, a.ev, 'age ' + a.label));
  return out;
}

test('every quoted source string occurs in the stated chapter of the served text', () => {
  const rows = evidence();
  assert.ok(rows.length >= 380, 'evidence rows: ' + rows.length);
  for (const r of rows) {
    assert.ok(r.ev && r.ev.length >= 2, r.where + ' has no evidence');
    let found = false;
    for (let n = r.ch; n <= r.to; n++) if (text(n).replace(/\s+/g, '').includes(r.ev.replace(/\s+/g, '')) || source[n - 1].includes(r.ev)) found = true;
    assert.ok(found, `${r.where}: 「${r.ev}」 not in ${r.ch}${r.to !== r.ch ? '-' + r.to : ''}`);
  }
});

// Characters that exist only in simplified script (their traditional forms differ). Display text must not use them.
const SIMPLIFIED = '这们说时对为会来过还个经见门东车长马书话语读论记贝页风飞龙齐广应开关问间闻难双发头买卖实写园观儿乐历两举义亲传伤体剑动劝华单卫压厅县号吗员听响团围国图圣场块坚坠宁宝宫宽寿将岁师带帮库庄庙张弹强归录径忆忧怀态恋恶惊愿戏战扑扬扫抢护担拥择挂挥换据摆数断无显晓杀权条杨极楼欢汉没泪浅济渐湾满灭灯灵炉点炼烂烟烧热爱爷独狮献环现电画疯监盘码确种积称穷笔签简紧红约级纪纱纸纹线练组细织终绍经结绕给络绝统继续维绿缘编网罗罚聪肃胆脉脚脱腊艺节苍苏荐荣药莲获营蓝蔷虚虽补袄袭觉计认讨让训议讲许论设访证评识诉词试诗诚询该详误请诸谁调谈谋谓谜谢负财责贤败货质贪贫贯贵费贺贼资赋赌赏赐赖赵赶跃践转轮软轻载较辈辉输辞边达运进远违连迟选递遗邻郑释鉴钗钟钢钱铁银锁锦镜闪闭闲闷闸闹闺阁阅队阳阴阵阶际陆陈险随隐霁静韩项顺须顾顿预领题颜额飘饭饮馆驾骂验骑鬓鲁鲜鸟鸡鸣鸳鸯鹃黄龄凤贾琏兰钏莺纨兴芦';
const DISPLAY = new Set(['t', 'd', 'label', 'fate', 'note', 'summary', 'use', 'title', 'verdictSays', 'sequelWrites', 'match', 'omen', 'line', 'when', 'alias', 'method', 'levelNote', 'authorship', 'compareNote', 'familyNote', 'networkNote', 'gardenNote', 'mansionNote', 'worldNote', 'variantNote', 'routeNote', 'scheme', 'otherSchemes', 'anchorNote', 'ageNote', 'issue', 'access', 'topic', 'kind', 'real', 'minor', 'house', 'lane']);
function displayStrings(value, key, out) {
  if (typeof value === 'string') { if (DISPLAY.has(key)) out.push([key, value]); return out; }
  if (Array.isArray(value)) { value.forEach(v => displayStrings(v, key, out)); return out; }
  if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) displayStrings(v, k, out);
  return out;
}
test('display text in every atlas layer is Traditional Chinese', () => {
  const authored = ['plot', 'fates', 'places', 'relations', 'chrono', 'frontier'].map(n => json(`data/authored/atlas/${n}.json`));
  const bad = [];
  const strings = authored.flatMap(doc => displayStrings(doc, '', []));
  strings.push(...authored[5].items.map(i => ['who', i.who]));
  assert.ok(strings.length > 600, 'display strings: ' + strings.length);
  for (const [k, s] of strings) {
    const hit = [...s].filter(c => SIMPLIFIED.includes(c));
    if (hit.length) bad.push(`${k}: ${s.slice(0, 40)} [${hit.join('')}]`);
  }
  assert.deepEqual(bad, []);
  const kinds = { ...atlas.fates.meta.kinds, ...atlas.relations.meta.types };
  for (const v of Object.values(kinds)) assert.ok(![...v].some(c => SIMPLIFIED.includes(c)), v);
});

test('every person drawn on a chart has a Traditional display name', () => {
  const c = { window: {}, document: {} };
  vm.runInNewContext(readFileSync(new URL('assets/js/atlas.js', root), 'utf8'), c);
  const names = c.window.HLMAtlas.names;
  const ids = new Set([
    ...atlas.relations.network.nodes.map(n => n.id),
    ...atlas.fates.people.map(p => p.id),
    ...atlas.places.garden.places.flatMap(p => p.residents || []),
    ...atlas.places.world.journeys.map(j => j.who),
    ...atlas.chrono.ages.map(a => a.who),
    ...atlas.relations.edges.flatMap(e => [e.a, e.b]),
  ]);
  for (const id of ids) {
    assert.ok(names[id], 'missing display name for ' + id);
    assert.ok(![...names[id]].some(ch => SIMPLIFIED.includes(ch)), names[id]);
  }
});

test('structure: sequel boundary, fates, chronology and network stay coherent', () => {
  assert.equal(atlas.parts.at(-1).to, 120);
  assert.ok(atlas.plot.nodes.every((n, i, a) => !i || a[i - 1].ch < n.ch), 'plot nodes in chapter order');
  assert.ok(atlas.plot.nodes.some(n => n.ch === 18 && n.lv === 100), 'the visit is the peak');
  for (const p of atlas.fates.people) {
    assert.equal(p.events.filter(e => e.k === 'end').length, 1, p.id);
    assert.equal(p.end, p.events.find(e => e.k === 'end').ch, p.id);
    assert.ok(p.events.every((e, i, a) => !i || a[i - 1].ch <= e.ch), p.id + ' events in order');
  }
  const daiyu = atlas.fates.people.find(p => p.id === '林黛玉');
  assert.equal(daiyu.end, 98);
  assert.equal(atlas.fates.people.find(p => p.id === '晴雯').end, 78);
  const years = atlas.chrono.years;
  assert.equal(years.length, 20);
  assert.deepEqual([years[11].from, years[11].to], [18, 53]);
  assert.equal(years.at(-1).to, 120);
  for (const a of atlas.chrono.anchors) {
    const y = years.find(x => x.y === a.y);
    assert.ok(y.from <= a.ch && a.ch <= y.to, a.when);
  }
  const N = atlas.relations.network;
  assert.ok(N.nodes.length >= 44);
  assert.ok(N.nodes.every(n => n.x >= 0 && n.x <= N.w && n.y >= 0 && n.y <= N.h));
  assert.ok(N.cooc.every(([a, b, c]) => a < b && c >= 6));
  assert.ok(atlas.frontier.items.every(i => i.url.startsWith('https://')));
  assert.match(json('data/authored/atlas/plot.json').meta.authorship, /無名氏續，程偉元、高鶚整理/);
});

test('chart category colours keep 3:1 against page and card in all 20 palettes and both modes', () => {
  const c = { console, window: {}, localStorage: { getItem() { return null; }, setItem() {} }, matchMedia() { return { matches: false, addEventListener() {} }; },
    document: { documentElement: { dataset: {}, style: { setProperty() {} } }, querySelector() { return null; }, querySelectorAll() { return []; } } };
  vm.runInNewContext(readFileSync(new URL('assets/js/appearance.js', root), 'utf8'), c);
  const api = c.window.HLMAppearance, css = readFileSync(new URL('assets/css/atlas.css', root), 'utf8');
  const grab = sel => Object.fromEntries([...css.match(new RegExp(sel + '\\s*\\{([^}]+)\\}'))[1].matchAll(/--(c-[a-z]+):\s*(#[0-9a-f]{6})/g)].map(x => [x[1], x[2]]));
  const light = grab(':root'), dark = grab('html\\[data-theme="dark"\\]');
  assert.ok(Object.keys(light).length >= 9 && Object.keys(dark).length === Object.keys(light).length);
  for (const p of api.palettes) for (const d of [false, true]) {
    const t = api.tokens(api.colors(p, d), d);
    for (const [k, v] of Object.entries(d ? dark : light)) for (const bg of [t['ui-bg'], t['ui-surface']])
      assert.ok(api.contrast(v, bg) >= 3, `${p.id} ${d ? 'dark' : 'light'} ${k} on ${bg}`);
  }
});

test('index.html and app.js ship the same cache version for every changed asset', () => {
  const html = readFileSync(new URL('index.html', root), 'utf8');
  const app = readFileSync(new URL('assets/js/app.js', root), 'utf8');
  const V = app.match(/const V = 'v=(\d+)';/)[1];
  for (const asset of ['assets/css/study.css', 'assets/css/shell.css', 'assets/css/atlas.css', 'assets/js/appearance.js', 'assets/js/icons.js', 'assets/js/atlas.js', 'assets/js/app.js'])
    assert.ok(html.includes(`${asset}?v=${V}`), asset + ' must carry ?v=' + V);
  assert.match(html, /data-position="right"/);
  assert.ok(!html.includes('id="ai-fab"') && !html.includes('id="appearance"'), 'old floating button and dialog removed');
});
