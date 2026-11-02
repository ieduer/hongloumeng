#!/usr/bin/env node
// 石頭收服題庫建置：node scripts/play/build_bank.mjs [--check]
// 讀 scripts/play/content/（石靈卡、世界設定、撰寫題 q/*.json、真題原題 exam/*.json），
// 寫 play/bank/index.json、play/bank/<關卡>.json（前端）、functions/_shared/play/bank-index.js（伺服器重算對錯）、docs/play/AUDIT.md。
// 任一閘門不過即失敗、不寫任何輸出。同樣輸入重建出的版本雜湊相同。
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { BOOK, EVENTS, PEOPLE, POEMS } from "./content/cards.mjs";
import { FOES, RANKS, REGIONS } from "./content/world.mjs";
import { KINDS, checkQuestion } from "./check_facts.mjs";
import { ROOT, chapterText, examById, locate, norm, poemById, simplifiedIn, sourceOf } from "./lib/source.mjs";

const CHECK_ONLY = process.argv.includes("--check");
// --loose：本機預覽用，題量類閘門（每卡 3 題、每關 10 題、區域、正解分布）降為警告；發布一律不用
const LOOSE = process.argv.includes("--loose");
const warnings = [];
const C = (p) => path.join(ROOT, "scripts/play/content", p);
const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const sha = (s) => createHash("sha256").update(s).digest("hex");
const problems = [];
const fail = (m) => problems.push(m);
const soft = (m) => (LOOSE ? warnings.push(m) : problems.push(m));
const CN = "零一二三四五六七八九";
function cn(n) {
  if (n <= 10) return n === 10 ? "十" : CN[n];
  if (n < 20) return "十" + CN[n % 10];
  if (n < 100) return CN[Math.floor(n / 10)] + "十" + (n % 10 ? CN[n % 10] : "");
  const h = Math.floor(n / 100), r = n % 100;
  if (!r) return CN[h] + "百";
  if (r < 10) return CN[h] + "百零" + CN[r];
  return CN[h] + "百" + (r < 20 ? "一十" + (r % 10 ? CN[r % 10] : "") : cn(r));
}
const fnv = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

// ------------------------------------------------------------------ 石靈卡
const FAMILY = { r: "人", s: "詩", e: "事", b: "書" };
const cards = [];
for (const [id, name, src, tier] of PEOPLE) cards.push({ id, family: "人", name, tier, src, link: `/#/people/${encodeURIComponent(src)}` });
for (const [id, name, src, tier, ch, gloss] of POEMS) cards.push({ id, family: "詩", name, tier, ch, gloss, src: src || null, link: src && poemById(src) ? `/#/poems?q=${encodeURIComponent(poemById(src).title)}` : `/#/read/${ch}` });
for (const [id, name, ch, tier, gloss] of EVENTS) cards.push({ id, family: "事", name, tier, ch, gloss, link: `/#/read/${ch}` });
for (const [id, name, ch, tier, gloss] of BOOK) cards.push({ id, family: "書", name, tier, ch, gloss, link: id === "b-xushu" ? "/#/method" : `/#/read/${ch}` });
const cardById = new Map(cards.map((c) => [c.id, c]));
// 詩詞出處標籤用繁體卡名（判詞、十二支曲與名篇卡的 src 就是 poems.json 的 id）；沒有卡的詩照原題名
const poemCardName = new Map(cards.filter((c) => c.family === "詩" && c.src).map((c) => [c.src, c.name]));
const poemName = (id) => poemCardName.get(id) || poemById(id).title;
const people = readJSON(path.join(ROOT, "data/authored/people.json"));
for (const c of cards.filter((c) => c.family === "人")) {
  const p = people.find((x) => x.name === c.src);
  if (!p) fail(`人物卡 ${c.id} 在 people.json 找不到 ${c.src}`);
  else {
    c.gloss = p.tagline;
    c.glossLang = "zh-Hans";
    c.ch = p.firstChapter;
  }
}
for (const c of cards) {
  const bad = simplifiedIn(c.name + (c.glossLang ? "" : c.gloss || ""));
  if (bad.length) fail(`卡 ${c.id} 名稱或說明有簡體字：${bad.join("")}`);
}

