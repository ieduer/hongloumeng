// 石頭收服 · 來源讀取與比對。原文一律逐字（hlm 站底本，簡體）；比對時只看漢字與字母數字，標點與空白不計。
import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(new URL("../../../", import.meta.url).pathname);
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

export const norm = (s) => String(s ?? "").normalize("NFC").replace(/[^\p{Script=Han}\p{L}\p{N}]/gu, "");

let chapters = null;
export function chapterText(n) {
  if (!chapters) {
    chapters = new Map();
    // 回目也算本回原文（底本回目有錯字：簿命郎、大承苔挞、宝王瞒赃、锦农军、美优怜，不可引用）
    for (let i = 1; i <= 120; i++) {
      const c = read(`data/text/ch${String(i).padStart(3, "0")}.json`);
      chapters.set(i, `${c.title}\n${c.content}`);
    }
  }
  return chapters.get(Number(n));
}

let poems = null;
export function poemById(id) {
  if (!poems) {
    poems = new Map();
    for (const p of read("data/study/poems.json").items) poems.set(p.id, p);
    // 判詞的校訂層（2026-09-17）：lines 以 verdicts.json 為準（秦可卿判詞「幻情身」「造釁開端」）。
    for (const v of read("data/authored/verdicts.json").items) if (v.lines && poems.has(v.id)) poems.set(v.id, { ...poems.get(v.id), lines: v.lines });
  }
  return poems.get(id);
}
export const poemText = (p) => [...(p.lines || []), p.text || ""].join("\n");

/** 在原文裡找出與 needle（只比漢字等）相符的那一段，回傳原樣切片；找不到回 null。 */
export function locate(haystack, needle) {
  const n = norm(needle);
  if (n.length < 2) return null;
  const map = [];
  let flat = "";
  for (let i = 0; i < haystack.length; i++) {
    const ch = haystack[i];
    if (/[\p{Script=Han}\p{L}\p{N}]/u.test(ch)) {
      flat += ch;
      map.push(i);
    }
  }
  const at = flat.indexOf(n);
  if (at < 0) return null;
  const start = map[at], end = map[at + n.length - 1] + 1;
  return { start, end, slice: haystack.slice(start, end), count: flat.split(n).length - 1 };
}

let exams = null;
export function examById(id) {
  if (!exams) {
    exams = new Map();
    for (const it of read("data/study/exams.json").items) exams.set(it.id, { label: `北京卷 ${it.year}（${it.id}）`, text: [it.material?.source, it.material?.text, it.material?.footnote, it.stem, ...(it.options || []).map((o) => `${o.key}．${o.text}`), it.answer, it.analysis].filter(Boolean).join("\n") });
    for (const q of read("scripts/play/content/exam/zhikao.json").questions) exams.set(q.id, { label: `指考 ${q.year_label} 第 ${q.q_num} 題`, text: [q.reading_passage, q.stem, ...(q.options || []).map((o) => `${o.key || o.label}．${o.text}`)].filter(Boolean).join("\n") });
    // 北京卷以外的高考題（研究核對後的來源快照；簡答題的答案要點也是證據）
    const gk = path.join(ROOT, "scripts/play/content/exam/gaokao.json");
    if (fs.existsSync(gk))
      for (const q of JSON.parse(fs.readFileSync(gk, "utf8")).questions)
        exams.set(q.id, { label: q.label, text: [q.material, q.stem, ...(q.options || []).map((o) => `${o.key}．${o.text}`), q.answerText || q.answer].filter(Boolean).join("\n") });
  }
  return exams.get(id);
}

// 本站撰寫的參考層（只供「書」類常識題當證據）：讀法、人物、研究考點卡。
const DOCS = { method: "data/authored/method.json", people: "data/authored/people.json", research: "data/authored/research.json" };
const docCache = new Map();
export function docText(name) {
  if (!DOCS[name]) return null;
  if (!docCache.has(name)) docCache.set(name, JSON.stringify(read(DOCS[name])));
  return docCache.get(name);
}

export function sourceOf(ref) {
  if (ref && ref.exam) return examById(ref.exam) || null;
  if (ref && ref.doc) return docText(ref.doc) ? { label: `本站${ref.doc}`, text: docText(ref.doc), doc: true } : null;
  if (ref && Number.isInteger(ref.ch)) return { label: `第${ref.ch}回`, text: chapterText(ref.ch) };
  if (ref && ref.poem) {
    const p = poemById(ref.poem);
    return p ? { label: `〈${p.title}〉`, text: poemText(p) } : null;
  }
  return null;
}

// 撰寫文字的簡體字防線（只查本站撰寫的題幹、選項、解析；原文引文一字不改）。
// 取自墨痕題庫建置的字表，再補《紅樓夢》人名地名常見簡體字；云、里、后、干、余、系、叶等繁體也通用的字不列。
export const SIMPLIFIED = new Set(
  ("们这说为见长门问时间过还会对开关发经现实点与东车书学习爱听话语认让进远连运选边从众优价体传伤伦伟侧兴养农决况" +
    "净凉减刘则刚创删剧劝办务动劳势区医华单卖卫厂历压厅县参双变叙号叹吗员启响团园围图圆场坏坚块处备复够头夸夺奋奖" +
    "妈妇娱孙宁宝实审宫宽宾寻导寿将尔尘尝层属岁岛币帅师帐带帮庆库应废异弃张弥弯弹强归录彻径忆忧怀态怜总恋恶恼悦" +
    "悬惊惧惨惯愤愿戏战扑执扩扫扬扰抚抢护报担拟拥择挂挡挣挤挥损换据摆摇敌数斋旧显晋晒晓暂术机杀杂权条来杨极构" +
    "枪标树样桥梦检楼欢欧毁毕气汇汉沟没泪泽洁浅测济浓涂润涨渐湿满滥灭灯灵灾烂热烦烧爷牵犹独狮狱猎献环画畅疗盐" +
    "监盖盘矿码础确碍礼祷祸离种积称稳穷竞笔笼筑签简粮紧纠红约级纪纯纲纳纵纷纸纹线练组细织终结绕绘给络绝统继绩" +
    "续绳维绿缓编缘缩网罗罚罢聪肃肠肤脑脚脱脸腾舰艰艺节苍苏药获营蓝虑虽补袭装观规视览觉触誉计订讨训议讯" +
    "记讲许论设访证评识诉词译试诗诚询该详误请诸读课谁调谈谋谓谢谦谨贝负贡财责贤败货质贫购贯贵费贺资赏赖赛" +
    "赞赢赶趋跃践踪轨轮软轻载较辅辆辈辉辑输辞达迁违迟适递逻遗邻释鉴针钟钢钱铁银链销锁错键镜闪闭闲闻阅阔队阳阴阵阶际陆陈险随隐难静顶项顺须顾顿预领频题颜额风飘飞饭饮馆驱驾验骑鱼鲁鲜鸟鸡鸣龙龟" +
    "贾钗凤颦潇纨鸳鸯鹃钏琏赵莲荣儿绛诔谜绣兰亲槛轩钓凯缎绸缠锦鬓钿妆娇袅纤")
    .split(""),
);
export const simplifiedIn = (s) => [...new Set([...String(s || "")].filter((c) => SIMPLIFIED.has(c)))];
