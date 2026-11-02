import { useCallback, useEffect, useRef, useState } from "react";
import type { Ctx, Screen } from "../App";
import { BASE, FAMILY_NAME, LETTERS, cardById, foeArt } from "../bank";
import { correctSet, isCorrect, limitOf, pickId, questionScore } from "../game";
import type { Answer } from "../types";

type BattleScreen = Extract<Screen, { name: "battle" }>;

/** 一局十題。答對削誤讀妖一格血；答完先看解析與原文，再按「下一題」。真題照原卷字母與題型（含多選）。 */
export default function Battle({ ctx, battle, onDone }: { ctx: Ctx; battle: BattleScreen; onDone: (a: Answer[]) => void }) {
  const { questions } = battle;
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [picked, setPicked] = useState<number[] | null>(null); // 交卷後的選擇；null＝作答中
  const [marks, setMarks] = useState<number[]>([]); // 多選題作答中勾選的選項
  const [combo, setCombo] = useState(0);
  const [left, setLeft] = useState(1);
  const shownAt = useRef(Date.now());
  const explainRef = useRef<HTMLElement>(null);
  const q = questions[i];
  const foe = ctx.index.foes.find((f) => f.id === battle.foe) || ctx.index.foes[0];
  const hits = answers.filter((a) => a.correct).length;
  const card = cardById(ctx.index, q.card);
  const done = picked !== null;
  const right = done && isCorrect(q, picked);

  const choose = useCallback(
    (picks: number[]) => {
      if (picked !== null) return;
      const ms = Date.now() - shownAt.current;
      const correct = picks.length > 0 && isCorrect(q, picks);
      const nextCombo = correct ? combo + 1 : 0;
      const score = questionScore(q, correct, ms, nextCombo);
      setCombo(nextCombo);
      setPicked(picks);
      setAnswers((a) => [...a, { q: q.id, pick: pickId(q, picks), ms, correct, score }]);
    },
    [picked, q, combo],
  );

  // 每題倒數：時間到算答錯，但仍顯示解析
  useEffect(() => {
    if (picked !== null) return;
    shownAt.current = Date.now();
    const limit = limitOf(q);
    const t = window.setInterval(() => {
      const rest = 1 - (Date.now() - shownAt.current) / limit;
      setLeft(Math.max(0, rest));
      if (rest <= 0) choose([]);
    }, 200);
    return () => window.clearInterval(t);
  }, [i, picked, q, choose]);

  useEffect(() => {
    if (picked !== null) explainRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [picked]);

  const next = useCallback(() => {
    if (i + 1 >= questions.length) {
      onDone(answers);
      return;
    }
    setI(i + 1);
    setPicked(null);
    setMarks([]);
    setLeft(1);
  }, [i, questions.length, answers, onDone]);

  const tap = (k: number) => {
    if (done) return;
    if (q.multi) setMarks((m) => (m.includes(k) ? m.filter((x) => x !== k) : [...m, k]));
    else choose([k]);
  };

  // 鍵盤：1–5 選（多選為勾選），Enter 交卷或下一題
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = Number(e.key);
      if (n >= 1 && n <= q.options.length) tap(n - 1);
      else if (e.key === "Enter") {
        if (done) next();
        else if (q.multi && marks.length) choose(marks);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const hp = questions.length - hits;
  const truth = correctSet(q);
  const long = q.options.some((o) => o.text.length > 14) || Boolean(q.letters);

  return (
    <section className="battle">
      <header className="foe-bar">
        <img className={`foe ${done && right ? "hit" : ""}`} src={foeArt(foe.id, battle.boss)} alt="" width={72} height={72} />
        <div className="foe-meta">
          <strong>{foe.name}</strong>
          <div className="hp" aria-label={`誤讀妖剩 ${hp} 格`}>
            {questions.map((_, k) => (
              <i key={k} className={k < hp ? "on" : ""} />
            ))}
          </div>
          <small className="foe-says" lang={foe.lang || "zh-Hant"}>
            「{foe.official}」
          </small>
        </div>
        <span className="count">
          {i + 1}/{questions.length}
          {combo >= 2 && <b className="combo">{combo} 連擊</b>}
        </span>
      </header>

      <div className="timer" aria-hidden="true">
        <i style={{ transform: `scaleX(${done ? 0 : left})` }} />
      </div>

      <article className={`card q-${q.kind}`}>
        {q.exam && <p className="exam-tag">{q.exam.label}</p>}
        {q.passage && (
          <div className="passage" lang={q.passage.lang} tabIndex={0} aria-label="閱讀材料">
            {q.passage.text.split(/\n+/).map((p, k) => (
              <p key={k}>{p}</p>
            ))}
          </div>
        )}
        {q.image && <img className="exam-figure" src={`${BASE}${q.image.src}`} alt={q.image.alt} width={q.image.w} height={q.image.h} />}
        <h2 lang={q.promptLang || "zh-Hant"}>
          {q.prompt.split(/\n+/).map((p, k) => (
            <span key={k} className="prompt-line">
              {p}
            </span>
          ))}
        </h2>
        {q.multi && !done && <p className="hint">多選題：選出所有正確的選項，再按「確定」。</p>}
        {q.quote && (
          <blockquote className="quote" lang={q.quote.lang}>
            {q.quote.text}
            {/* 出處標籤（篇名、回次）作答後才顯示：「出自哪一首」「哪一回」這類題，標籤本身就是答案 */}
            {q.quote.label && done && <small>{q.quote.label}</small>}
          </blockquote>
        )}
        <div className={`opts ${long ? "sentences" : ""}`}>
          {q.options.map((o, k) => {
            const state = !done ? (marks.includes(k) ? "marked" : "") : truth.includes(k) ? "right" : picked.includes(k) ? "wrong" : "dim";
            return (
              <button key={o.id} className={`opt ${state}`} onClick={() => tap(k)} disabled={done} aria-pressed={q.multi ? marks.includes(k) : undefined}>
                {q.letters && <b className="letter">{LETTERS[k]}</b>}
                <span lang={o.lang || "zh-Hant"}>{o.text}</span>
              </button>
            );
          })}
        </div>
        {q.multi && !done && (
          <button className="primary confirm" disabled={!marks.length} onClick={() => choose(marks)}>
            確定
          </button>
        )}
      </article>

      {done && (
        <aside ref={explainRef} className={`explain ${right ? "ok" : "no"}`}>
          <p className="verdict">{right ? "收服" : picked.length === 0 ? "時間到" : "差一點"}</p>
          {card && (
            <p className="spirit-line">
              石靈 <b>{card.name}</b>
              <em>（{FAMILY_NAME[card.family]}）</em>
            </p>
          )}
          {(q.multi || q.letters) && (
            <p className="answer-line">
              答案：{truth.map((k) => LETTERS[k]).join("、")}
              {q.exam?.answerSource && <small>（{q.exam.answerSource}）</small>}
            </p>
          )}
          {q.explain.text && (
            <p className="explain-text" lang={q.explain.lang || "zh-Hant"}>
              {q.explain.text}
            </p>
          )}
          {q.explain.evidence && q.explain.evidence.length > 0 && (
            <details open={!right}>
              <summary>原文在這裡</summary>
              {q.explain.evidence.map((ev, k) => (
                <p key={k} className="basis">
                  <span lang={ev.lang || "zh-Hans"}>「{ev.text}」</span>
                  <small>
                    — {ev.label}
                    {ev.href && (
                      <>
                        {" · "}
                        <a href={ev.href} target="_blank" rel="noopener">
                          讀原文
                        </a>
                      </>
                    )}
                  </small>
                </p>
              ))}
            </details>
          )}
          <button className="primary" onClick={next}>
            {i + 1 >= questions.length ? "看戰果" : "下一題"}
          </button>
        </aside>
      )}
    </section>
  );
}