// ------------------------------------------------------------------ 撰寫題
const qdir = C("q");
const files = fs.existsSync(qdir) ? fs.readdirSync(qdir).filter((f) => f.endsWith(".json") && !f.endsWith(".review.json") && !f.startsWith("_")).sort() : [];
const seenIds = new Set();
const authored = [];
for (const f of files) {
  const doc = readJSON(path.join(qdir, f));
  for (const q of doc.questions || []) {
    const errs = checkQuestion(q, seenIds);
    if (errs.length) errs.forEach((e) => fail(`${f}: ${e}`));
    else authored.push({ ...q, file: f });
  }
}

function evidenceView(ev) {
  const src = sourceOf(ev);
  const hit = src && locate(src.text, ev.text);
  if (!hit) return null;
  if (Number.isInteger(ev.ch)) return { label: `第${cn(ev.ch)}回`, text: hit.slice, lang: "zh-Hans", href: `/#/read/${ev.ch}` };
  if (ev.poem) {
    const p = poemById(ev.poem);
    const inLines = Boolean(locate((p.lines || []).join("\n"), ev.text));
    return { label: `〈${poemName(ev.poem)}〉${inLines ? "" : "註解"}`, text: hit.slice, lang: "zh-Hans", href: `/#/poems?q=${encodeURIComponent(p.title)}` };
  }
  if (ev.exam) return { label: examById(ev.exam).label, text: hit.slice, lang: ev.exam.startsWith("tw-") ? "zh-Hant" : "zh-Hans", href: ev.exam.startsWith("bj") ? `/#/exam` : null };
  if (ev.doc) return { label: { method: "本站〈讀法〉", people: "本站人物頁", research: "本站研究考點" }[ev.doc], text: hit.slice, lang: "zh-Hans", href: ev.doc === "method" ? "/#/method" : null };
  return null;
}
function quoteView(q) {
  if (q.quote == null) return null;
  const src = sourceOf(q.quoteSrc);
  const hit = locate(src.text, q.quote);
  const label = Number.isInteger(q.quoteSrc.ch) ? `第${cn(q.quoteSrc.ch)}回` : q.quoteSrc.poem ? `〈${poemName(q.quoteSrc.poem)}〉` : examById(q.quoteSrc.exam).label;
  return { text: hit.slice, lang: q.quoteSrc.exam?.startsWith("tw-") ? "zh-Hant" : "zh-Hans", label };
}

