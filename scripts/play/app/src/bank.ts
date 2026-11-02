/** 題庫：首頁只載索引（石靈、關卡、段位），進關才載那一關的分片。 */
import type { BankIndex, Card, Family, Question, Stage, Tier } from "./types";

export const BASE = import.meta.env.BASE_URL; // "/play/"

let indexPromise: Promise<BankIndex> | null = null;
const shards = new Map<string, Promise<Question[]>>();

export function loadIndex(): Promise<BankIndex> {
  if (!indexPromise) {
    indexPromise = fetch(`${BASE}bank/index.json`, { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(`題庫索引載入失敗（${r.status}）`);
      return r.json() as Promise<BankIndex>;
    });
    indexPromise.catch(() => (indexPromise = null)); // 失敗的請求不快取，下次重試
  }
  return indexPromise;
}

export function loadStage(stageId: string, version: string): Promise<Question[]> {
  const key = `${stageId}@${version}`;
  let p = shards.get(key);
  if (!p) {
    p = fetch(`${BASE}bank/${encodeURIComponent(stageId)}.json?v=${version}`).then(async (r) => {
      if (!r.ok) throw new Error(`關卡載入失敗（${r.status}）`);
      return ((await r.json()) as { questions: Question[] }).questions;
    });
    p.catch(() => shards.delete(key));
    shards.set(key, p);
  }
  return p;
}

export async function loadStages(stageIds: string[], version: string): Promise<Question[]> {
  const lists = await Promise.all(stageIds.map((s) => loadStage(s, version)));
  return lists.flat();
}

export const stageById = (index: BankIndex, id: string): Stage | undefined => index.stages.find((s) => s.id === id);
export const cardById = (index: BankIndex, id: string): Card | undefined => index.cards.find((c) => c.id === id);

export const FAMILY_ORDER: Family[] = ["人", "詩", "事", "書"];
export const FAMILY_NAME: Record<Family, string> = { 人: "人物", 詩: "詩詞", 事: "情節", 書: "書史" };
export const FAMILY_STONE: Record<Family, string> = { 人: "玉石", 詩: "墨石", 事: "丹石", 書: "青石" };
const FAMILY_ART: Record<Family, string> = { 人: "ren", 詩: "poem", 事: "event", 書: "book" };
export const TIER_LABEL: Record<Tier, string> = { N: "常見", R: "稀有", SR: "史詩", SSR: "傳說" };

/** 每張石靈依族與稀有度對應一塊靈石圖。 */
export const stoneArt = (card: Pick<Card, "family" | "tier">) => `${BASE}art/stone-${FAMILY_ART[card.family]}-${card.tier.toLowerCase()}.webp`;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function foeArt(foeId: string, boss: boolean): string {
  if (boss) return `${BASE}art/foe-boss.webp`;
  return `${BASE}art/foe-${(hash(foeId) % 4) + 1}.webp`;
}

export const art = (name: string) => `${BASE}art/${name}.webp`;
export const LETTERS = "ABCDE";
