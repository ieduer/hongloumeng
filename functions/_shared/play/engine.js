/**
 * 石頭收服（hlm.bdfz.net/play）的伺服器端，由墨痕「筆靈收服」（mh.bdfz.net/play）的 Worker 改寫為 Pages Function。
 *
 * 前端只送「選了哪個選項、花了幾毫秒」；對錯、分數、石力（段位分）一律由這裡依題庫索引（bank-index.js，
 * scripts/play/build_bank.mjs 產生）重算，排行榜以伺服器結果為準。
 * 學習資料一律留存（站長 2026-11-01）：每一局、每一題的作答、雲端存檔。個人資料不存：玩家是隨機 pid，登入者另記 my.bdfz.net 的 slug。
 */

import INDEX from "./bank-index.js";

const PID_COOKIE = "hlm_play_pid";
const PID_RE = /^(p-[a-f0-9]{24}|uc-[a-z0-9-]{1,30})$/;
// 題型時限（毫秒）：0 短答、1 詩詞言語、2 情節、3 判斷、4 真題原題（含長篇材料與多選）、5 真題改編。與前端 game.ts 相同。
export const LIMIT_MS = { 0: 20000, 1: 30000, 2: 35000, 3: 40000, 4: 120000, 5: 45000 };
const TIER_BASE = { N: 10, R: 14, SR: 18, SSR: 24 };
const TYPE_BONUS = { 0: 0, 1: 2, 2: 2, 3: 4, 4: 6, 5: 4 };
const DECAY = [1, 0.5, 0.25, 0.1]; // 同一範圍同一北京日：第 1 局全額，之後遞減
const BONUS = { mastered: 30, cleared: 120, region: 1500, done: 4 };
const RUN_MAX = 20;
const CLEAR_MIN = 10; // 一局十題；每關至少 10 題，短局不算通關

export function beijingDay(ms) {
  return new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);
}

export function questionScore({ correct, tier, type, ms, combo }) {
  if (!correct) return 0;
  const limit = LIMIT_MS[type] || 30000;
  const base = (TIER_BASE[tier] || 14) + (TYPE_BONUS[type] || 0);
  const t = ms < 300 ? limit : ms; // 不足 0.3 秒視為異常，不給速度分
  const speed = Math.min(1, Math.max(0, 1 - t / limit));
  const mult = 1 + Math.min(9, Math.max(0, combo - 1)) * 0.1;
  return Math.round((base + Math.round(base * 0.5 * speed)) * mult);
}

export function rankIdx(prestige, allMastered) {
  let idx = 0;
  INDEX.ranks.forEach((need, i) => {
    if (prestige >= need) idx = i;
  });
  // 最高階「解味」另須全部石靈識得
  if (idx === INDEX.ranks.length - 1 && !allMastered) idx -= 1;
  return idx;
}

/** 選項代號：單選是一個代號；多選題把勾選的代號排序後連起來（A、C、E → "ACE"）。 */
export function normPick(raw) {
  const s = String(raw || "").slice(0, 12);
  return /^[A-E]{2,5}$/.test(s) ? [...new Set(s.split(""))].sort().join("") : s;
}

