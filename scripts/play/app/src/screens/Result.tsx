import type { Ctx } from "../App";
import type { RunResult } from "../api";
import { FAMILY_NAME, art, cardById, foeArt, stoneArt } from "../bank";
import type { Answer, Question, RunMode } from "../types";

export interface ResultData {
  mode: RunMode;
  scope: string;
  title: string;
  foe: string;
  boss: boolean;
  questions: Question[];
  answers: Answer[];
  newlyMastered: string[];
  xp: number;
  server: RunResult | null;
  pending: boolean;
}

export default function Result({ ctx, data }: { ctx: Ctx; data: ResultData }) {
  const correct = data.answers.filter((a) => a.correct).length;
  const total = data.answers.length;
  const perfect = correct === total;
  const stars = perfect && total >= 10 ? 3 : correct >= total * 0.7 ? 2 : correct >= total * 0.4 ? 1 : 0;
  const foe = ctx.index.foes.find((f) => f.id === data.foe);
  const score = data.server?.run.score ?? data.answers.reduce((s, a) => s + a.score, 0);
  const xp = data.server?.run.xp ?? data.xp;
  const fresh = data.newlyMastered.map((id) => cardById(ctx.index, id)).filter((c) => c !== undefined);

  return (
    <section className="result">
      <div className={`victory ${perfect ? "perfect" : ""}`}>
        <img src={foe ? foeArt(foe.id, data.boss) : art("foe-1")} alt="" className={`foe ${correct >= total / 2 ? "beaten" : ""}`} width={112} height={112} />
        <h1>{perfect ? `${foe?.name || "誤讀妖"}退散` : correct >= total / 2 ? "擊退大半" : "下次再戰"}</h1>
        {data.mode === "stage" && (
          <div className="stars" aria-label={`${stars} 星`}>
            {[0, 1, 2].map((k) => (
              <img key={k} src={art("star")} alt="" className={k < stars ? "on" : ""} width={40} height={40} />
            ))}
          </div>
        )}
        <p className="tally">
          答對 {correct}/{total} · 得分 {score} · 石力 +{xp}
          {data.pending && <small>（送出中）</small>}
          {!data.pending && !data.server && <small>（離線，連上後補送）</small>}
        </p>
        {correct < total && <p className="tally">答錯的 {total - correct} 題已收進「復仇」，隨時可以再打一次。</p>}
      </div>

      {fresh.length > 0 && (
        <div className="captured">
          <h2>收服新石靈</h2>
          <div className="captured-row">
            {fresh.map((c) => (
              <button key={c.id} className="captured-card" onClick={() => ctx.go({ name: "codex" })}>
                <img src={stoneArt(c)} alt="" width={96} height={96} />
                <b>{c.name}</b>
                <small>{FAMILY_NAME[c.family]}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="actions">
        <button className="primary" onClick={() => ctx.start(data.mode, data.mode === "stage" ? data.scope : undefined)}>
          再戰一局
        </button>
        <button onClick={() => ctx.go({ name: data.mode === "stage" ? "journey" : "home" })}>{data.mode === "stage" ? "回旅程" : "回出戰"}</button>
      </div>
    </section>
  );
}
