/** 石頭收服 · 題庫型別。對應 scripts/play/build_bank.mjs 輸出的 play/bank/index.json 與 play/bank/<關卡>.json。 */

export type Family = "人" | "詩" | "事" | "書";
export type Tier = "N" | "R" | "SR" | "SSR";

export interface Card {
  id: string;
  family: Family;
  name: string;
  tier: Tier;
  ch?: number;
  gloss?: string;
  glossLang?: string;
  link: string;
}

export interface Rank {
  id: string;
  name: string;
  gloss: string;
  need: number;
  extra?: string;
}

export interface Region {
  id: string;
  name: string;
  desc: string;
  map: string;
  from: number | null;
  to: number | null;
  stages: string[];
}

export interface Stage {
  id: string;
  region: string;
  title: string;
  sub: string;
  count: number;
  foe: string;
  boss: boolean;
}

export interface Foe {
  id: string;
  name: string;
  official: string;
  lang?: string;
  source: { exam: string; label: string };
}

export interface BankIndex {
  version: string;
  cards: Card[];
  ranks: Rank[];
  regions: Region[];
  stages: Stage[];
  foes: Foe[];
}

export interface Text {
  text: string;
  lang?: string;
  label?: string;
}

export interface Option {
  id: string;
  text: string;
  lang?: string;
}

export interface Evidence {
  label: string;
  text: string;
  lang?: string;
  href?: string | null;
}

export interface Question {
  id: string;
  kind: string;
  type: number;
  card: string;
  stage: string;
  ch?: number;
  tier: Tier;
  prompt: string;
  promptLang?: string;
  quote?: Text;
  passage?: Text;
  image?: { src: string; alt: string; w: number; h: number };
  options: Option[];
  letters?: boolean;
  multi?: boolean;
  answer?: number;
  answers?: number[];
  exam?: { kind: string; label: string; answerSource?: string };
  year?: number;
  explain: { text: string; lang?: string; evidence?: Evidence[] };
}

export type RunMode = "stage" | "daily" | "free" | "revenge";

export interface Answer {
  q: string;
  pick: string;
  ms: number;
  correct: boolean;
  score: number;
}

export interface ServerStats {
  xp: number;
  prestige: number;
  rank: number;
  mastered: number;
  cleared: number;
  regions: number;
  done: number;
}
