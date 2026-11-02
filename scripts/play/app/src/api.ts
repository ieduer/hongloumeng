/** 與伺服器（/api/play/*）的往來。戰報送不出去（離線、5xx）先放待送匣，下次開站或下一局補送；伺服器以同一局的鍵去重。 */
import type { ServerStats } from "./types";

export interface Me {
  pid: string;
  nick: string;
  user: { slug: string; name: string } | null;
  merged: boolean;
  bank: string;
  stats: ServerStats;
}

export interface RunPayload {
  mode: string;
  scope: string;
  seed: string;
  startedAt: number;
  answers: { q: string; pick: string; ms: number }[];
}

export interface RunResult {
  duplicate: boolean;
  run: { score: number; xp: number; correct: number; total: number };
  stats: ServerStats;
}


async function call<T>(path: string, init: RequestInit = {}): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  try {
    const res = await fetch(`/api/play/${path}`, {
      credentials: "include",
      ...init,
      headers: { "content-type": "application/json", ...(init.headers || {}) },
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) return { ok: false, status: res.status, error: data.error || `錯誤 ${res.status}` };
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, error: "連不上伺服器" };
  }
}

export const getMe = () => call<Me>("me");
export const setNick = (nick: string) => call<{ nick: string }>("nick", { method: "POST", body: JSON.stringify({ nick }) });
export const getBoard = (period: string) => call<{ rows: { nick: string; rank_idx: number; score: number }[] }>(`leaderboard?period=${period}`);
export const getCloudSave = () => call<{ save: unknown }>("save");
export const putCloudSave = (save: unknown) => call<{ save: unknown }>("save", { method: "PUT", body: JSON.stringify({ save }) });

const OUTBOX = "hlm-play-outbox";
const keyOf = (p: RunPayload) => `${p.mode}|${p.scope}|${p.seed}|${p.startedAt}`;

function readOutbox(): RunPayload[] {
  try {
    const v = JSON.parse(localStorage.getItem(OUTBOX) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeOutbox(list: RunPayload[]): void {
  try {
    if (list.length) localStorage.setItem(OUTBOX, JSON.stringify(list.slice(-40)));
    else localStorage.removeItem(OUTBOX);
  } catch {
    /* 存不下就算了 */
  }
}

export async function submitRun(p: RunPayload): Promise<RunResult | null> {
  const r = await call<RunResult>("run", { method: "POST", body: JSON.stringify(p) });
  if (r.ok) return r.data;
  if (r.status === 0 || r.status >= 500) {
    const list = readOutbox();
    if (!list.some((x) => keyOf(x) === keyOf(p))) writeOutbox([...list, p]);
  }
  return null;
}

/** 補送待送匣；成功或被伺服器明確拒絕的都移出，只留網路／5xx 失敗的。 */
export async function flushOutbox(): Promise<void> {
  const list = readOutbox();
  if (!list.length) return;
  const keep: RunPayload[] = [];
  for (const p of list) {
    const r = await call<RunResult>("run", { method: "POST", body: JSON.stringify(p) });
    if (!r.ok && (r.status === 0 || r.status >= 500)) keep.push(p);
  }
  writeOutbox(keep);
}

declare global {
  interface Window {
    BdfzIdentity?: { buildAuthUrl?: (kind: string, returnTo: string) => string };
  }
}

export function loginUrl(): string {
  const back = window.location.href;
  return window.BdfzIdentity?.buildAuthUrl?.("login", back) ?? `https://my.bdfz.net/?returnTo=${encodeURIComponent(back)}`;
}