const questions = [];
// 真題改編題的出處：第一條真題證據決定落在北京卷、指考或各地高考哪一關，以及年份
const gkItems = fs.existsSync(C("exam/gaokao.json")) ? new Map(readJSON(C("exam/gaokao.json")).questions.map((g) => [g.id, g])) : new Map();
function examOrigin(q) {
  const ev = (q.evidence || []).find((e) => e.exam);
  if (!ev) return null;
  if (ev.exam.startsWith("bj")) return { kind: "beijing", year: Number(ev.exam.slice(2, 6)), label: `北京卷 ${ev.exam.slice(2, 6)} 改編` };
  if (ev.exam.startsWith("tw-")) {
    const z = readJSON(C("exam/zhikao.json")).questions.find((x) => x.id === ev.exam);
    return z ? { kind: "zhikao", year: Number(z.year_num || String(z.year).replace(/\D/g, "")) + 1911, label: `指考 ${z.year} 學年度改編` } : null;
  }
  const g = gkItems.get(ev.exam);
  return g ? { kind: "gaokao", year: g.year, label: `${g.paper} ${g.year} 改編` } : null;
}
for (const q of authored) {
  // 正解位置依題號雜湊決定（洗牌在幾百題規模仍會偏），選項代號：正解 a，干擾項 d0–d2
  const pos = fnv(q.id) % 4;
  const opts = q.options.slice(1).map((text, i) => ({ id: `d${i}`, text }));
  opts.splice(pos, 0, { id: "a", text: q.options[0] });
  if (q.optionsSource) {
    const order = q.options.slice(1).map((_, i) => i + 1);
    order.splice(pos, 0, 0);
    opts.forEach((o, i) => {
      o.lang = "zh-Hans";
      o.text = locate(sourceOf(q.optionsSource[order[i]]).text, o.text).slice;
    });
  }
  const card = cardById.get(q.card);
  const out = {
    id: q.id,
    kind: q.kind,
    type: KINDS[q.kind],
    card: q.card,
    ch: q.ch,
    tier: q.tier || card.tier,
    prompt: q.prompt,
    quote: quoteView(q),
    options: opts,
    answer: pos,
    explain: { text: q.explain, evidence: q.evidence.map(evidenceView).filter(Boolean) },
  };
  if (q.kind === "exam-adapted") {
    const o = examOrigin(q);
    if (!o) fail(`${q.id}: 真題改編必須引用真題證據（{exam}）`);
    else {
      out.year = o.year;
      out.exam = { kind: o.kind, adapted: true, label: o.label };
    }
  }
  questions.push(out);
}

