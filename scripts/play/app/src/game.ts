/** 計分、抽題、本機進度。計分公式與伺服器（functions/_shared/play/engine.js）相同；排行榜與段位以伺服器重算為準，本機數字只在離線時頂上。 */
import type { Answer, BankIndex, Question, Tier } from "./types";

export const RUN_SIZE = 10;
// 題型時限：0 短答、1 詩詞言語、2 情節、3 判斷、4 真題原題、5 真題改編
const LIMIT: Record<number, number> = { 0: 20000, 1: 30000, 2: 35000, 3: 40000, 4: 120000, 5: 45000 };
const TYPE_BONUS: Record<number, number> = { 0: 0, 1: 2, 2: 2, 3: 4, 4: 6, 5: 4 };
const TIER_BASE: Record<Tier, number> = { N: 10, R: 14, SR: 18, SSR: 24 };

export const limitOf = (q: Question) => LIMIT[q.type] || 30000;

export function questionScore(q: Question, correct: boolean, ms: number, combo: number): number {
  if (!correct) return 0;
  const limit = limitOf(q);
  const base = (TIER_BASE[q.tier] || 14) + (TYPE_BONUS[q.type] || 0);
  const t = ms < 300 ? limit : ms;
  const speed = Math.min(1, Math.max(0, 1 - t / limit));
  const mult = 1 + Math.min(9, Math.max(0, combo - 1)) * 0.1;
  return Math.round((base + Math.round(base * 0.5 * speed)) * mult);
}

/** 選了哪些選項（索引）→ 送給伺服器的代號：單選是一個代號，多選題是排序後連起來的字母。 */
export function pickId(q: Question, picks: number[]): string {
  if (!picks.length) return "";
  if (!q.multi) return q.options[picks[0]].id;
  return picks.map((k) => q.options[k].id).sort().join("");
}

export function isCorrect(q: Question, picks: number[]): boolean {
  if (q.multi) {
    const want = [...(q.answers || [])].sort().join(",");
    return [...picks].sort().join(",") === want;
  }
  return picks.length === 1 && picks[0] === q.answer;
}

export const correctSet = (q: Question): number[] => (q.multi ? q.answers || [] : [q.answer ?? -1]);

// ------------------------------------------------------------------ 亂數與北京日
export function beijingDay(ms = Date.now()): string {
  return new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);
}

export function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rnd: () => number): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 抽一局：沒答對過的優先；同一張石靈盡量不在一局出兩次；題型盡量混。 */
export function pickRun(pool: Question[], seed: string, save: Save, size = RUN_SIZE): Question[] {
  const rnd = seeded(seed);
  const fresh = (q: Question) => !(save.seen[q.id]?.c > 0);
  const ordered = [...shuffle(pool.filter(fresh), rnd), ...shuffle(pool.filter((q) => !fresh(q)), rnd)];
  const out: Question[] = [];
  const cardsUsed = new Map<string, number>();
  const kinds = new Map<string, number>();
  for (const pass of [[1, 3], [2, 5], [99, 99]]) {
    for (const q of ordered) {
      if (out.length >= size) break;
      if (out.includes(q)) continue;
      if ((cardsUsed.get(q.card) || 0) >= pass[0] || (kinds.get(q.kind) || 0) >= pass[1]) continue;
      out.push(q);
      cardsUsed.set(q.card, (cardsUsed.get(q.card) || 0) + 1);
      kinds.set(q.kind, (kinds.get(q.kind) || 0) + 1);
    }
  }
  return shuffle(out, rnd);
}

/** 今日試煉：同一個北京日所有人同一關、同一組題（排行公平）。 */
export function dailyStage(index: BankIndex, day = beijingDay()): string {
  const rnd = seeded("daily|" + day);
  return index.stages[Math.floor(rnd() * index.stages.length)].id;
}

// ------------------------------------------------------------------ 本機進度
export interface Save {
  v: 1;
  xp: number;
  runs: number;
  seen: Record<string, { c: number; w: number }>;
  sp: Record<string, { c: number; w: number; e: string[] }>;
  stars: Record<string, number>;
  dayRuns: Record<string, number>;
  wrong: string[];
}

