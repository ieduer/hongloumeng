-- 石頭收服（hlm.bdfz.net/play）。學習資料一律留存：每一局、每一題的作答、雲端存檔。
-- 不存個人資料：玩家只有隨機 pid、自訂暱稱；登入者另記 my.bdfz.net 的 slug。

CREATE TABLE IF NOT EXISTS players (
  pid TEXT PRIMARY KEY,
  nick TEXT NOT NULL DEFAULT '',
  uc_slug TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  prestige INTEGER NOT NULL DEFAULT 0,
  rank_idx INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS players_uc ON players(uc_slug);
CREATE INDEX IF NOT EXISTS players_prestige ON players(prestige DESC, xp DESC);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pid TEXT NOT NULL,
  mode TEXT NOT NULL,
  scope TEXT NOT NULL,
  seed TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  bank TEXT NOT NULL,
  total INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  score INTEGER NOT NULL,
  xp INTEGER NOT NULL,
  day TEXT NOT NULL,
  UNIQUE (pid, mode, scope, seed, started_at)
);
CREATE INDEX IF NOT EXISTS runs_pid ON runs(pid, day);
CREATE INDEX IF NOT EXISTS runs_day ON runs(day, score DESC);

-- 每一題的作答：card＝石靈卡，stage＝關卡；pick 是選項代號（多選題為排序後的代號串）
CREATE TABLE IF NOT EXISTS answers (
  run_id INTEGER NOT NULL,
  pid TEXT NOT NULL,
  q TEXT NOT NULL,
  pick TEXT NOT NULL,
  correct INTEGER NOT NULL,
  ms INTEGER NOT NULL,
  card TEXT NOT NULL,
  stage TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS answers_pid_card ON answers(pid, card);
CREATE INDEX IF NOT EXISTS answers_pid_q ON answers(pid, q);

CREATE TABLE IF NOT EXISTS saves (
  owner TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