// ------------------------------------------------------------------ 真題原題
const EXAM_CARD = {
  "tw-91-10": ["s-liuxu", 70], "tw-91-11": ["s-liuxu", 70], "tw-93-12": ["r-daiyu", 3], "tw-93-bu-27": ["b-genre", 1], "tw-94-13": ["e-diaobao", 97],
  "tw-95-12": ["e-erjin", 40], "tw-99-24": ["r-liulaolao", 40], "tw-101-8": ["b-structure", 120], "tw-103-8": ["b-names", 1], "tw-106-21": ["r-baoyu", 3],
  "tw-107-41": ["e-doucao", 62], "tw-107-42": ["e-doucao", 62], "tw-109-20": ["e-jinfu", 3], "tw-109-21": ["e-jinfu", 3], "tw-109-22": ["e-jinfu", 3], "tw-109-23": ["e-jinfu", 3],
  "tw-109-bu-39": ["b-hongxue", 1],
  "bj2005-15": ["b-hongxue", null], "bj2014-4c": ["s-lianju", 76], "bj2017-fw6": ["r-baoyu", 23],
};
const zk = readJSON(C("exam/zhikao.json")).questions;
const zkExplain = readJSON(C("exam/zhikao-explain.json")).items;
for (const z of zk) {
  const [cardId, ch] = EXAM_CARD[z.id] || [];
  if (!cardId) {
    fail(`指考 ${z.id} 沒有指定石靈卡`);
    continue;
  }
  const answer = String(z.official_answer || "").trim();
  const keys = z.options.map((o) => o.key || o.label);
  if (!/^[A-E]{1,5}$/.test(answer) || [...answer].some((k) => !keys.includes(k))) fail(`指考 ${z.id} 官方答案異常：${answer}`);
  const ex = zkExplain[z.id];
  if (!ex) fail(`指考 ${z.id} 缺解析（exam/zhikao-explain.json）`);
  else if (simplifiedIn(ex).length) fail(`指考 ${z.id} 解析有簡體字：${simplifiedIn(ex).join("")}`);
  const multi = answer.length > 1;
  questions.push({
    id: z.id,
    kind: "exam",
    type: 4,
    card: cardId,
    ch,
    tier: cardById.get(cardId)?.tier || "SR",
    prompt: z.stem,
    promptLang: "zh-Hant",
    passage: z.reading_passage ? { text: z.reading_passage, lang: "zh-Hant", label: `${z.year_label} 第 ${z.q_num} 題` } : null,
    image: z.id === "tw-109-20" ? { src: "art/exam-109-20-map.png", alt: "原卷宅院示意圖：宅院甲、乙、丙由西向東排列，甲之南為角門，乙之南為正門", w: 822, h: 296 } : null,
    options: z.options.map((o) => ({ id: o.key || o.label, text: o.text, lang: "zh-Hant" })),
    letters: true,
    multi,
    answer: multi ? null : keys.indexOf(answer),
    answers: multi ? [...answer].map((k) => keys.indexOf(k)) : null,
    answerId: [...answer].sort().join(""),
    exam: { kind: "zhikao", label: `指考 ${z.year_label.replace("學年度指定科目考試", " 學年度")} 第 ${z.q_num} 題${multi ? "（多選）" : ""}`, answerSource: "大考中心公布答案" },
    explain: { text: ex || "", evidence: [] },
  });
}
const bj = readJSON(path.join(ROOT, "data/study/exams.json")).items;
for (const id of ["bj2005-15", "bj2014-4c", "bj2017-fw6"]) {
  const it = bj.find((x) => x.id === id);
  const [cardId, ch] = EXAM_CARD[id];
  const keys = it.options.map((o) => o.key);
  const stem = it.stem.split(/\n?A．/)[0].trim();
  questions.push({
    id,
    kind: "exam",
    type: 4,
    card: cardId,
    ch,
    tier: cardById.get(cardId)?.tier || "SR",
    prompt: stem,
    promptLang: "zh-Hans",
    passage: it.material?.text && id !== "bj2014-4c" && id !== "bj2017-fw6" ? { text: it.material.text, lang: "zh-Hans", label: it.material.source } : null,
    options: it.options.map((o) => ({ id: o.key, text: o.text, lang: "zh-Hans" })),
    letters: true,
    multi: false,
    answer: keys.indexOf(it.answer.trim()),
    answerId: it.answer.trim(),
    exam: { kind: "beijing", label: `北京卷 ${it.year}`, answerSource: it.answerSource },
    explain: { text: it.analysis, lang: "zh-Hans", evidence: [] },
    year: it.year,
  });
  if (keys.indexOf(it.answer.trim()) < 0) fail(`北京卷 ${id} 答案不在選項：${it.answer}`);
}
const gkPath = C("exam/gaokao.json");
if (fs.existsSync(gkPath)) {
  for (const g of readJSON(gkPath).questions.filter((g) => ["mc", "multi"].includes(g.format) && ["confirmed", "single_source"].includes(g.verify))) {
    if (!cardById.has(g.card)) fail(`高考 ${g.id} 石靈卡不存在：${g.card}`);
    const keys = g.options.map((o) => o.key);
    const multi = g.answer.length > 1;
    if ([...g.answer].some((k) => !keys.includes(k))) fail(`高考 ${g.id} 答案不在選項`);
    if (simplifiedIn(g.explain).length) fail(`高考 ${g.id} 解析有簡體字`);
    questions.push({
      id: g.id,
      kind: "exam",
      type: 4,
      card: g.card,
      ch: g.ch ?? null,
      tier: cardById.get(g.card)?.tier || "SR",
      prompt: g.stem,
      promptLang: "zh-Hans",
      passage: g.passage ? { text: g.passage, lang: "zh-Hans", label: g.label } : null,
      options: g.options.map((o) => ({ id: o.key, text: o.text, lang: "zh-Hans" })),
      letters: true,
      multi,
      answer: multi ? null : keys.indexOf(g.answer),
      answers: multi ? [...g.answer].map((k) => keys.indexOf(k)) : null,
      answerId: [...g.answer].sort().join(""),
      exam: { kind: "gaokao", label: g.label, answerSource: g.answerSource },
      explain: { text: g.explain, evidence: [], sources: g.sources },
      year: g.year,
    });
  }
}

