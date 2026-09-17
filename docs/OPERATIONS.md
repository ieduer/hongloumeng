# Hongloumeng operations

Reviewed 2026-09-17; owner suen. This is the local operations entrypoint.
Read [instructions](../AGENTS.md) and [state](../PROJECT_STATE.md).

## Source, data, and recovery

Canonical checkout: `/Users/ylsuen/CF/sites/reading/hongloumeng`; configured
remote `https://github.com/ieduer/hongloumeng.git`, local branch `main`.
Pages project `hongloumeng`, host `hlm.bdfz.net`, deployed through the GitHub
integration on `main` (a push to `main` publishes production). There is no
build step: `index.html`, `assets/`, and `data/` are served as-is.

Data layering is defined in [AGENTS.md](../AGENTS.md). In short:

- Read-only sources: `data/hongloumeng.json` (120 回全文), `data/shici.json`
  (141 條詩詞條目), `data/紅樓夢詩詞.json`, `data/gaokao.json` (2025 年前的舊真題摘要，
  已被 `data/study/exams.json` 取代，保留作歷史對照).
- Hand-authored: `data/study/exams.json`, `data/authored/people.json`,
  `data/authored/method.json`, `data/authored/verdicts.json` (判詞校訂層),
  `data/authored/research.json` (兩篇論文的教學轉述、來源與練習).
- Derived (regenerate with `python3 scripts/build_study.py`):
  `data/study/chapters.json`, `data/study/people.json`, `data/study/poems.json`,
  `data/study/plans.json`, `data/text/ch001.json … ch120.json`.

The build script is pure and idempotent: it reads the two source JSONs plus the
authored files and rewrites only the derived paths. It never touches sources.
`parse_hongloumeng.py` remains blocked — its root input `紅樓夢詩詞.txt` is absent
and its output contract is unverified; do not run it as a repair.

## Release procedure

1. Edit sources / authored files.
2. `python3 scripts/build_study.py` — expect: 120 chapters split, 131 poems (14 判詞、15 人物),
   44 people, 3 plans (100/60/30 days). Any deviation means a source changed.
3. Bump the `?v=` query on `assets/css/study.css` and `assets/js/app.js` in
   `index.html`, and the matching `V` constant at the top of `assets/js/app.js`.
   Skipping this ships new HTML against stale cached CSS/JS.
4. `node --check assets/js/app.js`, `TZ=America/Los_Angeles node --test scripts/test_app.mjs`,
   and `/Users/ylsuen/.venv/bin/python scripts/verify_study.py`. Verify generated output
   is idempotent and original source/exam datasets are unchanged unless separately edited.
5. Local check: `python3 -m http.server` from this directory (the workspace
   preview config is `hlm-preview` in `/Users/ylsuen/CF/.claude/launch.json`).
   Walk 今日 / 通讀 / 真題 / 人物 / 詩詞 / 進度 / 讀法 and the AI drawer.
6. Review and stage only the task-owned files, then commit and push `origin main`.
   This publishes production; preserve unrelated dirty work.
7. Verify live per below before calling it done.

## Verification

1. Source: `git status --short --branch`, `git log -1 --format=%H`; compare the
   approved commit with the Pages build metadata.
2. Health: `GET https://hlm.bdfz.net/` plus `data/study/exams.json`,
   `data/study/chapters.json`, `data/study/people.json`, `data/study/poems.json`,
   `data/study/plans.json`, `data/authored/method.json`, `data/authored/research.json`, and one
   `data/text/ch001.json`. Require JSON content types and valid shapes.
   HTTP 200 is not acceptance — the rendered pages must be inspected.
3. Browser: the reader must render chapter text and the 本回真題／詩詞／人物 side
   panel; the exam page must expand a question and show answer + analysis; the
   plan page must show today's tasks once a pace is chosen.
4. AI: each attempt has a 25-second timeout, with one retry for network/timeouts,
   HTTP 429 or 5xx; response bodies are never copied to error logs. `POST https://ai.bdfz.net/` with an `Origin: https://hlm.bdfz.net` header
   returns `{answer}`. The gateway's key pool is intermittently flaky (503 /
   upstream 401); the client retries once and then shows a retry button. A single
   503 is not proof of a site regression; use a bounded test and record failure honestly.
   **Open risk**: hlm's enrollment in the APIS caller registry is unverified. The
   2026-09-09 notes recorded `log-only`; this leaf release does not re-certify hub
   configuration. If enforcement changes without hlm enrolled, calls may fail.
   Owner of that switch is the APIS shared-hub transaction, not this project.
5. Progress: `hlm_read_progress` / `chapter-第N章` itemKeys and
   `BdfzIdentity.syncProgress` are the pre-existing contract. Verify real
   authenticated progress after reload before claiming central integration.
6. Dependencies: User Center (`my.bdfz.net/site-auth.js`), the AI gateway, and
   `nav.bdfz.net` site list. Do not alter hubs from this project.
7. Rollback: capture the current and prior production Pages deployment IDs before
   release; code rollback does not restore learner/browser/central data.

## Navigation registration

`hlm.bdfz.net` is listed in four navigation surfaces and must stay consistent in
category and order across all of them:

