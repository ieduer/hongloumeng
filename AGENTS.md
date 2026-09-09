# Hongloumeng project instructions

Read `/Users/ylsuen/CF/AGENTS.md`, [operations](docs/OPERATIONS.md), and
[current state](PROJECT_STATE.md) before work. Owner: suen.

- Canonical checkout: `/Users/ylsuen/CF/sites/reading/hongloumeng`; configured
  Git remote `ieduer/hongloumeng`, local branch `main`.
- Pages project `hongloumeng` / `hlm.bdfz.net` is the cataloged runtime, deployed
  through the GitHub integration on `main`. Confirm the current deployment before
  treating a push as safe.
- 站點定位（2026-09-09 改版後）：《紅樓夢》整本書閱讀 ＋ 北京卷《紅樓夢》真題全編
  ＋ 人物分析 ＋ 詩詞判詞索引 ＋ 每日進度計畫 ＋ 日常閱讀方法。不再是聊天優先的介面。

## 資料分層（重要）

| 層 | 路徑 | 性質 | 可否重新產生 |
|---|---|---|---|
| 來源 | `data/hongloumeng.json`、`data/shici.json`、`data/紅樓夢詩詞.json`、`data/gaokao.json` | 原始輸入，**唯讀** | 否，來源不可再生 |
| 人工撰寫 | `data/authored/people.json`、`data/authored/method.json` | 人物分析與讀法，人手撰寫 | 否（改動＝重寫內容） |
| 人工撰寫 | `data/study/exams.json` | 北京卷真題全編，人手校訂 | 否 |
| 派生 | `data/study/{chapters,people,poems,plans}.json`、`data/text/ch***.json` | 由 `scripts/build_study.py` 產出 | 是，`python3 scripts/build_study.py` |

- **不要手改 `data/study/chapters.json`、`people.json`、`poems.json`、`plans.json`
  或 `data/text/`**——它們會被建置腳本整檔覆寫。改內容請改「來源」或「人工撰寫」層。
- `data/study/exams.json` 例外：它是人工撰寫的，建置腳本只讀不寫。
- `parse_hongloumeng.py` 期望的根目錄輸入 `紅樓夢詩詞.txt` 在 2026-09-07 稽核時已不存在；
  在來源出處恢復之前，不得執行它、不得重建 `data/hongloumeng.json` 或 `data/shici.json`。

## 真題內容的紅線

- 題面以北京卷原卷／權威解析卷為準；每一題的 `answerSource` 必須誠實標明來源
  （官方答案／依官方要點整理／本站示例／本站考訂）。
- 2026 年北京卷題面來自掃描件逐頁視覺核對稿，官方答案尚未公布，`authorityNote`
  必須保留該說明，不得偽稱官方答案。
- 新增或修訂真題時，須同時更新 `meta.years`、`meta.sourceNote` 與逐年核查結論。

## 其他

- 前端無建置步驟；`index.html` 直接引用 `assets/css/study.css` 與 `assets/js/app.js`，
  兩者都帶 `?v=` 版本參數，**改動必須同步升版**，否則使用者拿到舊快取。
- 閱讀進度沿用舊契約：localStorage `hlm_read_progress`，itemKey 形如 `chapter-第12章`，
  並經 `BdfzIdentity.syncProgress` 上報用戶中心。改 key 會使既有使用者進度歸零。
- AI 走 `https://ai.bdfz.net/`（POST `{prompt}` → `{answer}`）。本站右下角已有自己的
  「問」浮鈕，故導航 widget 以 `data-position="left"` 掛在左下。
- Never print browser storage, learner content, sessions, or AI request bodies.
  A caller/session change requires the workspace shared-hub transaction.
- Treat learner activity as `student_owned`; report aggregate outcomes only.
- Inspect Git and action-log ownership before mutation.