// ------------------------------------------------------------------ 關卡
const stages = [];
const byStage = new Map();
const TARGET = 16, MIN = 10;
const cardOrder = new Map(cards.map((c, i) => [c.id, i]));
function chunk(list, regionId, titleOf) {
  // 平均切成 k 關（每關題數相差至多 1），避免最後一關太短
  const k = Math.max(1, Math.min(Math.round(list.length / TARGET), Math.floor(list.length / MIN)) || 1);
  for (let i = 0; i < k; i++) {
    const part = list.slice(Math.round((i * list.length) / k), Math.round(((i + 1) * list.length) / k));
    if (!part.length) continue;
    const id = `${regionId}-${i + 1}`;
    const { title, sub } = titleOf(part, i);
    stages.push({ id, region: regionId, title, sub, count: part.length });
    byStage.set(id, part);
    part.forEach((q) => (q.stage = id));
  }
}
// 關卡副題只用情節卡名（情節題問的是誰、為何，答案不會是情節名），避免副題洩題；沒有情節卡就用區域名
const repCard = (part, regionName) => {
  const tally = new Map();
  for (const q of part) if (cardById.get(q.card)?.family === "事") tally.set(q.card, (tally.get(q.card) || 0) + 1);
  if (!tally.size) {
    const chs = [...new Set(part.map((q) => q.ch))];
    const ev = EVENTS.find(([, , ch]) => chs.includes(ch));
    return ev ? ev[1] : regionName;
  }
  const best = [...tally.entries()].sort((a, b) => b[1] - a[1] || cardOrder.get(a[0]) - cardOrder.get(b[0]))[0][0];
  return cardById.get(best).name;
};
for (const r of REGIONS.filter((r) => r.id !== "exam")) {
  const list = questions
    .filter((q) => q.kind !== "exam" && q.kind !== "exam-adapted" && q.ch >= r.from && q.ch <= r.to)
    .sort((a, b) => a.ch - b.ch || cardOrder.get(a.card) - cardOrder.get(b.card) || (a.id < b.id ? -1 : 1));
  if (list.length < MIN) {
    soft(`區域 ${r.name} 只有 ${list.length} 題，不足一關`);
    if (!LOOSE || !list.length) continue;
  }
  chunk(list, r.id, (part) => {
    const lo = part[0].ch, hi = part[part.length - 1].ch;
    return { title: lo === hi ? `第${cn(lo)}回` : `第${cn(lo)}至${cn(hi)}回`, sub: repCard(part, r.name) };
  });
}
const examQ = questions.filter((q) => q.kind === "exam" || q.kind === "exam-adapted");
const bjAll = examQ.filter((q) => q.exam?.kind === "beijing").sort((a, b) => a.year - b.year || (a.id < b.id ? -1 : 1));
chunk(bjAll, "bj", (part) => {
  const lo = part[0].year, hi = part[part.length - 1].year;
  return { title: lo === hi ? `北京卷 ${lo}` : `北京卷 ${lo}–${hi}`, sub: "原題與官方答案改編" };
});
const zkAll = examQ.filter((q) => q.exam?.kind === "zhikao").sort((a, b) => a.year - b.year || (a.id < b.id ? -1 : 1));
const gkAll = examQ.filter((q) => q.exam?.kind === "gaokao").sort((a, b) => a.year - b.year || (a.id < b.id ? -1 : 1));
if (gkAll.length >= MIN) {
  chunk(zkAll, "zk", () => ({ title: "指考 91–109", sub: "大考中心原題" }));
  chunk(gkAll, "gk", (part) => ({ title: `各地高考 ${part[0].year}–${part[part.length - 1].year}`, sub: "全國卷與各省卷" }));
} else {
  chunk([...zkAll, ...gkAll], "zk", () => ({ title: gkAll.length ? "指考與各地高考" : "指考 91–109", sub: "原題原答案" }));
}
const ORD = "一二三四五六七八九十";
const dupKey = new Map();
for (const s of stages) dupKey.set(s.title + s.sub, (dupKey.get(s.title + s.sub) || 0) + 1);
const dupSeen = new Map();
for (const s of stages)
  if (dupKey.get(s.title + s.sub) > 1) {
    const k = (dupSeen.get(s.title + s.sub) || 0) + 1;
    dupSeen.set(s.title + s.sub, k);
    s.sub = `${s.sub}・其${ORD[k - 1]}`;
  }
