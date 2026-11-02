// 石頭收服伺服器（functions/_shared/play/engine.js）：用真實建表檔建一個記憶體 SQLite，包成 D1 介面來測。
// 先跑 node scripts/play/build_bank.mjs 產生 bank-index.js。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { handlePlay, mergeSave, normPick, questionScore } from "../functions/_shared/play/engine.js";
import INDEX from "../functions/_shared/play/bank-index.js";

function makeDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../migrations/0001_play.sql", import.meta.url), "utf8"));
  const prepare = (sql) => {
    let args = [];
    const stmt = {
      bind(...a) {
        args = a;
        return stmt;
      },
      async first() {
        return db.prepare(sql).get(...args) ?? null;
      },
      async all() {
        return { results: db.prepare(sql).all(...args) };
      },
      async run() {
        const r = db.prepare(sql).run(...args);
        return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
      },
    };
    return stmt;
  };
  return { raw: db, prepare, async batch(stmts) { const out = []; for (const s of stmts) out.push(await s.run()); return out; } };
}

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const bad = (message, status = 400) => json({ error: message }, status);

function harness() {
  const db = makeDb();
  const env = { PLAY_DB: db };
  const deps = {
    json,
    bad,
    async currentUser(req) {
      const slug = req.headers.get("x-test-user");
      return slug ? { slug, name: slug } : null;
    },
  };
  async function call(method, path, { body, pid, user, origin } = {}) {
    const headers = new Headers({ "content-type": "application/json" });
    if (pid) headers.set("cookie", `hlm_play_pid=${pid}`);
    if (user) headers.set("x-test-user", user);
    if (origin) headers.set("origin", origin);
    const req = new Request("https://hlm.bdfz.net/api/play/" + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const res = await handlePlay(req, env, new URL(req.url), deps);
    const cookie = res.headers.get("set-cookie") || "";
    const m = cookie.match(/hlm_play_pid=([^;]+)/);
    return { status: res.status, body: await res.json(), pid: m ? m[1] : pid };
  }
  return { db, call };
}

const entries = Object.entries(INDEX.q);
const stageWithTen = INDEX.stages.find((s) => entries.filter(([, m]) => m[4] === s).length >= 10);
const stageQs = entries.filter(([, m]) => m[4] === stageWithTen).slice(0, 10);
const wrongPick = (answerId) => (answerId === "a" ? "d0" : answerId === "A" ? "B" : "A");
const run = (qs, picker, extra = {}) => ({ mode: "stage", scope: stageWithTen, seed: "s1", startedAt: Date.now() - 60_000, answers: qs.map(([q, m]) => ({ q, pick: picker(m[0]), ms: 4000 })), ...extra });

test("bank index is consistent", () => {
  assert.match(INDEX.version, /^[0-9a-f]{12}$/);
  assert.ok(entries.length >= 300, "at least 300 questions");
  for (const [q, [answerId, tier, type, card, stage]] of entries) {
    assert.ok(answerId === "a" || /^[A-E]{1,5}$/.test(answerId), q);
    assert.ok(["N", "R", "SR", "SSR"].includes(tier), q);
    assert.ok([0, 1, 2, 3, 4, 5].includes(type), q);
    assert.ok(INDEX.cards[card], q);
    assert.ok(INDEX.stages.includes(stage), q);
  }
  assert.equal(INDEX.ranks.length, 10);
  assert.ok(stageWithTen, "a stage with at least ten questions");
});

test("scoring and pick normalisation", () => {
  assert.equal(questionScore({ correct: false, tier: "SSR", type: 4, ms: 1000, combo: 3 }), 0);
  const fast = questionScore({ correct: true, tier: "R", type: 1, ms: 2000, combo: 1 });
  const slow = questionScore({ correct: true, tier: "R", type: 1, ms: 25000, combo: 1 });
  assert.ok(fast > slow && slow > 0);
  assert.ok(questionScore({ correct: true, tier: "R", type: 1, ms: 2000, combo: 5 }) > fast);
  assert.equal(questionScore({ correct: true, tier: "R", type: 1, ms: 10, combo: 1 }), questionScore({ correct: true, tier: "R", type: 1, ms: 30000, combo: 1 }), "a sub-300ms answer earns no speed bonus");
  assert.equal(normPick("EAC"), "ACE");
  assert.equal(normPick("a"), "a");
  assert.equal(normPick("d1"), "d1");
});

test("health reports bank and store", async () => {
  const { call } = harness();
  const r = await call("GET", "health");
  assert.equal(r.status, 200);
  assert.equal(r.body.bank, INDEX.version);
  assert.equal(r.body.db, true);
});

test("no region counts as walked before its stages are cleared", async () => {
  const { call } = harness();
  const me = await call("GET", "me");
  assert.equal(me.body.stats.regions, 0);
  assert.ok(Object.values(INDEX.regions).every((list) => list.length > 0), "every region has stages");
});

test("anonymous player gets a pid and empty stats", async () => {
  const { call } = harness();
  const r = await call("GET", "me");
  assert.equal(r.status, 200);
  assert.match(r.pid, /^p-[0-9a-f]{24}$/);
  assert.equal(r.body.stats.prestige, 0);
  assert.equal(r.body.user, null);
});

test("a perfect stage run clears the stage, retains every answer and is idempotent", async () => {
  const { call, db } = harness();
  const me = await call("GET", "me");
  const body = run(stageQs, (a) => a);
  const first = await call("POST", "run", { body, pid: me.pid });
  assert.equal(first.status, 200);
  assert.equal(first.body.duplicate, false);
  assert.equal(first.body.run.correct, 10);
  assert.ok(first.body.run.score > 0);
  assert.equal(first.body.stats.cleared, 1);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM answers").get().n, 10, "every answer is kept as learning data");
  const again = await call("POST", "run", { body, pid: me.pid });
  assert.equal(again.body.duplicate, true);
  assert.equal(again.body.stats.prestige, first.body.stats.prestige, "a replayed report adds nothing");
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM runs").get().n, 1);
});

test("wrong picks score zero; forged question ids are ignored; an all-forged run is refused", async () => {
  const { call } = harness();
  const me = await call("GET", "me");
  const wrong = await call("POST", "run", { body: run(stageQs, wrongPick, { seed: "w" }), pid: me.pid });
  assert.equal(wrong.body.run.correct, 0);
  assert.equal(wrong.body.run.score, 0);
  const forged = await call("POST", "run", { body: { mode: "stage", scope: stageWithTen, seed: "f", startedAt: Date.now() - 1000, answers: [{ q: "nope", pick: "a", ms: 1 }] }, pid: me.pid });
  assert.equal(forged.status, 400);
});

test("same scope on the same day decays", async () => {
  const { call } = harness();
  const me = await call("GET", "me");
  const r1 = await call("POST", "run", { body: run(stageQs, (a) => a, { seed: "d1" }), pid: me.pid });
  const r2 = await call("POST", "run", { body: run(stageQs, (a) => a, { seed: "d2", startedAt: Date.now() - 30_000 }), pid: me.pid });
  assert.equal(r2.body.run.score, r1.body.run.score);
  assert.equal(r2.body.run.xp, Math.round(r1.body.run.score * 0.5));
});

test("multi-select exam questions need the exact set", async () => {
  const multi = entries.find(([, m]) => m[0].length > 1);
  if (!multi) return;
  const { call } = harness();
  const me = await call("GET", "me");
  const [q, [answerId, , , , stage]] = multi;
  const ok = await call("POST", "run", { body: { mode: "stage", scope: stage, seed: "m1", startedAt: Date.now() - 1000, answers: [{ q, pick: [...answerId].reverse().join(""), ms: 9000 }] }, pid: me.pid });
  assert.equal(ok.body.run.correct, 1, "order of the picked letters does not matter");
  const partial = await call("POST", "run", { body: { mode: "stage", scope: stage, seed: "m2", startedAt: Date.now() - 1000, answers: [{ q, pick: answerId.slice(1), ms: 9000 }] }, pid: me.pid });
  assert.equal(partial.body.run.correct, 0, "a partial set is wrong");
});

test("mastery needs three net correct answers on two different questions", async () => {
  const { call } = harness();
  const me = await call("GET", "me");
  const byCard = new Map();
  for (const e of entries) if (e[1][0] === "a") (byCard.get(e[1][3]) || byCard.set(e[1][3], []).get(e[1][3])).push(e);
  const [, list] = [...byCard.entries()].find(([, l]) => l.length >= 3);
  const same = await call("POST", "run", { body: { mode: "free", scope: list[0][1][4], seed: "x1", startedAt: Date.now() - 1000, answers: [{ q: list[0][0], pick: "a", ms: 3000 }] }, pid: me.pid });
  await call("POST", "run", { body: { mode: "free", scope: list[0][1][4], seed: "x2", startedAt: Date.now() - 900, answers: [{ q: list[0][0], pick: "a", ms: 3000 }] }, pid: me.pid });
  const thrice = await call("POST", "run", { body: { mode: "free", scope: list[0][1][4], seed: "x3", startedAt: Date.now() - 800, answers: [{ q: list[0][0], pick: "a", ms: 3000 }] }, pid: me.pid });
  assert.equal(same.body.stats.mastered, 0);
  assert.equal(thrice.body.stats.mastered, 0, "the same question three times is not mastery");
  const other = await call("POST", "run", { body: { mode: "free", scope: list[1][1][4], seed: "x4", startedAt: Date.now() - 700, answers: [{ q: list[1][0], pick: "a", ms: 3000 }] }, pid: me.pid });
  assert.equal(other.body.stats.mastered, 1);
});

test("signing in merges the anonymous record into the account", async () => {
  const { call, db } = harness();
  const anon = await call("GET", "me");
  await call("POST", "run", { body: run(stageQs, (a) => a, { seed: "anon" }), pid: anon.pid });
  const signed = await call("GET", "me", { pid: anon.pid, user: "stu1" });
  assert.equal(signed.body.merged, true);
  assert.equal(signed.pid, "uc-stu1");
  assert.equal(signed.body.stats.cleared, 1);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM answers WHERE pid = 'uc-stu1'").get().n, 10);
});

test("cloud save needs a session and only ever grows", async () => {
  const { call } = harness();
  const anon = await call("PUT", "save", { body: { save: { xp: 5 } } });
  assert.equal(anon.status, 401);
  await call("PUT", "save", { body: { save: { xp: 50, stars: { a: 2 }, wrong: ["x"] } }, user: "stu2" });
  const r = await call("PUT", "save", { body: { save: { xp: 10, stars: { a: 3, b: 1 }, wrong: ["y"] } }, user: "stu2" });
  assert.deepEqual(r.body.save, { xp: 50, stars: { a: 3, b: 1 }, wrong: ["x", "y"] });
  assert.deepEqual(mergeSave({ n: 1 }, { n: 0 }), { n: 1 });
});

test("cross-site writes are refused", async () => {
  const { call } = harness();
  const r = await call("POST", "nick", { body: { nick: "x" }, origin: "https://evil.example" });
  assert.equal(r.status, 403);
  const ok = await call("POST", "nick", { body: { nick: "石兄" }, origin: "https://hlm.bdfz.net" });
  assert.equal(ok.status, 200);
});

test("today's board counts only each player's first daily run", async () => {
  const { call } = harness();
  const me = await call("GET", "me");
  await call("POST", "nick", { body: { nick: "甲" }, pid: me.pid });
  await call("POST", "run", { body: run(stageQs.slice(0, 3), wrongPick, { mode: "daily", seed: "daily-1" }), pid: me.pid });
  await call("POST", "run", { body: run(stageQs, (a) => a, { mode: "daily", seed: "daily-2", startedAt: Date.now() - 20_000 }), pid: me.pid });
  const board = await call("GET", "leaderboard?period=day");
  assert.equal(board.body.rows.length, 0, "the first daily run scored zero, so the replay does not put the player on the board");
  const all = await call("GET", "leaderboard?period=all");
  assert.equal(all.body.rows.length, 1);
});