function readPid(request) {
  const m = (request.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${PID_COOKIE}=([^;\\s]+)`));
  return m && PID_RE.test(m[1]) ? m[1] : null;
}

function newPid() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return "p-" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function pidCookie(pid) {
  return `${PID_COOKIE}=${pid}; Path=/; Max-Age=63072000; HttpOnly; Secure; SameSite=Lax`;
}

/**
 * 決定這次請求代表哪位玩家。登入者一律用 uc-<slug>，換裝置也是同一人；匿名時用 cookie 裡的隨機 pid。
 * 匿名玩過再登入：把匿名 pid 的紀錄併進帳號（學習資料不丟）。
 */
async function resolvePlayer(db, request, user, now) {
  const cookiePid = readPid(request);
  const pid = user ? `uc-${user.slug}` : cookiePid || newPid();
  await db
    .prepare("INSERT INTO players (pid, created_at, updated_at, uc_slug) VALUES (?1, ?2, ?2, ?3) ON CONFLICT(pid) DO NOTHING")
    .bind(pid, now, user ? user.slug : null)
    .run();
  let merged = false;
  if (user && cookiePid && cookiePid !== pid && cookiePid.startsWith("p-")) {
    await db.batch([
      db.prepare("UPDATE runs SET pid = ?1 WHERE pid = ?2 AND NOT EXISTS (SELECT 1 FROM runs r2 WHERE r2.pid = ?1 AND r2.mode = runs.mode AND r2.scope = runs.scope AND r2.seed = runs.seed AND r2.started_at = runs.started_at)").bind(pid, cookiePid),
      db.prepare("UPDATE answers SET pid = ?1 WHERE pid = ?2").bind(pid, cookiePid),
      db.prepare("UPDATE players SET nick = CASE WHEN nick = '' THEN (SELECT nick FROM players WHERE pid = ?2) ELSE nick END WHERE pid = ?1").bind(pid, cookiePid),
    ]);
    merged = true;
  }
  return { pid, setCookie: pid !== cookiePid ? pidCookie(pid) : null, merged };
}

/** 石力與段位：每次都從留存的作答重算，不累加，避免重送或併帳造成重複計數。 */
export async function recompute(db, pid, now) {
  const xpRow = await db.prepare("SELECT COALESCE(SUM(xp), 0) AS xp FROM runs WHERE pid = ?1").bind(pid).first();
  const perCard = await db
    .prepare("SELECT card, SUM(correct) AS c, SUM(1 - correct) AS w, COUNT(DISTINCT CASE WHEN correct = 1 THEN q END) AS e FROM answers WHERE pid = ?1 AND card != '' GROUP BY card")
    .bind(pid)
    .all();
  let masteredBonus = 0;
  let mastered = 0;
  for (const r of perCard.results || []) {
    const card = INDEX.cards[r.card];
    if (!card) continue;
    // 識得：淨答對 3 題以上（答錯兩題抵一題），且至少答對過 2 道不同的題
    if (r.c - Math.floor(r.w / 2) >= 3 && r.e >= 2) {
      mastered += 1;
      masteredBonus += BONUS.mastered * (card.t === "SSR" ? 2 : 1);
    }
  }
  const clearedRows = await db
    .prepare("SELECT DISTINCT scope FROM runs WHERE pid = ?1 AND mode = 'stage' AND total >= ?2 AND correct = total")
    .bind(pid, CLEAR_MIN)
    .all();
  const cleared = new Set((clearedRows.results || []).map((r) => r.scope).filter((s) => INDEX.stages.includes(s)));
  let regions = 0;
  // 走完一域＝該域每一關都三星；沒有關卡的區域不算（空集合的 every 恆真）
  for (const stages of Object.values(INDEX.regions)) if (stages.length && stages.every((s) => cleared.has(s))) regions += 1;
  const doneRows = await db.prepare("SELECT DISTINCT q FROM answers WHERE pid = ?1 AND correct = 1").bind(pid).all();
  const done = (doneRows.results || []).filter((r) => INDEX.q[r.q]).length;

  const xp = Number(xpRow?.xp || 0);
  const prestige = xp + masteredBonus + cleared.size * BONUS.cleared + regions * BONUS.region + done * BONUS.done;
  const allMastered = mastered >= Object.keys(INDEX.cards).length;
  const idx = rankIdx(prestige, allMastered);
  await db.prepare("UPDATE players SET xp = ?2, prestige = ?3, rank_idx = ?4, updated_at = ?5 WHERE pid = ?1").bind(pid, xp, prestige, idx, now).run();
  return { xp, prestige, rank: idx, mastered, cleared: cleared.size, regions, done };
}

async function submitRun(db, pid, body, now) {
  const mode = String(body.mode || "");
  const scope = String(body.scope || "").slice(0, 60);
  const seed = String(body.seed || "").slice(0, 60);
  const startedAt = Math.floor(Number(body.startedAt));
  const answers = Array.isArray(body.answers) ? body.answers.slice(0, RUN_MAX) : [];
  if (!["stage", "daily", "free", "revenge"].includes(mode) || !scope || !seed || !Number.isFinite(startedAt) || !answers.length) {
    return { error: "invalid run", status: 400 };
  }
  if (startedAt > now + 60_000 || startedAt < now - 14 * 86400_000) return { error: "stale run", status: 400 };

  // 重送同一局（網路斷、待送匣補送）：回原結果，不重複計分
  const dup = await db
    .prepare("SELECT id, score, xp, correct, total FROM runs WHERE pid = ?1 AND mode = ?2 AND scope = ?3 AND seed = ?4 AND started_at = ?5")
    .bind(pid, mode, scope, seed, startedAt)
    .first();
  if (dup) return { duplicate: true, run: dup, stats: await recompute(db, pid, now) };

  let combo = 0;
  let score = 0;
  let correct = 0;
  const rows = [];
  const seen = new Set();
  for (const a of answers) {
    const qid = String(a.q || "");
    const meta = INDEX.q[qid];
    if (!meta || seen.has(qid)) continue; // 舊題庫、偽造或重複的題號一律略過
    seen.add(qid);
    const [answerId, tier, type, card, stage] = meta;
    const ms = Math.max(0, Math.min(300000, Math.floor(Number(a.ms) || 0)));
    const pick = normPick(a.pick);
    const ok = pick === answerId;
    combo = ok ? combo + 1 : 0;
    score += questionScore({ correct: ok, tier, type, ms, combo });
    if (ok) correct += 1;
    rows.push({ q: qid, pick, ok, ms, card, stage });
  }
  if (!rows.length) return { error: "no valid answers", status: 400 };

  const day = beijingDay(startedAt);
  const prior = await db.prepare("SELECT COUNT(*) AS n FROM runs WHERE pid = ?1 AND scope = ?2 AND day = ?3").bind(pid, scope, day).first();
  const xp = Math.round(score * DECAY[Math.min(DECAY.length - 1, Number(prior?.n || 0))]);
  const duration = Math.max(0, Math.min(3600_000, now - startedAt));
  const ins = await db
    .prepare("INSERT INTO runs (pid, mode, scope, seed, started_at, created_at, duration_ms, bank, total, correct, score, xp, day) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13) ON CONFLICT DO NOTHING")
    .bind(pid, mode, scope, seed, startedAt, now, duration, INDEX.version, rows.length, correct, score, xp, day)
    .run();
  const runId = ins.meta?.last_row_id;
  if (!ins.meta?.changes || !runId) {
    // 同時送兩份：另一份已寫入，照重送處理
    const again = await db.prepare("SELECT id, score, xp, correct, total FROM runs WHERE pid = ?1 AND mode = ?2 AND scope = ?3 AND seed = ?4 AND started_at = ?5").bind(pid, mode, scope, seed, startedAt).first();
    return { duplicate: true, run: again, stats: await recompute(db, pid, now) };
  }
  await db.batch(rows.map((r) => db.prepare("INSERT INTO answers (run_id, pid, q, pick, correct, ms, card, stage) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)").bind(runId, pid, r.q, r.pick, r.ok ? 1 : 0, r.ms, r.card, r.stage)));
  return { duplicate: false, run: { id: runId, score, xp, correct, total: rows.length }, stats: await recompute(db, pid, now) };
}

async function leaderboard(db, period, now) {
  if (period === "day") {
    const day = beijingDay(now);
    // 今日榜只計每人當天第一局「今日試煉」：全站同一組題才公平，重玩不算
    const r = await db
      .prepare("SELECT p.nick, p.rank_idx, r.score FROM runs r JOIN players p ON p.pid = r.pid WHERE r.mode = 'daily' AND r.day = ?1 AND r.score > 0 AND r.id = (SELECT MIN(id) FROM runs r2 WHERE r2.pid = r.pid AND r2.day = ?1 AND r2.mode = 'daily') ORDER BY r.score DESC LIMIT 50")
      .bind(day)
      .all();
    return r.results || [];
  }
  if (period === "week") {
    const since = beijingDay(now - 6 * 86400_000);
    const r = await db.prepare("SELECT p.nick, p.rank_idx, SUM(r.xp) AS score FROM runs r JOIN players p ON p.pid = r.pid WHERE r.day >= ?1 GROUP BY r.pid HAVING score > 0 ORDER BY score DESC LIMIT 50").bind(since).all();
    return r.results || [];
  }
  const r = await db.prepare("SELECT nick, rank_idx, prestige AS score FROM players WHERE prestige > 0 ORDER BY prestige DESC, xp DESC LIMIT 50").all();
  return r.results || [];
}

/** 存檔合併：數字取大、陣列取聯集、物件逐鍵遞迴——任何計數只增不減。 */
export function mergeSave(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])].slice(0, 5000);
  if (typeof a === "number" || typeof b === "number") return Math.max(Number(a) || 0, Number(b) || 0);
  if (a && typeof a === "object" && b && typeof b === "object") {
    const out = { ...a };
    for (const k of Object.keys(b)) out[k] = k in a ? mergeSave(a[k], b[k]) : b[k];
    return out;
  }
  return b ?? a;
}

export async function handlePlay(request, env, url, deps) {
  const { json, bad, currentUser } = deps;
  const db = env.PLAY_DB;
  const path = url.pathname.replace(/^\/api\/play\/?/, "");
  const now = Date.now();

  if (path === "health") return json({ ok: true, bank: INDEX.version, questions: Object.keys(INDEX.q).length, db: Boolean(db) });
  if (!db) return bad("play store unavailable", 503);
  // 寫入只接受本站頁面送出（瀏覽器會帶 Origin）；擋跨站代送
  if (request.method !== "GET") {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return bad("cross-origin request refused", 403);
  }

  if (path === "leaderboard" && request.method === "GET") {
    const period = ["day", "week", "all"].includes(url.searchParams.get("period")) ? url.searchParams.get("period") : "all";
    return json({ period, rows: await leaderboard(db, period, now) });
  }

  const user = await currentUser(request);
  const who = await resolvePlayer(db, request, user, now);
  const withCookie = (res) => {
    if (!who.setCookie) return res;
    const h = new Headers(res.headers);
    h.append("Set-Cookie", who.setCookie);
    return new Response(res.body, { status: res.status, headers: h });
  };

  if (path === "me" && request.method === "GET") {
    const p = await db.prepare("SELECT nick FROM players WHERE pid = ?1").bind(who.pid).first();
    const stats = await recompute(db, who.pid, now);
    return withCookie(json({ pid: who.pid, nick: p?.nick || "", user: user ? { slug: user.slug, name: user.name || user.displayName || user.slug } : null, merged: who.merged, bank: INDEX.version, stats }));
  }

  if (path === "save") {
    if (!user) return withCookie(bad("login required", 401));
    const owner = `uc-${user.slug}`;
    const row = await db.prepare("SELECT data FROM saves WHERE owner = ?1").bind(owner).first();
    let current = {};
    try {
      current = row ? JSON.parse(row.data) : {};
    } catch {
      current = {};
    }
    if (request.method === "GET") return withCookie(json({ save: current }));
    if (request.method === "PUT") {
      const body = await request.json().catch(() => null);
      if (!body || typeof body.save !== "object" || !body.save) return withCookie(bad("save required"));
      const merged = mergeSave(current, body.save);
      const text = JSON.stringify(merged);
      if (text.length > 900_000) return withCookie(bad("save too large", 413));
      await db.prepare("INSERT INTO saves (owner, data, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(owner) DO UPDATE SET data = ?2, updated_at = ?3").bind(owner, text, now).run();
      return withCookie(json({ save: merged }));
    }
    return withCookie(bad("method not allowed", 405));
  }

  if (request.method !== "POST") return withCookie(bad("method not allowed", 405));
  const body = await request.json().catch(() => ({}));

  if (path === "nick") {
    const nick = String(body.nick || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 12);
    if (!nick) return withCookie(bad("nick required"));
    await db.prepare("UPDATE players SET nick = ?2, updated_at = ?3 WHERE pid = ?1").bind(who.pid, nick, now).run();
    return withCookie(json({ nick }));
  }

  if (path === "run") {
    const result = await submitRun(db, who.pid, body, now);
    if (result.error) return withCookie(bad(result.error, result.status));
    return withCookie(json(result));
  }

  return withCookie(bad("not found", 404));
}