const examRegionStages = stages.filter((s) => ["bj", "zk", "gk"].includes(s.region));
examRegionStages.forEach((s) => (s.region = "exam"));
for (const s of stages) if (s.count < MIN) soft(`關卡 ${s.id} 只有 ${s.count} 題（每關至少 ${MIN} 題才能通關）`);
// 關主：依關卡輪流分配誤讀妖；真題殿與每區最後一關用大妖圖
stages.forEach((s, i) => {
  s.foe = FOES[i % FOES.length].id;
  const sameRegion = stages.filter((x) => x.region === s.region);
  s.boss = s.region === "exam" || sameRegion[sameRegion.length - 1] === s;
});

// ------------------------------------------------------------------ 閘門
const perCard = new Map(cards.map((c) => [c.id, 0]));
for (const q of questions) perCard.set(q.card, (perCard.get(q.card) || 0) + 1);
for (const [id, n] of perCard) if (n < 3) soft(`石靈 ${cardById.get(id)?.name || id} 只有 ${n} 題（至少 3 題才能識得）`);
const ids = new Set();
for (const q of questions) {
  if (ids.has(q.id)) fail(`題號重複：${q.id}`);
  ids.add(q.id);
  if (!q.stage) fail(`題目 ${q.id} 沒有落到任何一關`);
}
// 同一事實：正解與題幹引文（或題幹）相同視為重複
const sig = new Map();
for (const q of questions.filter((q) => q.kind !== "exam")) {
  const key = norm(q.options.find((o) => o.id === "a").text) + "|" + norm(q.quote?.text || q.prompt);
  if (sig.has(key)) fail(`疑似重複：${q.id} 與 ${sig.get(key)}`);
  sig.set(key, q.id);
}
const posCount = [0, 0, 0, 0];
for (const q of questions.filter((q) => q.kind !== "exam")) posCount[q.answer]++;
const genTotal = posCount.reduce((a, b) => a + b, 0);
if (genTotal && posCount.some((n) => n / genTotal < 0.18 || n / genTotal > 0.32)) soft(`正解位置分布不均：${posCount.join("/")}`);

