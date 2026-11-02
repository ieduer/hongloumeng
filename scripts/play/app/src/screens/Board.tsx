import { useEffect, useState } from "react";
import type { Ctx } from "../App";
import { getBoard } from "../api";

const PERIODS = [
  { id: "day", name: "今日試煉" },
  { id: "week", name: "近七天" },
  { id: "all", name: "總榜" },
];

export default function Board({ ctx }: { ctx: Ctx }) {
  const [period, setPeriod] = useState("day");
  const [rows, setRows] = useState<{ nick: string; rank_idx: number; score: number }[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setRows(null);
    setErr("");
    getBoard(period).then((r) => (r.ok ? setRows(r.data.rows) : setErr(r.error)));
  }, [period]);

  return (
    <section className="board">
      <h1 className="page-title">
        <button className="back" onClick={() => ctx.go({ name: "home" })} aria-label="返回">
          ‹
        </button>
        排行榜
      </h1>
      <div className="seg">
        {PERIODS.map((p) => (
          <button key={p.id} className={p.id === period ? "on" : ""} onClick={() => setPeriod(p.id)}>
            {p.name}
          </button>
        ))}
      </div>
      <p className="dim-note">{period === "day" ? "今日試煉只算每人今天第一局" : period === "week" ? "近七天（北京時間）所得石力" : "依石力排序"}</p>
      {err && <p className="msg">{err}</p>}
      {!rows && !err && <p className="loading">載入中……</p>}
      {rows && !rows.length && <p className="empty">還沒有人上榜，去拿第一吧。</p>}
      {rows && rows.length > 0 && (
        <ol className="rows">
          {rows.map((r, k) => (
            <li key={k} className={k < 3 ? `top top${k + 1}` : ""}>
              <span className="pos">{k + 1}</span>
              <span className="who">
                {r.nick || "無名石兄"}
                <small>{ctx.index.ranks[r.rank_idx]?.name}</small>
              </span>
              <b>{r.score.toLocaleString()}</b>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
