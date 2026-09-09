# Hongloumeng current state

Last reviewed: 2026-09-09 America/Los_Angeles.
Operations authority: [docs/OPERATIONS.md](docs/OPERATIONS.md).

## 2026-09-09 全站改版（內容 ＋ 前端）

站點由「聊天優先的 AI 紅樓夢」改為「整本書閱讀 ＋ 北京卷真題」學習站。

新增內容：

- **北京卷《紅樓夢》真題全編 17 道**（`data/study/exams.json`），涵蓋 2005—2026 年，
  逐題含原題、材料、選項、答案（標明來源）、詳解、考點、備考提示、關聯回目與人物。
  分三層：名著閱讀核心題 8（2014、2017、2020、2021、2022、2024、2025、2026）、
  微寫作 5（2017—2021）、外圍 4（2005、2009、2015、2023）。
  2008、2010—2013、2016 已逐年核查，無《紅樓夢》內容。
- **人物分析 44 位**（`data/authored/people.json`）：判詞／曲歸屬、形象要點、
  可直接引用的關鍵情節（帶回目）、易錯與常考角度、關聯真題；出場分布由全文別名統計。
- **詩詞索引 130 篇**（派生自 `data/shici.json`）：依回目、人物、類別
  （判詞／十二支曲／詩詞／對聯／燈謎／誄賦）交叉檢索，附原註與鑑賞。
- **每日進度計畫三種**（100／60／30 天）：每天自動排定讀哪幾回、想什麼、誦哪幾首、
  練哪一道真題，加固定的「寫三行」；每七天一次回顧，九個里程碑附停頓建議。
- **日常閱讀方法建議**（`data/authored/method.json`）：七節，含四張必備的表、
  答題模板與常見失分點自查。

前端全部重寫：

- `index.html` ＋ `assets/css/study.css` ＋ `assets/js/app.js`（hash 路由 SPA，無建置步驟）。
  舊的 `assets/css/style.css` 已刪除。
- 七個分頁：今日／通讀／真題／人物／詩詞／進度／讀法，另有全站搜尋（可選搜正文）。
- 閱讀器：120 回分片載入（`data/text/`，平均 21KB），左側目錄可搜尋、標示已讀與有真題的回，
  右側「本回」邊欄串起真題／詩詞／人物；字級、行距可調，可劃記段落，鍵盤左右鍵翻回。
- 深淺色主題、行動端版面、列印樣式。
- AI 助讀改為右側抽屜，隨頁面提供情境化提問；上游失敗自動重試一次並給重試按鈕。

保留不變的契約：

- 進度 localStorage key `hlm_read_progress`、itemKey `chapter-第N章`、
  `BdfzIdentity.syncProgress` 上報——既有使用者的已讀進度不會歸零。
- AI 端點 `https://ai.bdfz.net/`，`{prompt}` → `{answer}`。
- 來源資料 `data/hongloumeng.json`、`data/shici.json` 一字未改。

## 狀態

- 本機驗證：七個分頁、閱讀器、真題展開、搜尋、深色、行動端、AI 抽屜（實測一次成功回答）
  皆通過；`node --check` 通過；`scripts/build_study.py` 產出穩定（120／130／44／3）。

### 部署記錄 2026-09-09

| 項目 | 動作 | 結果 |
|---|---|---|
| Pages `hongloumeng` | push `main` → `4c2b563` 觸發 Git 整合建置 | production `c6983950-76ce-441e-b473-3c074474d010`，deploy success |
| 線上驗證 | `/`、`data/study/{exams,chapters,people,poems,plans}.json`、`data/authored/method.json`、`data/text/ch001.json`、css/js | 全 200，型別正確；exams 17／people 44／poems 130／plans 100·60·30 |
| 瀏覽器驗證 | 首頁、`#/read/74`（正文 23 段實際渲染）、`#/exam/bj2026-15`（材料＋題幹＋答案解析） | 通過；主控台僅有 my.bdfz.net 未登入的 401 |
| Pages `allinone`（i.rdfzer.com） | 加入門戶 drill 組末位，push `ad96d69` → `npm run deploy` | 已上線，`npm run verify:live` result=pass |
| Pages `bdfz-nav`（nav.bdfz.net） | sites.json 操練·答題 加 `紅樓夢`，catalog 14 → 15，push `2c0372e` → wrangler pages deploy | 線上 `sites.json` version=15，drill 21 項含 hlm |

回滾錨點：Pages `hongloumeng` 前一個 production 部署
`c7237604-c369-4524-b5c0-fe6632c47e2d`（commit `afac37e86d`）。
`allinone` 與 `bdfz-nav` 的回滾為各自 repo 的前一提交（`3b3acc5` / `2f1da77`）。

### 導航登記狀態（四個面）

| 面 | 狀態 |
|---|---|
| `services/bdfz-nav/sites.json`（導航 js 的站點清單） | ✅ 已加、已發佈、已驗證 |
| `sites/tools/allinone-pages/public/index.html#portalGroups`（i.rdfzer.com） | ✅ 已加、已發佈、已驗證 |
| `bdfz-user-center/src/index.js` `SITE_REGISTRY` | ✅ key `hlm` 本來就在，未改動（該倉庫有指紋互鎖與獨立發佈閘；僅標題字樣仍是舊的「AI 红楼梦」） |
| `apps/bdfz-companion/constants/sites.ts` `SERVICES` | ⏸ **未加**：該倉庫目前 checkout 在他人進行中的分支 `codex/my-fleet-companion-verification-20260902`，且改動須配 APK 重新建置才生效。已把工作區還原為原狀，留待 Companion 自己的發佈交易處理 |

`coread.bdfz.net` 共讀書架的 `hlm` 條目本來就在，本次未動（其書卡文案仍寫「AI精讀專題」，
可在書架自己的發佈中順手更新為「北京卷真題全編」）。

## 未決 / 風險

- **APIS caller 名冊**：hlm 是否在 27 個註冊 caller 之列未經證實。目前 caller-auth 為
  `log-only`，AI 正常；若日後切到 `enforce` 而 hlm 未登記，AI 抽屜會 401。
  處置權在 APIS 共享樞紐交易，不在本專案。
- **2026 年真題答案**：官方答案未公布，站上標示為「依原著與評分慣例整理的要點」。
  官方答案公布後應回填並更新 `answerSource`。
- **`parse_hongloumeng.py`**：根目錄輸入 `紅樓夢詩詞.txt` 仍缺；來源出處與可測試的還原
  程序仍為 `review_required`，該腳本維持封存不執行。
- **後四十回**：站上多處註明為通行本續書，答題引證以前八十回為主；此判斷已寫入讀法頁。