1. `services/bdfz-nav/sites.json` — 操練 · 答題
2. `sites/tools/allinone-pages/public/index.html` `#portalGroups` — `drill`
3. `apps/bdfz-companion/constants/sites.ts` `SERVICES` — **not yet added**; that
   checkout sits on someone else's in-flight branch and the entry only takes
   effect with an APK rebuild. Handle it inside the Companion's own release.
4. `bdfz-user-center/src/index.js` `SITE_REGISTRY` (key `hlm`) — already present
   and untouched; its display title still reads `AI 红楼梦`. That repo has
   fingerprint interlocks and its own release gate, so do not edit it casually.

It also appears on the shared bookshelf `coread.bdfz.net`
(`sites/reading/bookshelf/public/books.js`, key `hlm`).

## Content authority

- Exam question text is transcribed from the Beijing paper / authoritative
  解析卷. Every item carries `answerSource`; 2026 carries `authorityNote` stating
  the official answer is not published.
- Years 2008, 2010–2013 and 2016 were checked and contain no 《紅樓夢》 content.
- The novel text and the poem annotations are public-domain / publicly available
  reference material; the character analyses, reading method and exam commentary
  are written for this site.

## 2026-09-17 content/reliability release

Asset version `2026091701`; 131 poems, including all 14 fifth-chapter verdicts
(11 正冊, 1 副冊, 2 又副冊; 釵黛合判); 17 research cards from 2 papers.
Qin Keqing is 正冊之十一. Corrected the character ownership of six earlier entries.
Keep the immutable source datasets intact; supplements belong in authored/verdicts.
Research cards are teaching paraphrases, not official exam answers; original PDFs
are not published. Every card preserves source pages, reading task, checks and limits.
The 2026 exam authority note remains intact and is included in AI requests.

[Design/code review](REVIEW_20260917.md) records findings and residual gaps.
Current deployment, source hash, live acceptance and rollback receipt:
`/Users/ylsuen/CF/reports/operations/hongloumeng-20260917/REPORT.md`.
Pre-release anchor: source `71ae682af487ac54c1f0653a7bb89d9da2c7cef8`, production
`6ab4c1aa-28d6-49c8-98f4-b0adaa0050a1`. Revert the release commit and push main
for a source-backed rollback, then verify deployed source and rendered pages.
No learner records, routes, bindings, domains or shared-hub contracts change.

## Appearance and page acceptance (2026091702)

`assets/js/appearance.js` snapshots the 17 presets from RDFZ Blog's
`packages/themes/src/palettes.ts` (source SHA in file), plus the original palette.
Reference: `/Users/ylsuen/CF/sites/tools/cy/docs/OPERATIONS.md` 色系 section and
`/Users/ylsuen/CF/platforms/rdfz-blog/docs/HANDOFF.md` palette constraints.
No runtime dependency or reverse change to those projects. Text/link colors are
adjusted to reach 7:1 body and 4.5:1 UI/link contrast across all four surfaces,
including dark mode and selected/action text. Decorative accents are not text colors.

Top-right 閱讀外觀 offers 18 presets and system/light/dark modes. New local key
`hlm_appearance` stores only palette/mode; legacy `hlm_theme` is read as fallback.
System mode follows subsequent OS changes. The dialog supports Escape, keyboard
focus containment and return; browser theme-color follows the selected background.
Bump index's appearance.js query with CSS/app/data V on releases.

Run the 9 Node tests including 36 palette/mode contrast checks; verify persistence,
all seven sections, all 44 people, 120 chapters, 17 exam details, 17 research cards,
poem filters, three plans and search. UI checks do not constitute a new claim that
every historical source character has been philologically corrected.

Asset/data version `2026091703` adds only the documented Siqi/Jia Zheng/Jia She
content corrections after the full page sweep. The release receipt records both
full-coverage acceptance and the subsequent focused readback.

## Coordinated palette surfaces (2026091704)

All 18 presets now tint page, cards, top bar, table of contents, reader context and
AI panel. Light surfaces retain the canonical wash; dark surfaces expand its hue
before dimming, then incorporate the accent. This preserves visible background
differences even when two presets share one accent. Top/sidebar surfaces are opaque
and selected table-of-contents rows use the tested wash, keeping contrast measurable.
The palette snapshot and local appearance/progress contracts remain unchanged.

10 Node tests pass, including all 36 palette/mode combinations, contrast across four
surfaces and a regression for shared-accent/different-wash backgrounds. Focused real
browser acceptance covers two distinct palettes in both modes, background readback,
theme-color, reload persistence, keyboard/Escape, and measured 1463×914 and 390×844
viewports. At the end of native dialog Tab order, activeElement briefly reports BODY before
returning to the close button; no background page control receives focus while modal.
The earlier complete content/page sweep remains applicable; no data regeneration
or AI provider probe is needed for this appearance-only follow-up.

GitHub main publishes through the existing Pages integration. The workspace's
single release receipt above holds the final source/deployment and live asset/browser
evidence. Immediate rollback anchor: `7351a68ff927c9c34042c0ee4f91c18c1bd34574`, Pages
`9e8fbf36-1a3e-4633-a09a-8b735931283e`; revert only the background release commit and
push main, then verify deployment/source and live appearance. Preserve learner data.
