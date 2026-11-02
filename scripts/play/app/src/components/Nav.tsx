import { art } from "../bank";
import type { Screen, Tab } from "../App";

const ITEMS: { tab: Tab; label: string; icon: string }[] = [
  { tab: "home", label: "出戰", icon: "nav-home" },
  { tab: "journey", label: "旅程", icon: "nav-journey" },
  { tab: "codex", label: "圖鑑", icon: "nav-codex" },
  { tab: "me", label: "我", icon: "nav-me" },
];

export default function Nav({ tab, go }: { tab: Tab; go: (s: Screen) => void }) {
  return (
    <nav className="nav" aria-label="主選單">
      {ITEMS.map((it) => (
        <button key={it.tab} className={it.tab === tab ? "on" : ""} onClick={() => go({ name: it.tab })} aria-current={it.tab === tab ? "page" : undefined}>
          <img src={art(it.icon)} alt="" width={36} height={36} />
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  );
}