const KEY = "hlm-play-v1";
const empty = (): Save => ({ v: 1, xp: 0, runs: 0, seen: {}, sp: {}, stars: {}, dayRuns: {}, wrong: [] });

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const v = JSON.parse(raw) as Partial<Save>;
    return { ...empty(), ...v, seen: v.seen || {}, sp: v.sp || {}, stars: v.stars || {}, dayRuns: v.dayRuns || {}, wrong: Array.isArray(v.wrong) ? v.wrong : [] };
  } catch {
    return empty();
  }
}

export function storeSave(s: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 存不下也不影響這一局；伺服器另有紀錄 */
  }
}

/** 與雲端存檔相同的合併規則：數字取大、陣列取聯集、物件逐鍵。 */
export function mergeSave<T>(a: T, b: T): T {
  if (Array.isArray(a) || Array.isArray(b)) return [...new Set([...((a as unknown[]) || []), ...((b as unknown[]) || [])])] as T;
  if (typeof a === "number" || typeof b === "number") return Math.max(Number(a) || 0, Number(b) || 0) as T;
  if (a && b && typeof a === "object" && typeof b === "object") {
    const out: Record<string, unknown> = { ...(a as Record<string, unknown>) };
    for (const [k, v] of Object.entries(b as Record<string, unknown>)) out[k] = k in out ? mergeSave(out[k], v) : v;
    return out as T;
  }
  return (b ?? a) as T;
}

/** 識得：淨答對 3 題以上（答錯兩題抵一題），且至少答對過 2 道不同的題。與伺服器相同。 */
export const isMastered = (s: Save, cardId: string) => {
  const r = s.sp[cardId];
  return Boolean(r && r.c - Math.floor(r.w / 2) >= 3 && r.e.length >= 2);
};

export function cardProgress(s: Save, cardId: string): { net: number; distinct: number } {
  const r = s.sp[cardId];
  return { net: r ? Math.max(0, r.c - Math.floor(r.w / 2)) : 0, distinct: r ? r.e.length : 0 };
}

/** 一局結束：記每題、每張石靈、關卡星數；回傳這局新識得的石靈。 */
export function recordRun(s: Save, qs: Question[], answers: Answer[], mode: string, scope: string, startedAt: number): { save: Save; newlyMastered: string[]; xp: number } {
  const next: Save = JSON.parse(JSON.stringify(s));
  const before = new Set(Object.keys(next.sp).filter((id) => isMastered(next, id)));
  const wrong = new Set(next.wrong);
  let score = 0;
  answers.forEach((a, i) => {
    const q = qs[i];
    score += a.score;
    const seen = (next.seen[q.id] ||= { c: 0, w: 0 });
    const wkey = `${q.stage}|${q.id}`; // 帶關卡，復仇時才知道要載哪幾關
    const sp = (next.sp[q.card] ||= { c: 0, w: 0, e: [] });
    if (a.correct) {
      seen.c += 1;
      wrong.delete(wkey);
      sp.c += 1;
      if (!sp.e.includes(q.id)) sp.e.push(q.id);
    } else {
      seen.w += 1;
      wrong.add(wkey);
      sp.w += 1;
    }
  });
  const key = `${beijingDay(startedAt)}|${scope}`;
  const n = next.dayRuns[key] || 0;
  const xp = Math.round(score * [1, 0.5, 0.25, 0.1][Math.min(3, n)]);
  next.dayRuns[key] = n + 1;
  next.xp += xp;
  next.runs += 1;
  next.wrong = [...wrong].slice(-300);
  if (mode === "stage" && answers.length >= 3) {
    const correct = answers.filter((a) => a.correct).length;
    const stars = correct === answers.length && answers.length >= RUN_SIZE ? 3 : correct >= answers.length * 0.7 ? 2 : correct >= answers.length * 0.4 ? 1 : 0;
    next.stars[scope] = Math.max(next.stars[scope] || 0, stars);
  }
  const newlyMastered = Object.keys(next.sp).filter((id) => isMastered(next, id) && !before.has(id));
  return { save: next, newlyMastered, xp };
}

export function rankIndex(index: BankIndex, prestige: number, allMastered: boolean): number {
  let idx = 0;
  index.ranks.forEach((r, i) => {
    if (prestige >= r.need) idx = i;
  });
  if (idx === index.ranks.length - 1 && !allMastered) idx -= 1;
  return idx;
}
