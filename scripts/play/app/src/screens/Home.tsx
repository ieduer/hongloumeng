import type { Ctx } from "../App";
import { art } from "../bank";
import { beijingDay, dailyStage, rankIndex } from "../game";

/** 首頁只有三個入口：今日試煉、隨緣一戰、復仇。其他都在底下分頁。 */
export default function Home({ ctx, busy }: { ctx: Ctx; busy: boolean }) {
  const { index, save, stats } = ctx;
  const prestige = stats?.prestige ?? save.xp;
  const rank = index.ranks[stats?.rank ?? rankIndex(index, prestige, false)];
  const nextRank = index.ranks[index.ranks.indexOf(rank) + 1];
  const daily = index.stages.find((s) => s.id === dailyStage(index));
  const playedToday = Boolean(daily && save.dayRuns[`${beijingDay()}|${daily.id}`]);
  const wrong = save.wrong.length;

  return (
    <section className="home">
      <header className="brand">
        <img src={art("logo")} alt="" width={72} height={72} />
        <div>
          <h1>石頭收服</h1>
          <p>收服《紅樓夢》裡的石靈：人物、判詞、詩詞、情節</p>
        </div>
      </header>

      <button className="rank-chip" onClick={() => ctx.go({ name: "me" })}>
        <img src={art(`rank-${index.ranks.indexOf(rank)}`)} alt="" width={44} height={44} />
        <span>
          <b>{rank.name}</b>
          <small>
            石力 {prestige.toLocaleString()}
            {nextRank && ` · 距${nextRank.name} ${(nextRank.need - prestige).toLocaleString()}`}
          </small>
        </span>
      </button>

      <div className="modes">
        <button className="mode big" disabled={busy} onClick={() => ctx.start("daily")} style={{ backgroundImage: `url(${art("mode-daily")})` }}>
          <span>
            <b>今日試煉</b>
            <small>
              {daily ? `${daily.title}・${daily.sub} · 全站同一題組` : ""}
              {playedToday ? " · 今天已戰" : ""}
            </small>
          </span>
        </button>
        <button className="mode" disabled={busy} onClick={() => ctx.start("free")} style={{ backgroundImage: `url(${art("mode-free")})` }}>
          <span>
            <b>隨緣一戰</b>
            <small>隨機一關，十題</small>
          </span>
        </button>
        <button className="mode" disabled={busy || !wrong} onClick={() => ctx.start("revenge")} style={{ backgroundImage: `url(${art("mode-wrong")})` }}>
          <span>
            <b>復仇</b>
            <small>{wrong ? `答錯的 ${wrong} 題再來` : "還沒有答錯的題"}</small>
          </span>
        </button>
      </div>

      <button className="link-board" onClick={() => ctx.go({ name: "board" })}>
        <img src={art("nav-board")} alt="" width={28} height={28} /> 排行榜
      </button>
      <p className="credit">
        題目依本站《紅樓夢》一百二十回原文、北京卷與指考真題編成。
        <a href="/">回紅樓夢整本書閱讀</a>
      </p>
    </section>
  );
}
