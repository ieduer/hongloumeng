import { useState } from "react";
import { createPortal } from "react-dom";
import type { Ctx } from "../App";
import { FAMILY_NAME, FAMILY_ORDER, FAMILY_STONE, TIER_LABEL, stoneArt } from "../bank";
import { cardProgress, isMastered } from "../game";
import type { Card, Family, Tier } from "../types";

const TIERS: Tier[] = ["SSR", "SR", "R", "N"];
const PAGE = 24;

/** 圖鑑：人物、詩詞、情節、書史四族分區，族內再按稀有度分組翻頁。沒遇過是暗石、遇過半亮、識得全亮。 */
export default function Codex({ ctx }: { ctx: Ctx }) {
  const { index, save } = ctx;
  const [fam, setFam] = useState<Family>("人");
  const [open, setOpen] = useState<Card | null>(null);
  const [pages, setPages] = useState<Record<string, number>>({});
  const mastered = index.cards.filter((c) => isMastered(save, c.id)).length;

  return (
    <section className="codex">
      <h1 className="page-title">
        圖鑑
        <small>
          識得 {mastered}/{index.cards.length}
        </small>
      </h1>
      <div className="seg" role="tablist">
        {FAMILY_ORDER.map((f) => {
          const all = index.cards.filter((c) => c.family === f);
          const got = all.filter((c) => isMastered(save, c.id)).length;
          return (
            <button key={f} role="tab" aria-selected={f === fam} className={f === fam ? "on" : ""} onClick={() => setFam(f)}>
              {FAMILY_NAME[f]}
              <small>
                {got}/{all.length}
              </small>
            </button>
          );
        })}
      </div>
      <p className="dim-note">{FAMILY_STONE[fam]}・答對同一張石靈三題、其中至少兩道不同的題，就算識得</p>
      {TIERS.map((t) => {
        const list = index.cards.filter((c) => c.family === fam && c.tier === t);
        if (!list.length) return null;
        const page = pages[`${fam}${t}`] || 0;
        const shown = list.slice(page * PAGE, (page + 1) * PAGE);
        return (
          <div key={t} className="tier-group">
            <h2 className={`tier-title t-${t}`}>
              {TIER_LABEL[t]}
              <small>
                {list.filter((c) => isMastered(save, c.id)).length}/{list.length}
              </small>
            </h2>
            <div className="cards">
              {shown.map((c) => {
                const p = cardProgress(save, c.id);
                const state = isMastered(save, c.id) ? "mastered" : save.sp[c.id] ? "met" : "unseen";
                return (
                  <button key={c.id} className={`spirit ${state} t-${c.tier}`} onClick={() => setOpen(c)}>
                    <img src={stoneArt(c)} alt="" width={84} height={84} loading="lazy" />
                    <b>{state === "unseen" ? "？？" : c.name}</b>
                    <i className="pips" aria-label={`進度 ${Math.min(3, p.net)}/3`}>
                      {[0, 1, 2].map((k) => (
                        <em key={k} className={k < p.net ? "on" : ""} />
                      ))}
                    </i>
                  </button>
                );
              })}
            </div>
            {list.length > PAGE && (
              <div className="pager">
                <button disabled={page === 0} onClick={() => setPages({ ...pages, [`${fam}${t}`]: page - 1 })}>
                  上一頁
                </button>
                <span>
                  {page + 1}/{Math.ceil(list.length / PAGE)}
                </span>
                <button disabled={(page + 1) * PAGE >= list.length} onClick={() => setPages({ ...pages, [`${fam}${t}`]: page + 1 })}>
                  下一頁
                </button>
              </div>
            )}
          </div>
        );
      })}
      {open && <CardSheet ctx={ctx} card={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function CardSheet({ ctx, card, onClose }: { ctx: Ctx; card: Card; onClose: () => void }) {
  const { save } = ctx;
  const p = cardProgress(save, card.id);
  const done = isMastered(save, card.id);
  const seen = Boolean(save.sp[card.id]);

  // 掛到 body：.screen 自成堆疊層，留在裡面會被底部選單蓋住
  return createPortal(
    <div className="sheet-wrap" onClick={onClose}>
      <article className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={seen ? card.name : "未遇見的石靈"}>
        <button className="close" onClick={onClose} aria-label="關閉">
          ×
        </button>
        <header>
          <img src={stoneArt(card)} alt="" width={112} height={112} className={done ? "" : "dim"} />
          <div>
            <h2>{seen ? card.name : "？？"}</h2>
            <p className="tag">
              {FAMILY_NAME[card.family]}・{TIER_LABEL[card.tier]}
            </p>
            {seen && card.gloss && <p lang={card.glossLang || "zh-Hant"}>{card.gloss}</p>}
          </div>
        </header>
        <p className="progress-line">
          {done ? "已識得" : seen ? `再答對 ${Math.max(0, 3 - p.net)} 題（其中至少 ${Math.max(0, 2 - p.distinct)} 道沒答對過的題）即可識得` : "還沒遇見：去旅程或今日試煉裡找它"}
        </p>
        {seen && (
          <a className="primary as-button" href={card.link} target="_blank" rel="noopener">
            {card.family === "人" ? "讀人物頁" : card.family === "詩" ? "讀詩詞與註解" : card.ch ? `讀第 ${card.ch} 回原文` : "讀讀法"}
          </a>
        )}
      </article>
    </div>,
    document.body,
  );
}
