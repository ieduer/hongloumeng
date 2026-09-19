## Reader completion production accepted — 2026-09-19

Source `fc64a5eaeb9e00907bec6a2989125a18602b1a21` is deployed at `https://hlm.bdfz.net/`: Pages deployment `52e0411b-2edb-4a4f-a483-c7c15381deab`, deployment `52e0411b-2edb-4a4f-a483-c7c15381deab`. Source page, central progress/evaluation and an ordinary reload without a version override all passed for the authorized account and exactly one preverified shortest chapter (`12`). The central receipt is unique, sealed and eligible; no historical completion or grades were backfilled.

Evidence: `/Users/ylsuen/CF/reports/operations/reader-family-activation-serial2-20260919/acceptance-hlm.json`. Family report: `/Users/ylsuen/CF/reports/operations/reader-family-activation-serial3-20260919/REPORT.md`; shared receipt: `20260919-uc-reader-family-activation`. Existing content, paragraph/chapter IDs, identity, academic-year scoring policy and reaction/comment data are preserved.

Rollback anchor: `e9a223f8-7a94-483e-bc10-76bcbb929e7a`. Roll back the leaf before removing its additive central contract, retain valid forward learning evidence, and use the project's existing release/rollback checks.

This section supersedes earlier candidate/pending statements for this completion release only; unrelated historical incidents and follow-ups retain their own authority.

# Server-verified reader completion

Production accepted on 2026-09-19. Exact source, runtime, verification and rollback are recorded below and in the operations manual.

## Contract

`hlm` uses the `GROWTH_EVIDENCE` service binding to User Center entrypoint `HlmGrowthEvidence`. `/api/learning/start`, `/heartbeat`, `/complete` accept only the existing User Center session and same-origin requests. Source health compares the exact local manifest with the named central contract.

The immutable public manifest contains 120 chapters, digest `sha256:c1d2cb27f544277a28ff9f431dd595303080e118a1a8eaf187d7fee9c4539cdd`. Chapter and paragraph identifiers, source wording, reaction/comment data and the fixed academic-year scoring policy are preserved. Front matter is excluded where designated by the source.

The tracker samples visible paragraphs at 1250 ms intervals; only an acknowledged server checkpoint can complete a chapter. The unchanged minimums are 60% visibility and 800 ms per segment, plus the manifest chapter dwell requirement. For a paragraph taller than the viewport, every viewport-sized portion must first meet those same visibility/time minimums before its existing segment ID can be sampled. Hidden or departed pages cannot accrue time.

Completion is ordered: source evidence, central progress projection, central readback. Concurrent requests coalesce, failed projection is retryable without duplicate credit, and reload recognizes confirmed completion. Manual/local markers are not trusted completion. No historical self-reported progress is promoted without matching persisted server evidence.

## Verification and rollback

Focused tests: `node --test tests/reader-*.test.mjs` (23 assertions covering source origin/identity, exact health descriptor, visibility, offline recovery, delayed responses, retry and reload). Preserve the project's existing release checks in addition to these tests. Real browser source-to-central-to-reload acceptance remains a separate gate.

Release User Center additively before this leaf; publish the exact clean source; preserve all existing runtime settings and stateful bindings. Retain the previous immutable deployment as the rollback anchor. Roll back this leaf before removing its central contract; do not delete legitimate forward learning records. Exact runtime anchors and final results belong to the workspace release receipt and this project's operations/state documents.
