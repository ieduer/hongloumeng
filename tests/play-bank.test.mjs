// 石頭收服題庫產物的一致性：前端分片與伺服器索引同一版本、同一正解；每關至少十題；每張石靈至少三題。
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import INDEX from "../functions/_shared/play/bank-index.js";

const dir = new URL("../play/bank/", import.meta.url);
const index = JSON.parse(readFileSync(new URL("index.json", dir), "utf8"));
const shards = Object.fromEntries(readdirSync(dir).filter((f) => f !== "index.json" && f.endsWith(".json")).map((f) => [f.slice(0, -5), JSON.parse(readFileSync(new URL(f, dir), "utf8"))]));

test("client and server bank share one version", () => {
  assert.equal(index.version, INDEX.version);
  assert.match(index.version, /^[0-9a-f]{12}$/, "a release bank is never a --loose preview");
  for (const [id, s] of Object.entries(shards)) assert.equal(s.version, INDEX.version, id);
  assert.deepEqual(Object.keys(shards).sort(), [...INDEX.stages].sort());
});

test("every client answer matches the server answer", () => {
  let n = 0;
  for (const s of Object.values(shards))
    for (const q of s.questions) {
      n++;
      const meta = INDEX.q[q.id];
      assert.ok(meta, q.id);
      assert.equal(meta[4], s.stage, q.id);
      assert.equal(new Set(q.options.map((o) => o.id)).size, q.options.length, q.id);
      const ids = q.multi ? q.answers.map((k) => q.options[k].id).sort().join("") : q.options[q.answer].id;
      assert.equal(ids, meta[0], q.id);
      if (!q.letters) assert.equal(q.options.length, 4, q.id);
    }
  assert.equal(n, Object.keys(INDEX.q).length);
});

test("gates: stages, cards, regions", () => {
  for (const st of index.stages) assert.ok(st.count >= 10, st.id);
  const perCard = new Map();
  for (const meta of Object.values(INDEX.q)) perCard.set(meta[3], (perCard.get(meta[3]) || 0) + 1);
  for (const c of index.cards) assert.ok((perCard.get(c.id) || 0) >= 3, c.id);
  for (const r of index.regions) assert.ok(r.stages.length > 0, r.id);
});
