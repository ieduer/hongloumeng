import { useCallback, useEffect, useMemo, useState } from "react";
import { flushOutbox, getCloudSave, getMe, putCloudSave, submitRun, type Me } from "./api";
import { art, loadIndex, loadStage, loadStages } from "./bank";
import { beijingDay, dailyStage, loadSave, mergeSave, pickRun, recordRun, storeSave, type Save } from "./game";
import { applyTheme } from "./theme";
import type { Answer, BankIndex, Question, RunMode, ServerStats } from "./types";
import Battle from "./screens/Battle";
import Board from "./screens/Board";
import Codex from "./screens/Codex";
import Home from "./screens/Home";
import Journey from "./screens/Journey";
import MeScreen from "./screens/Me";
import Result, { type ResultData } from "./screens/Result";
import Nav from "./components/Nav";

export type Tab = "home" | "journey" | "codex" | "me";
export type Screen =
  | { name: Tab }
  | { name: "board" }
  | { name: "battle"; mode: RunMode; scope: string; seed: string; title: string; foe: string; boss: boolean; questions: Question[]; startedAt: number }
  | { name: "result"; data: ResultData };

export interface Ctx {
  index: BankIndex;
  save: Save;
  me: Me | null;
  stats: ServerStats | null;
  go: (s: Screen) => void;
  start: (mode: RunMode, scope?: string) => Promise<void>;
  refreshMe: () => Promise<void>;
}

const BG: Record<string, string> = { home: "bg-home", journey: "bg-journey", codex: "bg-codex", me: "bg-me", board: "bg-board", battle: "bg-battle", result: "bg-home" };

export default function App() {
  const [index, setIndex] = useState<BankIndex | null>(null);
  const [error, setError] = useState("");
  const [save, setSave] = useState<Save>(() => loadSave());
  const [me, setMe] = useState<Me | null>(null);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [busy, setBusy] = useState(false);

  useEffect(() => applyTheme(), []);

  const refreshMe = useCallback(async () => {
    const r = await getMe();
    if (!r.ok) return;
    setMe(r.data);
    setStats(r.data.stats);
    // 登入者：本機與雲端存檔取大合併，再寫回雲端——換裝置不丟進度
    if (r.data.user) {
      const cloud = await getCloudSave();
      if (cloud.ok) {
        const merged = mergeSave(loadSave(), (cloud.data.save || {}) as Save);
        storeSave(merged);
        setSave(merged);
        await putCloudSave(merged);
      }
    }
  }, []);

  useEffect(() => {
    loadIndex().then(setIndex, (e: Error) => setError(e.message));
    flushOutbox().then(refreshMe);
  }, [refreshMe]);

  const go = useCallback((s: Screen) => {
    setScreen(s);
    window.scrollTo(0, 0);
  }, []);

  const start = useCallback(
    async (mode: RunMode, scope?: string) => {
      if (!index || busy) return;
      setBusy(true);
      try {
        let pool: Question[] = [];
        let realScope = scope || "";
        let seed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        let title = "";
        if (mode === "daily") {
          realScope = dailyStage(index);
          seed = "daily-" + beijingDay();
          pool = await loadStage(realScope, index.version);
          title = "今日試煉";
        } else if (mode === "revenge") {
          const wrongKeys = new Set(save.wrong);
          const stagesWithWrong = [...new Set(save.wrong.map((k) => k.split("|")[0]))].filter((id) => index.stages.some((s) => s.id === id));
          const all = await loadStages(stagesWithWrong.slice(-8), index.version);
          pool = all.filter((q) => wrongKeys.has(`${q.stage}|${q.id}`));
          realScope = "revenge";
          title = "復仇";
        } else if (mode === "free") {
          const pick = index.stages[Math.floor(Math.random() * index.stages.length)];
          realScope = pick.id;
          pool = await loadStage(pick.id, index.version);
          title = "隨緣一戰";
        } else {
          pool = await loadStage(realScope, index.version);
          const st = index.stages.find((s) => s.id === realScope);
          title = st ? `${st.title}・${st.sub}` : "";
        }
        const questions = pickRun(pool, seed, save);
        if (!questions.length) {
          setError(mode === "revenge" ? "沒有答錯的題，先去闖關吧" : "這一關暫時沒有題目");
          return;
        }
        const st = index.stages.find((s) => s.id === realScope);
        setError("");
        go({ name: "battle", mode, scope: realScope, seed, title, foe: st?.foe || index.foes[0].id, boss: Boolean(st?.boss), questions, startedAt: Date.now() });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [index, busy, save, go],
  );

  const finish = useCallback(
    async (b: Extract<Screen, { name: "battle" }>, answers: Answer[]) => {
      const { save: next, newlyMastered, xp } = recordRun(save, b.questions, answers, b.mode, b.scope, b.startedAt);
      storeSave(next);
      setSave(next);
      const data: ResultData = { mode: b.mode, scope: b.scope, title: b.title, foe: b.foe, boss: b.boss, questions: b.questions, answers, newlyMastered, xp, server: null, pending: true };
      go({ name: "result", data });
      const r = await submitRun({ mode: b.mode, scope: b.scope, seed: b.seed, startedAt: b.startedAt, answers: answers.map((a) => ({ q: a.q, pick: a.pick, ms: a.ms })) });
      if (r) setStats(r.stats);
      if (me?.user) await putCloudSave(next);
      setScreen((s) => (s.name === "result" && s.data === data ? { name: "result", data: { ...data, server: r, pending: false } } : s));
    },
    [save, me, go],
  );

  const ctx: Ctx | null = useMemo(() => (index ? { index, save, me, stats, go, start, refreshMe } : null), [index, save, me, stats, go, start, refreshMe]);

  const bg = BG[screen.name] || "bg-home";
  const tab: Tab | null = ["home", "journey", "codex", "me"].includes(screen.name) ? (screen.name as Tab) : null;

  return (
    <div className="app">
      <div className="backdrop" style={{ backgroundImage: `url(${art(bg)})` }} aria-hidden="true" />
      <div className="mist" aria-hidden="true" />
      <main className="screen" key={screen.name}>
        {!ctx && !error && <p className="loading">石頭正在甦醒……</p>}
        {error && (
          <div className="notice" role="alert">
            <p>{error}</p>
            <button onClick={() => (setError(""), go({ name: "home" }))}>知道了</button>
          </div>
        )}
        {ctx && screen.name === "home" && <Home ctx={ctx} busy={busy} />}
        {ctx && screen.name === "journey" && <Journey ctx={ctx} />}
        {ctx && screen.name === "codex" && <Codex ctx={ctx} />}
        {ctx && screen.name === "me" && <MeScreen ctx={ctx} />}
        {ctx && screen.name === "board" && <Board ctx={ctx} />}
        {ctx && screen.name === "battle" && <Battle ctx={ctx} battle={screen} onDone={(a) => finish(screen, a)} />}
        {ctx && screen.name === "result" && <Result ctx={ctx} data={screen.data} />}
      </main>
      {tab && <Nav tab={tab} go={go} />}
    </div>
  );
}
