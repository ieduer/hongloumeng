// APIS payload contract 2026-10-15: one automatic second attempt only for transient failures; terminal codes are final.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../assets/js/app.js', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('async function callAI('), app.indexOf('let sessionKey = '));

function run(responses) {
  let fetches = 0;
  const bubbleEl = { innerHTML: '', querySelector: () => null, remove() {} };
  const ctx = vm.createContext({
    AbortSignal, JSON, Error,
    detailedCurrent: () => true, detailedPending: new Set(), detailedContext: () => ({}),
    detailedCapture: () => ({ operation: { operationId: 'op', occurredAt: 't' }, saved: Promise.resolve() }),
    fetch: async () => { const r = responses[Math.min(fetches, responses.length - 1)]; fetches += 1; return r; },
    $: () => ({ disabled: false }), bubble: () => bubbleEl, md: (a) => `<p>${a}</p>`, esc: (s) => s, aiLog: () => ({ scrollTop: 0, scrollHeight: 0 }), archive() {},
    aiBusy: false,
  });
  vm.runInContext(source, ctx);
  return { ask: () => ctx.ask('題目', '想一想…', {}), fetches: () => fetches, bubble: bubbleEl };
}
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('terminal APIS codes are sent once; a payload refusal offers no identical retry', async () => {
  for (const [response, pattern, retryButton] of [
    [json(413, { error_code: 'PAYLOAD_TOO_LARGE', retryable: false, reducible: true }), /超過 AI 服務上限/, false],
    [json(502, { error_code: 'UPSTREAM_OUTPUT_TOO_LARGE', retryable: false }), /異常過長/, true],
    [json(503, { error_code: 'UPSTREAM_OUTPUT_TOO_LARGE', retry_after_seconds: 3 }), /異常過長/, true],
    [json(503, { error_code: 'PLATFORM_EGRESS_ERROR', retryable: false }), /上游暫時不可用/, true],
  ]) {
    const r = run([response]);
    await r.ask();
    assert.equal(r.fetches(), 1, pattern.source);
    assert.match(r.bubble.innerHTML, pattern);
    assert.equal(/data-retry/.test(r.bubble.innerHTML), retryButton);
  }
});

test('a transient 5xx keeps the single automatic second attempt', async () => {
  const r = run([json(503, { error_code: 'DEADLINE_EXCEEDED', retry_after_seconds: 2 }), json(200, { answer: '寶玉初見黛玉。' })]);
  await r.ask();
  assert.equal(r.fetches(), 2);
  assert.match(r.bubble.innerHTML, /寶玉初見黛玉/);
  const down = run([json(502, { error_code: 'UPSTREAM_UNAVAILABLE' })]);
  await down.ask();
  assert.equal(down.fetches(), 2);
});
