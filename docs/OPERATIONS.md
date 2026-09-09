# Hongloumeng operations

Reviewed 2026-09-09; owner suen. This is the local operations entrypoint.
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
  `data/authored/method.json`.
- Derived (regenerate with `python3 scripts/build_study.py`):
  `data/study/chapters.json`, `data/study/people.json`, `data/study/poems.json`,
  `data/study/plans.json`, `data/text/ch001.json … ch120.json`.

The build script is pure and idempotent: it reads the two source JSONs plus the
authored files and rewrites only the derived paths. It never touches sources.
`parse_hongloumeng.py` remains blocked — its root input `紅樓夢詩詞.txt` is absent
and its output contract is unverified; do not run it as a repair.

## Release procedure

1. Edit sources / authored files.
2. `python3 scripts/build_study.py` — expect: 120 chapters split, 130 poems,
   44 people, 3 plans (100/60/30 days). Any deviation means a source changed.
3. Bump the `?v=` query on `assets/css/study.css` and `assets/js/app.js` in
   `index.html`, and the matching `V` constant at the top of `assets/js/app.js`.
   Skipping this ships new HTML against stale cached CSS/JS.
4. `node --check assets/js/app.js`.
5. Local check: `python3 -m http.server` from this directory (the workspace
   preview config is `hlm-preview` in `/Users/ylsuen/CF/.claude/launch.json`).
   Walk 今日 / 通讀 / 真題 / 人物 / 詩詞 / 進度 / 讀法 and the AI drawer.
6. `git add -A && git commit && git push origin main`.
7. Verify live per below before calling it done.

## Verification

1. Source: `git status --short --branch`, `git log -1 --format=%H`; compare the
   approved commit with the Pages build metadata.
2. Health: `GET https://hlm.bdfz.net/` plus `data/study/exams.json`,
   `data/study/chapters.json`, `data/study/people.json`, `data/study/poems.json`,
   `data/study/plans.json`, `data/authored/method.json`, and one
   `data/text/ch001.json`. Require JSON content types and valid shapes.
   HTTP 200 is not acceptance — the rendered pages must be inspected.
3. Browser: the reader must render chapter text and the 本回真題／詩詞／人物 side
   panel; the exam page must expand a question and show answer + analysis; the
   plan page must show today's tasks once a pace is chosen.
4. AI: `POST https://ai.bdfz.net/` with an `Origin: https://hlm.bdfz.net` header
   returns `{answer}`. The gateway's key pool is intermittently flaky (503 /
   upstream 401); the client retries once and then shows a retry button. A single
   503 is not a site regression — repeat before escalating.
   **Open risk**: hlm's enrollment in the APIS caller registry is unverified. The
   gateway currently runs caller-auth in `log-only`, so calls succeed; if
   `enforce` is switched on without hlm enrolled, the AI drawer will 401.
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
3. `apps/bdfz-companion/constants/sites.ts` `SERVICES`
4. `bdfz-user-center/src/index.js` `SITE_REGISTRY` (key `hlm`)

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
