# 石頭收服（hlm.bdfz.net/play/）

《紅樓夢》考點收服遊戲，仿字靈收服（wygame.bdfz.net）與筆靈收服（mh.bdfz.net/play）的玩法：
一局十題，答對收服「石靈」、削誤讀妖的血；石靈分人物、詩詞、情節、書史四族，答對同一張石靈三題（其中至少兩道不同的題）即識得。
題目依本站《紅樓夢》一百二十回原文（`data/text/`）、詩詞校訂層（`data/study/poems.json`、`data/authored/verdicts.json`）、
北京卷《紅樓夢》真題（`data/study/exams.json`）、指考國文涉及《紅樓夢》的全部 17 題原題，以及北京卷以外各地高考的 40 題（2004–2023；32 題經雙源核對，8 題只見單一來源，答案出處照實標明；原題 7 道選擇題、其餘改編）編成，每題附原文出處。
2026-11-02 第二輪（站長：「好，做第二輪」）加入各地高考兩關 `gk-1`、`gk-2`；單一來源的 8 題於第三輪依站長指示收入。2026-11-02 第三輪又按考點價值審核全庫：刪 95 題瑣碎題、補 102 題（判詞與曲全覆蓋、重要詩詞、人物結局、住處地名、文化常識），紀錄見 [QUALITY.md](QUALITY.md)。
2026-11-02 站長要求並授權：「基於 hlm.bdfz.net 結合指考和高考內紅樓夢全部考題，使用字靈文靈模式，將紅樓夢做成石頭收服」。

## 結構

| 位置 | 內容 | 性質 |
| --- | --- | --- |
| `scripts/play/content/cards.mjs` | 石靈卡目錄（人物 44、詩詞、情節、書史） | 人工撰寫 |
| `scripts/play/content/world.mjs` | 段位（頑石…解味）、八個區域、誤讀妖 | 人工撰寫 |
| `scripts/play/content/AUTHORING.md` | 題目撰寫規範（版本、格式、繁體、證據） | 規範 |
| `scripts/play/content/q/*.json` | 撰寫題（每題附逐字原文證據）＋同名 `.review.json` 審題紀錄 | 人工撰寫＋獨立審題 |
| `scripts/play/content/exam/zhikao.json` | 指考《紅樓夢》原題 17 題（取自 tw.bdfz.net 題庫，官方答案） | 來源快照 |
| `scripts/play/content/exam/zhikao-explain.json` | 指考原題解析 | 人工撰寫 |
| `scripts/play/content/exam/gaokao.json` | 北京卷以外的各地高考《紅樓夢》題 40 題（32 題至少兩個不同網域核對，8 題 `verify: "single_source"`；`sources` 為核對網址；選擇題 7 道收原題，其餘只作改編題證據） | 來源快照 |
| `scripts/play/check_facts.mjs` | 單檔核對：卡片、回次、繁體、引文與證據逐字出自所註來源 | 閘門 |
| `scripts/play/build_bank.mjs` | 建置：關卡分配、正解位置、真題原題 → `play/bank/`、`functions/_shared/play/bank-index.js`、`docs/play/AUDIT.md` | 產生器 |
| `play/bank/`、`functions/_shared/play/bank-index.js`、`docs/play/AUDIT.md` | 建置產物，**手改必失** | 派生 |
| `scripts/play/app/` | 前端原始碼（Vite＋React＋TS） | 原始碼 |
| `play/index.html`、`play/assets/` | 前端建置產物（提交，Pages 靜態服務） | 派生 |
| `scripts/play/art/` | 美術配方：`jobs.json`（Workers AI Lucid Origin 提示詞與種子）、`cfgen.py`、`post.py`（裁掉假印章假題字） | 配方 |
| `play/art/` | 美術產物（WebP）；導覽、節點、星、色系轉盤沿用字靈收服 v22；`exam-109-20-map.png` 取自 tw.bdfz.net 原卷附圖 | 派生 |
| `functions/api/play/[[path]].js`、`functions/_shared/play/engine.js` | `/api/play/*`：對錯、得分、石力由伺服器依索引重算；戰報冪等；跨站寫入拒絕 | 原始碼 |
| `migrations/0001_play.sql` | D1 `hongloumeng-play`（綁定 `PLAY_DB`，在 `wrangler.toml` 宣告） | 結構 |

## 建置

```bash
node scripts/play/check_facts.mjs scripts/play/content/q/*.json   # 逐字證據與格式
node scripts/play/build_bank.mjs                                     # 題庫、伺服器索引、審計
node --test tests/play-engine.test.mjs                               # 伺服器（node:sqlite 假 D1，用真遷移）
cd scripts/play/app && npm ci && npm run build                       # → play/index.html、play/assets/
```

題庫、`bank-index.js` 與前端必須同版發布：伺服器用索引判對錯（`/api/play/health` 回 `bank` 版本可對照）。
本機試玩：`.claude/launch.json` 的 `hlm-play`（`wrangler pages dev`，本機 D1 先 `wrangler d1 migrations apply hongloumeng-play --local`）。

## 規則

- **底本與版本**：本站底本是程乙本系統的簡體排印本；題目正解必須對讀人民文學出版社通行本的學生也成立，兩本關鍵字不同處不出題（見 `AUTHORING.md`）。
- **繁簡**：介面、題幹、選項、解析一律繁體；原文引文、北京卷題面保留簡體原樣，指考題面保留繁體原樣，並標 `lang`。
- **真題**：原題照原卷字母與題型（指考多選照多選），答案照官方；北京卷問答題只以「官方答案要點」改編，2026 年答案未公布須註明。
- **學習資料一律留存**（站長 2026-11-01）：D1 存每局、每題作答、雲端存檔；不存姓名、班級、IP 等個人資料。
  身分只認 my.bdfz.net 工作階段（`uc-<slug>`），匿名用隨機 cookie id，登入時匿名紀錄併入帳號。
- **計分**：與筆靈收服同一公式（稀有度底分＋題型加成＋速度＋連擊）；同一範圍同一北京日 ×1、×½、×¼、×⅒。
  石力＝對局入帳＋識得×30（傳說×60）＋三星過關×120＋全通一域×1500＋答對過的題×4；段位門檻 0／300／1000／2500／5000／9000／15000／23000／33000／45000，最高階「解味」另須全部石靈識得。
- 用戶中心目前只走既有的閱讀與學習紀錄契約；遊戲成績不寫入 UC 事件、不入 A+（要做須另建 UC 轉接器並走共享樞紐流程）。
