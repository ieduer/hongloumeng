#!/usr/bin/env node
// 把研究流程逐題核對的結果（ALL.json：每題至少兩個不同網域的網頁抄錄）整理成 scripts/play/content/exam/gaokao.json 的來源快照。
// 用法：node scripts/play/tools/ingest_gaokao.mjs <ALL.json> <cards.json（人工指定的石靈卡與回次）> [--write]
// 只收 status=confirmed（兩源一致）；single_source 只列出、不收。題面一律照網頁所見簡體原文，不改字。
import fs from "node:fs";
import path from "node:path";

const [allPath, mapPath] = process.argv.slice(2);
const WRITE = process.argv.includes("--write");
const all = JSON.parse(fs.readFileSync(allPath, "utf8"));
const map = mapPath && fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, "utf8")) : {};
const PAPER = {
  全国卷: ["quanguo", "全國卷"], 全国I卷: ["quanguo1", "全國Ⅰ卷"], 全国Ⅰ卷: ["quanguo1", "全國Ⅰ卷"], 全国II卷: ["quanguo2", "全國Ⅱ卷"], 全国Ⅱ卷: ["quanguo2", "全國Ⅱ卷"], 全国III卷: ["quanguo3", "全國Ⅲ卷"], 全国Ⅲ卷: ["quanguo3", "全國Ⅲ卷"],
  全国甲卷: ["jia", "全國甲卷"], 全国乙卷: ["yi", "全國乙卷"], 新高考I卷: ["xin1", "新高考Ⅰ卷"], 新高考Ⅰ卷: ["xin1", "新高考Ⅰ卷"], 新高考II卷: ["xin2", "新高考Ⅱ卷"], 新高考Ⅱ卷: ["xin2", "新高考Ⅱ卷"], 新课标I卷: ["xin1", "新課標Ⅰ卷"], 新课标II卷: ["xin2", "新課標Ⅱ卷"],
  江苏卷: ["jiangsu", "江蘇卷"], 上海卷: ["shanghai", "上海卷"], 天津卷: ["tianjin", "天津卷"], 浙江卷: ["zhejiang", "浙江卷"], 福建卷: ["fujian", "福建卷"], 湖南卷: ["hunan", "湖南卷"], 湖北卷: ["hubei", "湖北卷"],
  四川卷: ["sichuan", "四川卷"], 重庆卷: ["chongqing", "重慶卷"], 山东卷: ["shandong", "山東卷"], 安徽卷: ["anhui", "安徽卷"], 广东卷: ["guangdong", "廣東卷"], 辽宁卷: ["liaoning", "遼寧卷"], 江西卷: ["jiangxi", "江西卷"], 陕西卷: ["shaanxi", "陝西卷"],
};
const norm = (s) => String(s || "").replace(/\s/g, "").replace(/卷$/, "卷");
const out = [], skipped = [];
for (const v of all) {
  const key = Object.keys(PAPER).find((k) => norm(v.paper).includes(norm(k).replace(/卷$/, "")) && norm(v.paper).endsWith("卷")) || Object.keys(PAPER).find((k) => norm(v.paper) === norm(k));
  if (v.status !== "confirmed" || !key || /北京/.test(v.paper)) {
    skipped.push({ year: v.year, paper: v.paper, section: v.section, qno: v.qno, status: v.status, reason: !key ? "unknown paper" : v.status });
    continue;
  }
  const [slug, trad] = PAPER[key];
  const qno = String(v.qno || "").replace(/[^0-9a-zA-Z]+/g, "-").replace(/^-|-$/g, "") || "x";
  const id = `gk-${v.year}-${slug}-${qno}`.toLowerCase();
  const options = Array.isArray(v.options) && v.options.length >= 4 ? v.options.map((o) => ({ key: String(o.key).trim().replace(/[．.、]/g, ""), text: String(o.text).trim() })) : null;
  const letters = String(v.answer || "").replace(/[^A-E]/g, "");
  const format = options && letters && letters.length <= 5 && [...letters].every((k) => options.some((o) => o.key === k)) ? (letters.length > 1 ? "multi" : "mc") : /作文/.test(v.section) ? "essay" : "short";
  const m = map[id] || {};
  out.push({
    id, year: v.year, paper: trad, section: v.section, qno: v.qno || "", score: v.score || null,
    label: `${trad} ${v.year}${v.qno ? ` 第 ${v.qno} 題` : `（${v.section}）`}`,
    format, material: null, stem: v.stem, options, answer: format === "mc" || format === "multi" ? [...letters].sort().join("") : null,
    answerText: v.answer, answerSource: v.answer_source || "", relation: v.honglou_relation || "", chapters: v.chapters || [],
    sources: v.urls, verify: v.status, differences: v.differences || "", card: m.card || null, ch: m.ch ?? null, explain: m.explain || null,
  });
}
out.sort((a, b) => a.year - b.year || (a.id < b.id ? -1 : 1));
const ids = new Set();
for (const g of out) { if (ids.has(g.id)) g.id += "-b"; ids.add(g.id); }
console.log(JSON.stringify({ kept: out.length, skipped: skipped.length, mc: out.filter((g) => g.format !== "short" && g.format !== "essay").length }, null, 0));
for (const s of skipped) console.log("skip", s.year, s.paper, s.section, s.qno, s.reason);
for (const g of out) console.log("keep", g.id, g.format, g.label, "|", String(g.stem).slice(0, 50).replace(/\n/g, " "));
if (WRITE) {
  const dest = path.resolve(new URL("../content/exam/gaokao.json", import.meta.url).pathname);
  fs.writeFileSync(dest, JSON.stringify({ note: "北京卷以外涉及《紅樓夢》的高考語文題：研究流程逐題以至少兩個不同網域的網頁抄錄核對（confirmed），題面照網頁所見簡體原文；單一來源與無法核對者不收。sources 為核對網址。", questions: out }, null, 1) + "\n");
  console.log("wrote", dest);
}