if (warnings.length) console.error(`LOOSE preview: ${warnings.length} count gate(s) skipped`);
if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\nFAILED: ${problems.length} problem(s)`);
  process.exit(1);
}

// ------------------------------------------------------------------ 輸出
const clientQ = (q) => {
  const { file, answerId, ...rest } = q;
  return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== null && v !== undefined));
};
const regions = REGIONS.map((r) => ({ id: r.id, name: r.name, desc: r.desc, map: r.map, from: r.from ?? null, to: r.to ?? null, stages: stages.filter((s) => s.region === r.id).map((s) => s.id) }));
const shards = {};
for (const s of stages) shards[s.id] = byStage.get(s.id).map(clientQ);
const payload = JSON.stringify({ cards, ranks: RANKS, regions, stages, foes: FOES, shards });
const version = (LOOSE ? "x" : "") + sha(payload).slice(0, LOOSE ? 11 : 12);
const index = { version, cards, ranks: RANKS, regions, stages, foes: FOES };
const server = {
  version,
  q: Object.fromEntries(questions.map((q) => [q.id, [q.answerId || "a", q.tier, q.type, q.card, q.stage]])),
  cards: Object.fromEntries(cards.map((c) => [c.id, { t: c.tier }])),
  stages: stages.map((s) => s.id),
  regions: Object.fromEntries(regions.map((r) => [r.id, r.stages])),
  ranks: RANKS.map((r) => r.need),
};
const stat = (arr, key) => arr.reduce((m, x) => ((m[key(x)] = (m[key(x)] || 0) + 1), m), {});
// 真題覆蓋：每一道涉及《紅樓夢》的真題，都要至少有一題用到它（原題，或以它為證據的改編題）
const examUse = new Map();
const useExam = (id, qid) => examUse.set(id, [...(examUse.get(id) || []), qid]);
for (const q of questions) {
  if (q.kind === "exam") useExam(q.id, q.id);
  for (const ev of authored.find((a) => a.id === q.id)?.evidence || []) if (ev.exam) useExam(ev.exam, q.id);
}
const examList = [
  ...bj.map((it) => ({ id: it.id, label: `北京卷 ${it.year}（${it.type}，${it.tier}）` })),
  ...zk.map((z) => ({ id: z.id, label: `指考 ${z.year_label} 第 ${z.q_num} 題` })),
  ...[...gkItems.values()].map((g) => ({ id: g.id, label: g.label })),
];
const uncovered = examList.filter((e) => !examUse.has(e.id));
const audit = [
  `# 石頭收服題庫審計（版本 ${version}）`,
  "",
  `由 \`node scripts/play/build_bank.mjs\` 產生，手改必失。`,
  "",
  `- 石靈 ${cards.length} 張：${Object.entries(stat(cards, (c) => c.family)).map(([k, v]) => `${k} ${v}`).join("、")}`,
  `- 題目 ${questions.length} 題：撰寫 ${authored.length}（${files.join("、")}）、真題原題 ${questions.filter((q) => q.kind === "exam").length}`,
  `- 關卡 ${stages.length} 關、區域 ${regions.length} 區；正解位置（撰寫題）${posCount.join("／")}`,
  "",
  "## 題型",
  "",
  "| 題型 | 題數 |",
  "| --- | ---: |",
  ...Object.entries(stat(questions, (q) => q.kind)).sort().map(([k, v]) => `| ${k} | ${v} |`),
  "",
  "## 關卡",
  "",
  "| 關卡 | 區域 | 標題 | 題數 |",
  "| --- | --- | --- | ---: |",
  ...stages.map((s) => `| ${s.id} | ${regions.find((r) => r.id === s.region).name} | ${s.title}・${s.sub} | ${s.count} |`),
  "",
  "## 真題覆蓋",
  "",
  `涉及《紅樓夢》的真題 ${examList.length} 道，已用到 ${examList.length - uncovered.length} 道。`,
  "",
  "| 真題 | 用到的題 |",
  "| --- | --- |",
  ...examList.map((e) => `| ${e.label}（${e.id}） | ${(examUse.get(e.id) || []).join("、") || "**未用**"} |`),
  "",
  "## 石靈題數",
  "",
  "| 卡 | 族 | 名 | 題數 |",
  "| --- | --- | --- | ---: |",
  ...cards.map((c) => `| ${c.id} | ${c.family} | ${c.name} | ${perCard.get(c.id)} |`),
  "",
].join("\n");

if (CHECK_ONLY) {
  console.log(JSON.stringify({ ok: true, version, questions: questions.length, stages: stages.length, cards: cards.length }));
  process.exit(0);
}
const out = path.join(ROOT, "play/bank");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "index.json"), JSON.stringify(index) + "\n");
for (const [id, list] of Object.entries(shards)) fs.writeFileSync(path.join(out, `${id}.json`), JSON.stringify({ version, stage: id, questions: list }) + "\n");
fs.writeFileSync(path.join(ROOT, "functions/_shared/play/bank-index.js"), `// 由 scripts/play/build_bank.mjs 產生，手改必失。伺服器用它重算對錯：q → [正解代號, 稀有度, 題型, 石靈卡, 關卡]\nexport default ${JSON.stringify(server)};\n`);
fs.mkdirSync(path.join(ROOT, "docs/play"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "docs/play/AUDIT.md"), audit);
console.log(JSON.stringify({ ok: true, version, questions: questions.length, stages: stages.length, cards: cards.length, positions: posCount, exams: examList.length, uncoveredExams: uncovered.map((e) => e.id) }));
