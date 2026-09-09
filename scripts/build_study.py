# -*- coding: utf-8 -*-
"""建立 hlm 學習站派生索引：回目正文分片、人物出場分布、詩詞索引、回目索引。

來源資料（data/hongloumeng.json、data/shici.json）只讀不改；
本腳本只產出 data/text/ 與 data/study/ 下的派生檔案。
"""
import json
import os
import re
import collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUTHORED = os.path.join(ROOT, "data", "authored")


def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def dump(p, obj):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(p)


# ---------- 中文數字 ----------
DIG = {"零": 0, "一": 1, "二": 2, "三": 3, "四": 4,
       "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}


def cn2num(s):
    s = (s or "").strip()
    if not s:
        return None
    if s.isdigit():
        return int(s)
    section, num = 0, 0
    for ch in s:
        if ch in DIG:
            num = DIG[ch]
        elif ch == "十":
            section += (num or 1) * 10
            num = 0
        elif ch == "百":
            section += (num or 1) * 100
            num = 0
        else:
            return None
    return (section + num) or None


def parse_chapters(v):
    """'十七、十八' -> [17, 18]；'一百二十' -> [120]"""
    if v is None:
        return []
    out = []
    for part in re.split(r"[、,，/]", str(v)):
        n = cn2num(part)
        if n:
            out.append(n)
    return out


# ---------- 讀取來源 ----------
chapters = load(os.path.join(ROOT, "data/hongloumeng.json"))["chapters"]
shici = load(os.path.join(ROOT, "data/shici.json"))
exams = load(os.path.join(ROOT, "data/study/exams.json"))
people = load(os.path.join(AUTHORED, "people.json"))

assert len(chapters) == 120, len(chapters)

# ---------- 分卷（依情節階段，供目錄分組） ----------
PARTS = [
    (1, 5, "楔子·緣起", "石頭下凡、真假甄賈、太虛幻境，全書總綱在此"),
    (6, 18, "起勢·入府", "劉姥姥一進、可卿之死、元妃省親，賈府盛極"),
    (19, 40, "大觀園·春", "共讀西廂、黛玉葬花、結社題詩，園中最好的日子"),
    (41, 63, "盛中之隙", "櫳翠品茶、香菱學詩、探春理家、群芳夜宴"),
    (64, 80, "轉折·離散", "尤氏姊妹、抄檢大觀園、晴雯之死、迎春誤嫁"),
    (81, 98, "續書·崩塌", "宮闈驟變、掉包計、黛玉焚稿，木石成空"),
    (99, 120, "收束·歸結", "抄家、出走、歸結紅樓夢，白茫茫大地真乾淨"),
]


def part_of(n):
    for a, b, name, _desc in PARTS:
        if a <= n <= b:
            return name
    return ""


# ---------- 詩詞索引 ----------
def norm_lines(v):
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    if isinstance(v, str):
        return [x.strip() for x in re.split(r"[\r\n]+", v) if x.strip()]
    return []


VERDICT_OWNER = {
    "又副册判词之一": ["晴雯"],
    "又副册判词之二": ["袭人"],
    "副册判词一首": ["香菱"],
    "正册判词之一": ["林黛玉", "薛宝钗"],
    "正册判词之二": ["贾元春"],
    "正册判词之三": ["贾探春"],
    "正册判词之四": ["史湘云"],
    "正册判词之五": ["贾迎春"],
    "正册判词之六": ["妙玉"],
    "正册判词之七": ["贾惜春"],
    "正册判词之八": ["王熙凤"],
    "正册判词之九": ["王熙凤"],
    "正册判词之十": ["巧姐"],
    "正册判词之十一": ["李纨"],
    "正册判词之十二": ["秦可卿"],
    "终身误": ["贾宝玉", "薛宝钗", "林黛玉"],
    "枉凝眉": ["贾宝玉", "林黛玉"],
    "恨无常": ["贾元春"],
    "分骨肉": ["贾探春"],
    "乐中悲": ["史湘云"],
    "世难容": ["妙玉"],
    "喜冤家": ["贾迎春"],
    "虚花悟": ["贾惜春"],
    "聪明累": ["王熙凤"],
    "留余庆": ["巧姐"],
    "晚韶华": ["李纨"],
    "好事终": ["秦可卿"],
    "好了歌": ["甄士隐"],
    "好了歌注": ["甄士隐"],
    "西江月・嘲贾宝玉二首": ["贾宝玉"],
    "赞林黛玉": ["林黛玉"],
    "护官符": ["薛蟠", "贾雨村"],
}

SONG_TITLES = {"引子", "终身误", "枉凝眉", "恨无常", "分骨肉", "乐中悲", "世难容",
               "喜冤家", "虚花悟", "聪明累", "留余庆", "晚韶华", "好事终",
               "收尾・飞鸟各投林"}


def poem_kind(entry, title):
    t = title or ""
    if "判词" in t:
        return "判词"
    coll = (entry.get("details") or {}).get("collection_title") or ""
    if "十二支曲" in coll or t in SONG_TITLES:
        return "红楼梦十二支曲"
    if "对联" in t or t.endswith("联"):
        return "对联匾额"
    if "谜" in t:
        return "灯谜谶语"
    if "诔" in t or "赋" in t:
        return "诔赋"
    if "歌" in t:
        return "歌谣曲词"
    return "诗词"


poems, seen = [], collections.Counter()
for e in shici:
    d = e.get("details") or {}
    title = (d.get("title") or "").strip()
    if not title:
        continue
    lines = norm_lines(d.get("poem_text"))
    body = (d.get("text") or "").strip()
    if not lines and not body:
        continue
    chs = parse_chapters(d.get("chapter"))
    kind = poem_kind(e, title)
    if not chs and (kind in ("判词", "红楼梦十二支曲") or title in SONG_TITLES):
        chs = [5]
    seen[title] += 1
    pid = title if seen[title] == 1 else "%s-%d" % (title, seen[title])
    poems.append({
        "id": pid,
        "title": title,
        "kind": kind,
        "chapters": chs,
        "collection": d.get("collection_title") or None,
        "lines": lines,
        "text": body or None,
        "explanation": (d.get("explanation") or "").strip() or None,
        "annotations": (d.get("annotations") or "").strip() or None,
        "people": VERDICT_OWNER.get(title, []),
        "source": e.get("url") or None,
    })

# ---------- 人物出場分布（別名在正文出現次數） ----------
GROUP_ORDER = ["金陵十二钗正册", "金陵十二钗副册", "金陵十二钗又副册",
               "贾府主子", "仆婢", "外围人物"]
full_texts = [c["content"] for c in chapters]
for p in people:
    names = list(dict.fromkeys([p["name"]] + p.get("aliases", [])))
    # 長別名優先，避免「宝玉」把「贾宝玉」重複計入
    names.sort(key=len, reverse=True)
    dist, total = [], 0
    for txt in full_texts:
        t, c = txt, 0
        for nm in names:
            if not nm:
                continue
            k = t.count(nm)
            if k:
                c += k
                t = t.replace(nm, " " * len(nm))
        dist.append(c)
        total += c
    p["dist"] = dist
    p["mentions"] = total
    ranked = sorted(range(120), key=lambda i: -dist[i])
    p["peakChapters"] = [i + 1 for i in ranked[:6] if dist[i] > 0]
    pid_set = ({q["id"] for q in poems if p["name"] in q["people"]}
               | set(p.get("verdict", [])) | set(p.get("songs", [])))
    kind_rank = {"判词": 0, "红楼梦十二支曲": 1}
    kind_of = {q["id"]: q["kind"] for q in poems}
    p["poems"] = sorted(pid_set, key=lambda i: (kind_rank.get(kind_of.get(i), 2), i))
    p["_order"] = GROUP_ORDER.index(p["group"]) if p["group"] in GROUP_ORDER else 99
people.sort(key=lambda p: (p["_order"], -p["mentions"]))
for p in people:
    p.pop("_order", None)

# ---------- 回目索引 ----------
poem_by_ch = collections.defaultdict(list)
for q in poems:
    for c in q["chapters"]:
        poem_by_ch[c].append(q["id"])
exam_by_ch = collections.defaultdict(list)
for it in exams["items"]:
    for c in it.get("chapters", []):
        exam_by_ch[c].append(it["id"])

FOCUS = {
    1: "全書總綱：石頭緣起、甄士隱家破、《好了歌》",
    2: "冷子興演說榮國府；賈雨村「正邪兩賦」之論",
    3: "黛玉進府，寶黛初會，《西江月》二詞定寶玉",
    4: "護官符與葫蘆案，四大家族的社會結構",
    5: "太虛幻境：判詞與十二支曲，全書結局預敘",
    6: "劉姥姥一進榮國府",
    7: "送宮花；焦大醉罵，寧府之污",
    9: "戀風流情友入家塾，頑童鬧學堂",
    12: "毒設相思局，賈天祥正照風月鑑（書名出處）",
    13: "秦可卿托夢；王熙鳳協理寧國府",
    15: "王鳳姐弄權鐵檻寺",
    16: "元春才選鳳藻宮——即「非常喜事」",
    17: "大觀園試才題對額",
    18: "元妃省親，賈府之盛的頂點",
    19: "情切切良宵花解語，意綿綿靜日玉生香",
    22: "製燈謎賈政悲讖語",
    23: "西廂記妙詞通戲語，牡丹亭艷曲警芳心",
    25: "魘魔法叔嫂逢五鬼",
    27: "寶釵撲蝶；黛玉葬花，《葬花吟》",
    28: "蔣玉菡情贈茜香羅；薛蟠酒令",
    29: "清虛觀打醮，「不是冤家不聚頭」",
    30: "寶玉調笑金釧，王夫人翻臉",
    31: "撕扇子作千金一笑；因麒麟伏白首雙星",
    32: "訴肺腑心迷活寶玉；金釧投井",
    33: "不肖種種大承笞撻——寶玉挨打",
    34: "情中情因情感妹妹：題帕三絕；襲人進言",
    35: "賈母、寶釵評鳳姐「乖」「巧」（2024 北京卷）",
    36: "夢中喊罵「我偏說是木石姻緣」",
    37: "秋爽齋偶結海棠社",
    38: "林瀟湘魁奪菊花詩，薛蘅蕪諷和螃蟹詠",
    39: "劉姥姥二進榮國府",
    40: "史太君兩宴大觀園，金鴛鴦三宣牙牌令",
    41: "櫳翠庵茶品梅花雪",
    42: "蘅蕪君蘭言解疑癖——釵黛和解",
    43: "寶玉私祭金釧",
    44: "變生不測鳳姐潑醋",
    45: "金蘭契互剖金蘭語，《秋窗風雨夕》",
    46: "鴛鴦女誓絕鴛鴦偶",
    47: "呆霸王調情遭苦打",
    48: "慕雅女雅集苦吟詩——香菱學詩",
    49: "琉璃世界白雪紅梅，寶琴入園",
    50: "蘆雪廣爭聯即景詩",
    51: "薛小妹新編懷古詩（2026 北京卷）",
    52: "勇晴雯病補雀金裘",
    54: "史太君破陳腐舊套——掰謊記",
    55: "敏探春興利除宿弊",
    56: "時寶釵小惠全大體",
    57: "慧紫鵑情辭試忙玉",
    61: "判冤決獄平兒行權",
    62: "憨湘雲醉眠芍藥裀",
    63: "壽怡紅群芳開夜宴——花簽表（2017 北京卷依據）",
    65: "賈璉偷娶尤二姐",
    66: "情小妹恥情歸地府，冷二郎一冷入空門",
    68: "苦尤娘賺入大觀園，酸鳳姐大鬧寧國府",
    69: "覺大限吞生金自逝",
    70: "林黛玉重建桃花社，《桃花行》（2025 北京卷）",
    73: "賈母處置聚賭；累金鳳事件",
    74: "惑奸讒抄檢大觀園",
    76: "凹晶館聯詩「冷月葬花魂」（2014 北京卷）",
    77: "俏丫鬟抱屈夭風流——晴雯之死",
    78: "痴公子杜撰芙蓉誄",
    79: "薛文龍悔娶河東獅，賈迎春誤嫁中山狼",
    95: "元妃薨逝",
    97: "林黛玉焚稿斷痴情，薛寶釵出閨成大禮",
    98: "苦絳珠魂歸離恨天",
    105: "錦衣軍查抄寧國府",
    119: "寶玉中舉出走；巧姐得救",
    120: "甄士隱詳說太虛情，賈雨村歸結紅樓夢",
}

index = []
for i, c in enumerate(chapters, 1):
    txt = c["content"]
    ppl = sorted(
        [{"name": p["name"], "n": p["dist"][i - 1]}
         for p in people if p["dist"][i - 1] >= 3],
        key=lambda x: -x["n"])[:8]
    index.append({
        "n": i,
        "title": c["title"],
        "words": len(txt),
        "part": part_of(i),
        "focus": FOCUS.get(i),
        "people": ppl,
        "poems": poem_by_ch.get(i, []),
        "exams": exam_by_ch.get(i, []),
        "excerpt": re.sub(r"\s+", "", txt)[:56],
    })

# ---------- 輸出 ----------
sizes = {}
for i, c in enumerate(chapters, 1):
    sizes[i] = dump(os.path.join(ROOT, "data/text/ch%03d.json" % i),
                    {"n": i, "title": c["title"], "content": c["content"]})
dump(os.path.join(ROOT, "data/study/chapters.json"),
     {"parts": [{"from": a, "to": b, "name": n, "desc": d} for a, b, n, d in PARTS],
      "items": index})
dump(os.path.join(ROOT, "data/study/poems.json"),
     {"meta": {"count": len(poems)}, "items": poems})
dump(os.path.join(ROOT, "data/study/people.json"),
     {"groups": GROUP_ORDER, "items": people})

print("chapters split:", len(sizes), "avg bytes", sum(sizes.values()) // len(sizes))
print("poems:", len(poems), dict(collections.Counter(q["kind"] for q in poems)))
print("people:", len(people))
print("top mentions:", [(p["name"], p["mentions"]) for p in people[:6]])
print("chapters w/ poems:", sum(1 for x in index if x["poems"]),
      "w/ exams:", sum(1 for x in index if x["exams"]))


# ---------- 每日進度計畫 ----------
WEEKLY = [
    "把本週七天的「三行筆記」連起來讀一遍，補一句：這一週的賈府，比上一週更好還是更壞？",
    "默寫第五回判詞任意三首，並各配一個後文情節。",
    "畫一張本週出場人物的關係草圖，只畫你確實記得的線。",
    "挑本週最觸動你的一句人物原話抄下來，寫兩句它為什麼像真話。",
    "翻回第五回，看看本週讀到的情節印證了哪一句判詞或曲子。",
    "用 150 字寫一段本週某個人物的「可悲又可嘆」，當作微寫作練筆。",
    "把本週遇到的詩詞讀出聲一遍，選一首背下前四句。",
]

MILESTONES = {
    5: "讀完全書總綱。建議停一天，把判詞與十二支曲抄一遍——這是全書的目錄。",
    18: "賈府之盛到達頂點。回頭看第十三回可卿說的「盛筵必散」，此刻應當有感覺了。",
    23: "眾人搬進大觀園。從這裡開始是全書最好的一段日子，也是最值得慢讀的一段。",
    40: "劉姥姥二進。借外人的眼睛再看一次賈府，記下你注意到的三處奢侈。",
    63: "群芳夜宴。把花簽表整理出來——這一頁的複習性價比最高。",
    74: "抄檢大觀園。園子破了。回看探春那句「必須先從家裡自殺自滅起來」。",
    80: "曹雪芹的筆到此為止。往下換了人寫，讀法也要跟著換：重情節，輕細節。",
    98: "黛玉之死。與第三回初會、第二十三回共讀西廂並讀，木石一線至此收束。",
    120: "讀完了。回到第一回那句「滿紙荒唐言，一把辛酸淚」，現在你知道它說的是什麼了。",
}

PACES = [
    {"id": "deep100", "name": "精讀 · 100 天",
     "desc": "前八十回每天一回，後四十回每天兩回。適合高一高二打底，或想真正讀懂的人。",
     "days": [[i] for i in range(1, 81)] + [[i, i + 1] for i in range(81, 121, 2)]},
    {"id": "steady60", "name": "常規 · 60 天",
     "desc": "每天兩回，兩個月讀完。適合高三上學期與寒暑假。",
     "days": [[i, i + 1] for i in range(1, 121, 2)]},
    {"id": "sprint30", "name": "衝刺 · 30 天",
     "desc": "每天四回，只精讀標星回目，其餘快讀抓情節。適合考前重溫。",
     "days": [[i, i + 1, i + 2, i + 3] for i in range(1, 121, 4)]},
]

chapter_by_n = {x["n"]: x for x in index}
poem_title = {q["id"]: q["title"] for q in poems}
exam_title = {it["id"]: "%d年·%s" % (it["year"], it["topic"]) for it in exams["items"]}

plans = []
for pace in PACES:
    days = []
    for di, chs in enumerate(pace["days"], 1):
        metas = [chapter_by_n[c] for c in chs if c in chapter_by_n]
        focus = [m["focus"] for m in metas if m.get("focus")]
        ps, es = [], []
        for m in metas:
            ps += m["poems"]
            es += m["exams"]
        ps = list(dict.fromkeys(ps))
        es = list(dict.fromkeys(es))
        tasks = ["讀：第 %s 回%s" % (
            "–".join(str(c) for c in (chs[:1] + chs[-1:])) if len(chs) > 1 else str(chs[0]),
            "（%s）" % metas[0]["title"] if len(metas) == 1 else "")]
        if focus:
            tasks.append("想：" + "；".join(focus))
        if ps:
            tasks.append("誦：" + "、".join(poem_title.get(i, i) for i in ps[:4])
                         + ("等 %d 首" % len(ps) if len(ps) > 4 else ""))
        if es:
            tasks.append("練：" + "、".join(exam_title.get(i, i) for i in es))
        tasks.append("記：寫三行——本回發生了什麼／誰變了／埋了什麼")
        note = None
        for c in chs:
            if c in MILESTONES:
                note = MILESTONES[c]
        days.append({
            "d": di,
            "chapters": chs,
            "titles": [m["title"] for m in metas],
            "focus": focus,
            "poems": ps,
            "exams": es,
            "tasks": tasks,
            "weekly": WEEKLY[(di // 7 - 1) % len(WEEKLY)] if di % 7 == 0 else None,
            "note": note,
        })
    plans.append({"id": pace["id"], "name": pace["name"], "desc": pace["desc"],
                  "total": len(days), "days": days})

dump(os.path.join(ROOT, "data/study/plans.json"), {"plans": plans})
print("plans:", [(p["id"], p["total"]) for p in plans])
