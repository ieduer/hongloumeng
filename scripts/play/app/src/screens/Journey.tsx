import type { Ctx } from "../App";
import { art } from "../bank";

const LANE = [18, 50, 82, 50]; // 節點左右蜿蜒：左、中、右、中
const ROW = 96;

/** 旅程：八個區域由上而下連成一條路，每關一盞燈；全部開放，下一個沒拿星的關會亮著。 */
export default function Journey({ ctx }: { ctx: Ctx }) {
  const { index, save } = ctx;
  const nextId = index.stages.find((s) => !save.stars[s.id])?.id;

  return (
    <section className="journey">
      <h1 className="page-title">旅程</h1>
      {index.regions.map((r) => {
        const total = r.stages.length * 3;
        const got = r.stages.reduce((n, id) => n + (save.stars[id] || 0), 0);
        const height = r.stages.length * ROW + 30;
        return (
          <div key={r.id} className="region" style={{ backgroundImage: `url(${art(r.map)})` }}>
            <header>
              <h2>{r.name}</h2>
              <small>
                {got}/{total} 星
              </small>
            </header>
            <p className="region-desc">
              {r.from ? `第${r.from}–${r.to}回 · ` : ""}
              {r.desc}
            </p>
            <div className="path" style={{ height: `${height}px` }}>
              <svg className="trail" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
                <polyline points={r.stages.map((_, k) => `${LANE[k % 4]},${k * ROW + 40}`).join(" ")} vectorEffect="non-scaling-stroke" />
              </svg>
              <ol>
                {r.stages.map((id, k) => {
                  const st = index.stages.find((s) => s.id === id)!;
                  const stars = save.stars[id] || 0;
                  const state = stars ? "clear" : id === nextId ? "lit" : "off";
                  return (
                    <li key={id} style={{ left: `${LANE[k % 4]}%`, top: `${k * ROW + 12}px` }}>
                      <button className={`node ${state}`} onClick={() => ctx.start("stage", id)} aria-label={`${st.title}・${st.sub}，${st.count} 題，${stars} 星`}>
                        <img src={art(`node-${state}`)} alt="" width={56} height={56} />
                      </button>
                      <span className="node-label">
                        <i className="node-stars">
                          {"★".repeat(stars)}
                          {"☆".repeat(3 - stars)}
                        </i>
                        {st.title}
                        <br />
                        {st.sub}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        );
      })}
    </section>
  );
}
