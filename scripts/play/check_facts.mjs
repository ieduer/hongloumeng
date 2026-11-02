#!/usr/bin/env node
// 檢查一個或多個題目檔：node scripts/play/check_facts.mjs scripts/play/content/q/*.json
// 每題：卡片存在、回次合法、題幹選項解析為繁體、引文與證據逐字出自所註來源、選項不重複、正解在 options[0]。
import fs from "node:fs";
import { BOOK, EVENTS, PEOPLE, POEMS } from "./content/cards.mjs";
import { locate, norm, simplifiedIn, sourceOf } from "./lib/source.mjs";

export const KINDS = {
  // 0：短答（稱號、住處、丫鬟、花簽）；1：判詞曲詞與詩句；2：情節；3：判斷（先後、因果、常識）；5：真題改編
  alias: 0, home: 0, maid: 0, flower: 0, relation: 0,
  panci: 1, "panci-line": 1, "panci-hua": 1, qu: 1, "qu-line": 1, "poem-author": 1, "poem-line": 1, "poem-occasion": 1, quote: 1,
  scene: 2, event: 2, object: 2, place: 2,
  order: 3, cause: 3, book: 3, theme: 3, misread: 3,
  "exam-adapted": 5,
};
const CARD_IDS = new Set([...PEOPLE.map((x) => x[0]), ...POEMS.map((x) => x[0]), ...EVENTS.map((x) => x[0]), ...BOOK.map((x) => x[0])]);
const ID_RE = /^[a-z0-9][a-z0-9-]{2,60}$/;

export function checkQuestion(q, seenIds) {
  const errs = [];
  const err = (m) => errs.push(`${q?.id || "?"}: ${m}`);
  if (!q || typeof q !== "object") return ["not an object"];
  if (!ID_RE.test(q.id || "")) err("id 只用小寫英數與連字號");
  if (seenIds.has(q.id)) err("id 重複");
  seenIds.add(q.id);
  if (!CARD_IDS.has(q.card)) err(`card 不存在：${q.card}`);
  if (!(q.kind in KINDS)) err(`kind 不在清單：${q.kind}`);
  if (!Number.isInteger(q.ch) || q.ch < 1 || q.ch > 120) err("ch 必須是 1–120 的整數");
  if (typeof q.prompt !== "string" || !q.prompt.trim() || q.prompt.length > 70) err("prompt 必填、70 字內");
  if (!Array.isArray(q.options) || q.options.length !== 4) err("options 必須正好 4 項");
  else {
    if (q.options.some((o) => typeof o !== "string" || !o.trim() || o.length > 60)) err("選項必須是 1–60 字的字串");
    if (new Set(q.options.map(norm)).size !== 4) err("選項重複");
  }
  if (typeof q.explain !== "string" || q.explain.length < 8 || q.explain.length > 200) err("explain 8–200 字");
  // 本站撰寫的文字必須是繁體（選項若是原文詩句，標 optionsSource）
  const authored = [q.prompt, q.explain, ...(q.optionsSource ? [] : q.options || [])].join("");
  const bad = simplifiedIn(authored);
  if (bad.length) err(`撰寫文字出現簡體字：${bad.join("")}`);
  // 題幹引文
  if (q.quote != null) {
    const src = sourceOf(q.quoteSrc);
    if (!src) err("quote 必須附 quoteSrc（{ch} 或 {poem}）");
    else if (!locate(src.text, q.quote)) err(`quote 不在 ${src.label}：${q.quote.slice(0, 30)}`);
  }
  // 選項若是原文摘句：逐項核對來源
  if (q.optionsSource) {
    if (!Array.isArray(q.optionsSource) || q.optionsSource.length !== 4) err("optionsSource 必須 4 項");
    else
      q.optionsSource.forEach((ref, i) => {
        const src = sourceOf(ref);
        if (!src) err(`optionsSource[${i}] 來源無效`);
        else if (!locate(src.text, q.options[i])) err(`選項 ${i} 不在 ${src.label}：${q.options[i]}`);
      });
  }
  // 證據：至少一條，逐字出自所註來源，至少 6 個漢字
  if (!Array.isArray(q.evidence) || !q.evidence.length) err("至少一條 evidence");
  else if (q.evidence.every((ev) => ev && ev.doc)) err("至少一條 evidence 要來自原文或真題（不能全是本站撰寫層）");
  else
    q.evidence.forEach((ev, i) => {
      const src = sourceOf(ev);
      if (!src) return err(`evidence[${i}] 來源無效（需 {ch, text} 或 {poem, text}）`);
      if (norm(ev.text).length < 6) return err(`evidence[${i}] 太短`);
      if (!locate(src.text, ev.text)) err(`evidence[${i}] 不在 ${src.label}：${String(ev.text).slice(0, 30)}`);
      if (src.doc && !(String(q.card).startsWith("b-") || q.kind === "exam-adapted")) err(`evidence[${i}] 本站撰寫層只能給「書」類卡或真題改編當證據`);
    });
  return errs;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === new URL(import.meta.url).pathname) {
  const files = process.argv.slice(2);
  const seen = new Set();
  let n = 0, bad = 0;
  for (const f of files) {
    const doc = JSON.parse(fs.readFileSync(f, "utf8"));
    for (const q of doc.questions || []) {
      n++;
      const errs = checkQuestion(q, seen);
      if (errs.length) {
        bad++;
        for (const e of errs) console.log(`${f}: ${e}`);
      }
    }
  }
  console.log(`checked ${n} questions, ${bad} with problems`);
  process.exit(bad ? 1 : 0);
}
