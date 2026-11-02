/** 色系：四套依序循環（宣紙 → 青瓷 → 墨夜 → 玄青），點一下換下一套，不開選單。 */
import { useSyncExternalStore } from "react";

export const THEMES = [
  { id: "paper", name: "宣紙", dark: false, color: "#f4ead6" },
  { id: "celadon", name: "青瓷", dark: false, color: "#e3eee8" },
  { id: "ink", name: "墨夜", dark: true, color: "#15120f" },
  { id: "indigo", name: "玄青", dark: true, color: "#111926" },
] as const;
export type ThemeId = (typeof THEMES)[number]["id"];

const KEY = "hlm-play-theme";
const listeners = new Set<() => void>();

function read(): ThemeId {
  try {
    const v = localStorage.getItem(KEY);
    return THEMES.some((t) => t.id === v) ? (v as ThemeId) : "paper";
  } catch {
    return "paper";
  }
}

let current: ThemeId = read();

export function applyTheme(id: ThemeId = current): void {
  const meta = THEMES.find((t) => t.id === id) ?? THEMES[0];
  document.documentElement.dataset.theme = meta.id;
  document.documentElement.style.colorScheme = meta.dark ? "dark" : "light";
  const tag = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (tag) tag.content = meta.color;
}

export function cycleTheme(): string {
  const i = THEMES.findIndex((t) => t.id === current);
  const next = THEMES[(i + 1) % THEMES.length];
  current = next.id;
  applyTheme(current);
  try {
    localStorage.setItem(KEY, current);
  } catch {
    /* 無法保存也不影響本次 */
  }
  listeners.forEach((fn) => fn());
  return next.name;
}

export function useTheme(): ThemeId {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
}
