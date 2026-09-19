import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../reader-learning-evidence-v1.js', import.meta.url), 'utf8');
function harness({ start, heartbeat } = {}) {
  let clock = 0, interval;
  const calls = [], writes = [], statuses = [];
  const context = { console, Date, Promise, Set, Object, Number, String, Math,
    setInterval(fn) { interval = fn; return 1; }, clearInterval() {},
    document: { hidden: false, addEventListener() {}, removeEventListener() {} },
    IntersectionObserver: class { observe() {} disconnect() {} },
  };
  vm.runInNewContext(source, context);
  const tracker = context.BdfzReaderEvidence.createTracker({
    manifest: { schema: 'bdfz-reader-learning-manifest-v1', bookId: 'book', siteKey: 'cxzgjy', bookTitle: 'Book', manifestVersion: 'v1',
      completionContract: { minVisibleRatio: 0.6, minSegmentVisibleMs: 100 },
      chapters: ['a', 'b'].map(id => ({ chapterId: id, title: id, segmentIds: [id + '-1'], requiredActiveDwellMs: 100 })) },
    now: () => clock, getSession: async () => ({ authenticated: true }),
    getProgress: async () => ({ items: [] }), putProgress: async p => { writes.push(p); },
    onStatus: s => statuses.push(s),
    startReading: async p => { calls.push({ method: 'start', ...p }); return start ? start(p, calls) : { ok: true, sessionId: 'reader-session-00000001' }; },
    heartbeatReading: async p => { calls.push({ method: 'heartbeat', ...p }); return heartbeat ? heartbeat(p, calls) : { ok: true }; },
  });
  return { tracker, calls, writes, statuses, advance(ms) { clock += ms; tracker.tick(clock); },
    async open(id = 'a') { await tracker.bindChapter({ querySelectorAll: () => [] }, id); tracker.setSegmentVisibility(id + '-1', 1, clock); },
    async timers(n) { for (let i = 0; i < n; i++) { clock += 3000; interval(); await new Promise(resolve => setImmediate(resolve)); } },
  };
}
const unavailable = () => Object.assign(new Error('unavailable'), { reason: 'learning_evidence_unavailable' });
const methodCalls = (h, method) => h.calls.filter(c => c.method === method);

test('stale session recovers once using start and resets local checkpoint for a new session', async () => {
  let starts = 0;
  const h = harness({ start: async () => ({ ok: true, sessionId: 'reader-session-' + (++starts === 1 ? 'old0000001' : 'new0000001') }),
    heartbeat: async p => { if (p.sessionId.includes('old')) throw unavailable(); return { ok: true }; } });
  await h.open(); h.advance(1000);
  assert.equal(h.tracker.snapshot().locallyEligible, true);
  assert.equal((await h.tracker.flushHeartbeat()).ok, true);
  assert.equal(starts, 2);
  assert.equal(h.tracker.snapshot().observedActiveDwellMs, 0);
  assert.equal(h.tracker.snapshot().eligible, false);
  assert.deepEqual(methodCalls(h, 'heartbeat').map(c => c.sequence), [1, 1]);
  assert.equal(h.writes.filter(w => w.state === 'completed').length, 0);
});

test('resuming the same server session resets sequence without discarding local observations', async () => {
  let count = 0;
  const h = harness({ heartbeat: async () => { if (++count === 2) throw unavailable(); return { ok: true }; } });
  await h.open(); await h.tracker.flushHeartbeat(); h.advance(1000);
  await h.tracker.flushHeartbeat();
  assert.deepEqual(methodCalls(h, 'heartbeat').map(c => c.sequence), [1, 2, 1]);
  assert.equal(h.tracker.snapshot().observedActiveDwellMs, 1000);
});

test('failed recovery pauses both timers and forced flushes instead of retrying forever', async () => {
  const h = harness({ heartbeat: async () => { throw unavailable(); } });
  await h.open(); assert.equal((await h.tracker.flushHeartbeat()).ok, false);
  await h.timers(30);
  for (let i = 0; i < 10; i++) await h.tracker.flushHeartbeat();
  assert.equal(methodCalls(h, 'start').length, 2);
  assert.equal(methodCalls(h, 'heartbeat').length, 2);
  assert.equal(h.tracker.snapshot().sourcePaused, true);
});

test('structured heartbeat rejection follows the same finite recovery path', async () => {
  const h = harness({ heartbeat: async () => ({ ok: false, error: { code: 'reading_session_unavailable' } }) });
  await h.open(); await h.tracker.flushHeartbeat(); await h.timers(10);
  assert.equal(methodCalls(h, 'heartbeat').length, 2);
  assert.equal(h.tracker.snapshot().sourcePaused, true);
});

test('authentication rejection does not try to reopen the session', async () => {
  const h = harness({ heartbeat: async () => { throw Object.assign(new Error('auth'), { reason: 'authentication_required' }); } });
  await h.open(); await h.tracker.flushHeartbeat(); await h.timers(10);
  assert.equal(methodCalls(h, 'start').length, 1);
  assert.equal(methodCalls(h, 'heartbeat').length, 1);
});

test('failed initial start is bounded and produces a visible paused state', async () => {
  const h = harness({ start: async () => ({ ok: false, reason: 'authentication_required' }) });
  await h.open(); await h.timers(30);
  assert.equal(methodCalls(h, 'start').length, 2);
  assert.equal(methodCalls(h, 'heartbeat').length, 0);
  assert.equal(h.tracker.snapshot().sourcePaused, true);
});

test('concurrent timer and flush share one recovery operation', async () => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  let starts = 0;
  const h = harness({ start: async () => { if (++starts === 2) await wait; return { ok: true, sessionId: 'reader-session-00000001' }; },
    heartbeat: async () => { throw unavailable(); } });
  await h.open();
  const first = h.tracker.flushHeartbeat();
  await new Promise(resolve => setImmediate(resolve));
  const others = Array.from({ length: 10 }, () => h.tracker.flushHeartbeat());
  release(); await Promise.all([first, ...others]);
  assert.equal(starts, 2); assert.equal(methodCalls(h, 'heartbeat').length, 2);
});

test('switching chapter during recovery does not send an old heartbeat after start returns', async () => {
  let release, starts = 0;
  const wait = new Promise(resolve => { release = resolve; });
  const h = harness({ start: async () => { if (++starts === 2) await wait; return { ok: true, sessionId: 'reader-session-' + String(starts).padStart(8, '0') }; },
    heartbeat: async () => { throw unavailable(); } });
  await h.open(); const pending = h.tracker.flushHeartbeat();
  await new Promise(resolve => setImmediate(resolve));
  await h.tracker.enterChapter('b'); release(); await pending;
  assert.equal(methodCalls(h, 'heartbeat').length, 1);
  assert.equal(h.tracker.snapshot().chapterId, 'b');
  assert.equal(h.tracker.snapshot().sourcePaused, false);
});

test('successful active reading preserves sequential heartbeats without extra starts', async () => {
  const h = harness(); await h.open(); await h.tracker.flushHeartbeat(); await h.tracker.flushHeartbeat();
  assert.deepEqual(methodCalls(h, 'heartbeat').map(c => c.sequence), [1, 2]);
  assert.equal(methodCalls(h, 'start').length, 1);
  assert.equal(h.tracker.snapshot().sourcePaused, false);
});
