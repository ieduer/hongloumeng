// 四套色系的文字對比度閘門：正文 ≥ 7（AAA）、次要文字與按鈕字 ≥ 4.5（AA）。半透明面板先疊在頁面底色上再算。
import fs from "node:fs";
const css = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const themes = {};
for (const m of css.matchAll(/(?::root,\s*)?\[data-theme="(\w+)"\]\s*\{([^}]*)\}/g)) {
  const vars = {};
  for (const v of m[2].matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[v[1]] = v[2].trim();
  themes[m[1]] = vars;
}
const parse = (c) => {
  let m = c.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (m) c = "#" + m[1] + m[1] + m[2] + m[2] + m[3] + m[3];
  m = c.match(/^#([0-9a-f]{6})$/i);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
  m = c.match(/^rgba?\(([^)]+)\)$/);
  if (m) { const p = m[1].split(",").map((x) => parseFloat(x)); return [p[0], p[1], p[2], p[3] ?? 1]; }
  throw new Error("color " + c);
};
const over = (top, bot) => [0, 1, 2].map((i) => top[i] * top[3] + bot[i] * (1 - top[3])).concat(1);
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
let fails = 0;
const rows = [];
for (const [name, v] of Object.entries(themes)) {
  const bg = parse(v.bg), surface = over(parse(v.surface), bg), surface2 = over(parse(v["surface-2"]), surface);
  const checks = [
    ["正文/面板", v.ink, surface, 7], ["正文/頁底", v.ink, bg, 7], ["正文/選項底", v.ink, surface2, 7],
    ["次要/面板", v.muted, surface, 4.5], ["次要/選項底", v.muted, surface2, 4.5],
    ["主按鈕字", v["accent-ink"], parse(v.accent), 4.5], ["強調字/面板", v.accent, surface, 4.5],
    ["金字/面板", v.gold, surface, 4.5], ["對/面板", v.ok, surface, 4.5], ["錯/面板", v.no, surface, 4.5],
    ["對/對底", v.ok, over(parse(v["ok-bg"]), surface2), 4.5], ["錯/錯底", v.no, over(parse(v["no-bg"]), surface2), 4.5],
  ];
  for (const [label, fg, back, need] of checks) {
    const r = ratio(parse(fg), back);
    if (r < need) fails++;
    rows.push(`${name}\t${label}\t${r.toFixed(2)}\t${r >= need ? "ok" : "FAIL(<" + need + ")"}`);
  }
}
console.log(rows.join("\n"));
console.log(`themes ${Object.keys(themes).length}, failures ${fails}`);
process.exit(fails ? 1 : 0);
