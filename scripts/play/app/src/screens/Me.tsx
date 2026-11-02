import { useState } from "react";
import type { Ctx } from "../App";
import { loginUrl, setNick } from "../api";
import { art } from "../bank";
import { isMastered, rankIndex } from "../game";
import { cycleTheme, THEMES, useTheme } from "../theme";

export default function Me({ ctx }: { ctx: Ctx }) {
  const { index, save, me, stats } = ctx;
  const theme = useTheme();
  const [nick, setNickText] = useState(me?.nick || "");
  const [msg, setMsg] = useState("");
  const prestige = stats?.prestige ?? save.xp;
  const idx = stats?.rank ?? rankIndex(index, prestige, false);
  const rank = index.ranks[idx];
  const next = index.ranks[idx + 1];
  const pct = next ? Math.min(100, Math.round(((prestige - rank.need) / (next.need - rank.need)) * 100)) : 100;
  const mastered = stats?.mastered ?? index.cards.filter((c) => isMastered(save, c.id)).length;
  const cleared = stats?.cleared ?? Object.values(save.stars).filter((s) => s >= 3).length;
  const done = stats?.done ?? Object.values(save.seen).filter((s) => s.c > 0).length;
  const totalQ = index.stages.reduce((n, s) => n + s.count, 0);

  async function saveNick() {
    const r = await setNick(nick.trim());
    setMsg(r.ok ? "已更新" : r.error);
    if (r.ok) await ctx.refreshMe();
  }

  return (
    <section className="me">
      <div className="rank-card">
        <img src={art(`rank-${idx}`)} alt="" width={120} height={120} />
        <h1>{rank.name}</h1>
        <p className="gloss">{rank.gloss}</p>
        <div className="bar" aria-label={`距下一段 ${pct}%`}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <p className="wenqi">
          石力 {prestige.toLocaleString()}
          {next && ` / ${next.need.toLocaleString()}（${next.name}）`}
          {next?.extra && <small>{next.extra}</small>}
        </p>
      </div>

      <dl className="stats">
        <div>
          <dt>識得</dt>
          <dd>
            {mastered}/{index.cards.length}
          </dd>
        </div>
        <div>
          <dt>三星</dt>
          <dd>
            {cleared}/{index.stages.length}
          </dd>
        </div>
        <div>
          <dt>答對題</dt>
          <dd>
            {done}/{totalQ}
          </dd>
        </div>
        <div>
          <dt>對局</dt>
          <dd>{save.runs}</dd>
        </div>
      </dl>

      <div className="panel">
        {me?.user ? (
          <p>
            已用 my.bdfz.net 帳號 <b>{me.user.name || me.user.slug}</b> 登入，進度跨裝置同步。
          </p>
        ) : (
          <p>
            沒登入也能玩，進度存在這台裝置。<a href={loginUrl()}>登入 my.bdfz.net</a> 就能跨裝置同步。
          </p>
        )}
        <label className="nick">
          排行榜暱稱
          <span>
            <input value={nick} maxLength={12} onChange={(e) => setNickText(e.target.value)} placeholder={me?.nick || "無名石兄"} />
            <button onClick={saveNick} disabled={!nick.trim() || nick.trim() === me?.nick}>
              改
            </button>
          </span>
        </label>
        {msg && <p className="msg">{msg}</p>}
      </div>

      <div className="row-actions">
        <button onClick={() => setMsg(`色系：${cycleTheme()}`)}>
          <img src={art("dial")} alt="" width={28} height={28} />
          色系・{THEMES.find((t) => t.id === theme)?.name}
        </button>
        <button onClick={() => ctx.go({ name: "board" })}>
          <img src={art("nav-board")} alt="" width={28} height={28} />
          排行榜
        </button>
      </div>

      <details className="ladder">
        <summary>十階石力</summary>
        <ol>
          {index.ranks.map((r, k) => (
            <li key={r.id} className={k === idx ? "on" : k < idx ? "past" : ""}>
              <b>{r.name}</b>
              <span>{r.gloss}</span>
              <small>
                {r.need.toLocaleString()}
                {r.extra && `・${r.extra}`}
              </small>
            </li>
          ))}
        </ol>
        <p className="note">石力＝答題所得＋識得石靈、三星過關、走完區域、答對過的題的加成。同一關同一天重玩，所得依次減半。</p>
      </details>
    </section>
  );
}
