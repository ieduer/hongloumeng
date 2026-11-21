#!/usr/bin/env python3
"""Build data/study/atlas.json (derived) for the 圖譜 views.

Inputs (read-only):
  data/hongloumeng.json            source text, 120 chapters
  data/study/people.json           derived by build_study.py (run that first)
  data/study/chapters.json         derived by build_study.py (parts)
  data/authored/atlas/*.json       hand-authored plot, fates, places, relations, chrono, frontier

Every authored event carries `ev`, a verbatim string from the source text; the build
fails unless that string occurs in the stated chapter (or chapter range). Co-occurrence
counts and the network layout are computed here and are fully deterministic.
"""
import hashlib
import json
import math
import random
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUTH = ROOT / "data" / "authored" / "atlas"
OUT = ROOT / "data" / "study" / "atlas.json"
FILES = ["plot", "fates", "places", "relations", "chrono", "frontier"]


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


chapters = [c["content"] for c in load(ROOT / "data" / "hongloumeng.json")["chapters"]]
assert len(chapters) == 120
people = load(ROOT / "data" / "study" / "people.json")["items"]
parts = load(ROOT / "data" / "study" / "chapters.json")["parts"]
A = {name: load(AUTH / f"{name}.json") for name in FILES}
person_names = {p["name"] for p in people}
extra = A["relations"]["extraPeople"]
known = person_names | {p["name"] for p in extra}

problems = []


def check(ch, ev, where, to=None):
    if not ev:
        problems.append(f"{where}: missing evidence")
        return
    lo, hi = int(ch), int(to or ch)
    if not (1 <= lo <= hi <= 120):
        problems.append(f"{where}: bad chapter {lo}-{hi}")
        return
    if not any(ev in chapters[n - 1] for n in range(lo, hi + 1)):
        problems.append(f"{where}: 「{ev}」 not in chapter {lo}" + (f"-{hi}" if hi != lo else ""))


def person(name, where):
    if name not in known:
        problems.append(f"{where}: unknown person {name}")


# ---------- plot ----------
for i, n in enumerate(A["plot"]["nodes"]):
    check(n["ch"], n["ev"], f"plot.nodes[{i}] {n['t']}", n.get("to"))
    assert 0 <= n["lv"] <= 100 and n["w"] in (1, 2, 3), n
for i, f in enumerate(A["plot"]["festivals"]):
    check(f["ch"], f["ev"], f"plot.festivals[{i}]")
chs = [n["ch"] for n in A["plot"]["nodes"]]
assert chs == sorted(chs), "plot nodes must be in chapter order"

# ---------- fates ----------
by_name = {p["name"]: p for p in people}
fates = []
for p in A["fates"]["people"]:
    person(p["id"], f"fates {p['id']}")
    last = 0
    for e in p["events"]:
        check(e["ch"], e["ev"], f"fates {p['id']} ch{e['ch']}")
        assert e["k"] in A["fates"]["meta"]["kinds"], e
        assert e["ch"] >= last, f"fates {p['id']} events out of order"
        last = e["ch"]
    ends = [e for e in p["events"] if e["k"] == "end"]
    assert len(ends) == 1, f"fates {p['id']} needs exactly one end"
    src = by_name.get(p["id"])
    row = dict(p)
    row["end"] = ends[0]["ch"]
    if src:
        row["group"] = src["group"]
        row["dist"] = src["dist"]
        row["first"] = src["firstChapter"]
        row["scenes"] = src["keyScenes"]
        row["poems"] = src.get("poems", [])
    fates.append(row)

# ---------- places ----------
places = A["places"]
for pl in places["garden"]["places"]:
    for e in pl.get("events", []):
        check(e["ch"], e["ev"], f"garden {pl['id']}")
    for r in pl.get("residents", []):
        person(r, f"garden {pl['id']}")
ids = {pl["id"] for pl in places["garden"]["places"]}
assert set(places["garden"]["route"]) <= ids
for b in places["mansion"]["blocks"]:
    check(b["ch"], b["ev"], f"mansion {b['id']}")
wids = {pl["id"] for pl in places["world"]["places"]}
for pl in places["world"]["places"]:
    for e in pl.get("events", []):
        check(e["ch"], e["ev"], f"world {pl['id']}")
for f in places["world"]["fictional"]:
    check(f["ch"], f["ev"], f"world fictional {f['label']}")
for j in places["world"]["journeys"]:
    check(j["ch"], j["ev"], f"journey {j['id']}", j.get("to"))
    person(j["who"], f"journey {j['id']}")
    assert set(j["path"]) <= wids, j["id"]

# ---------- relations ----------
rel = A["relations"]
fam_ids = {n["id"] for n in rel["family"]["nodes"]}
for n in rel["family"]["nodes"]:
    if n.get("ev"):
        check(n["ev"]["ch"], n["ev"]["text"], f"family {n['id']}")
    if n.get("person"):
        person(n["person"], f"family {n['id']}")
    for k in ("spouseOf", "parent"):
        if n.get(k):
            assert n[k] in fam_ids, (n["id"], k)
for a, b in rel["family"]["parents"]:
    assert a in fam_ids and b in fam_ids, (a, b)
for al in rel["family"]["allies"]:
    check(al["ch"], al["ev"], "allies")
    for h in al["houses"]:
        check(al["ch"], h.get("ev"), f"allies house {h['id']}")
        for m in h.get("members", []):
            person(m, f"allies {h['id']}")
    for l in al["links"]:
        person(l["a"], "allies link")
        person(l["b"], "allies link")
        if l.get("ev"):
            check(l["ch"], l["ev"], f"allies link {l['a']}-{l['b']}")
for i, e in enumerate(rel["edges"]):
    person(e["a"], f"edge {i}")
    person(e["b"], f"edge {i}")
    assert e["type"] in rel["meta"]["types"], e
    if e.get("ev"):
        check(e["ch"], e["ev"], f"edge {e['a']}-{e['b']}")

# ---------- chrono ----------
ch = A["chrono"]
prev = 0
for y in ch["years"]:
    assert y["y"] == prev + 1 and 1 <= y["from"] <= y["to"] <= 120, y
    prev = y["y"]
years = {y["y"]: y for y in ch["years"]}
for i, a in enumerate(ch["anchors"]):
    check(a["ch"], a["ev"], f"anchor {a['when']}")
    y = years.get(a.get("y"))
    assert y and y["from"] <= a["ch"] <= y["to"], f"anchor {a['when']} outside its story year"
for i, a in enumerate(ch["ages"]):
    person(a["who"], f"age {i}")
    check(a["ch"], a["ev"], f"age {a['label']} ch{a['ch']}")

# ---------- frontier ----------
for it in A["frontier"]["items"]:
    assert it["url"].startswith("https://"), it["id"]
    assert it["summary"] and it["title"], it["id"]

if problems:
    raise SystemExit("atlas evidence check failed:\n  " + "\n  ".join(problems))

# ---------- co-occurrence (same paragraph) ----------
net_people = [{"name": p["name"], "label": None, "aliases": p.get("aliases", []), "group": p["group"]} for p in people]
net_people += [{"name": p["name"], "label": p["label"], "aliases": p["aliases"], "group": "其他"} for p in extra]
patterns = []
for p in net_people:
    names = sorted(set([p["name"]] + p["aliases"]), key=len, reverse=True)
    patterns.append((p["name"], names))
all_names = sorted({nm: who for who, names in patterns for nm in names}.items(), key=lambda x: -len(x[0]))
alias_re = re.compile("|".join(re.escape(nm) for nm, _ in all_names))
alias_owner = dict(all_names)

pair = {}
mentions = {p["name"]: 0 for p in net_people}
paragraphs = 0
for text in chapters:
    for para in re.split(r"\n+", text):
        found = {alias_owner[m.group(0)] for m in alias_re.finditer(para)}
        if not found:
            continue
        paragraphs += 1
        for who in found:
            mentions[who] += 1
        found = sorted(found)
        for i in range(len(found)):
            for j in range(i + 1, len(found)):
                k = (found[i], found[j])
                pair[k] = pair.get(k, 0) + 1

typed = {tuple(sorted((e["a"], e["b"]))) for e in rel["edges"]}
cooc = sorted(([a, b, n] for (a, b), n in pair.items() if n >= 6), key=lambda x: (-x[2], x[0], x[1]))
cooc = cooc[:260]
nodes_in = {p["name"] for p in people} | {x for e in rel["edges"] for x in (e["a"], e["b"])}

# ---------- deterministic force layout ----------
W, H = 1000, 760
rng = random.Random(20261120)
order = sorted(nodes_in)
groups = sorted({next((p["group"] for p in net_people if p["name"] == n), "其他") for n in order})
pos = {}
for i, n in enumerate(order):
    g = next((p["group"] for p in net_people if p["name"] == n), "其他")
    ang = 2 * math.pi * (groups.index(g) + rng.random() * 0.8) / len(groups)
    r = 200 + rng.random() * 120
    pos[n] = [W / 2 + r * math.cos(ang), H / 2 + r * math.sin(ang)]
links = {}
# Springs: each person's four strongest co-occurrence partners (so the hubs do not swallow everyone) plus every typed edge.
top_partners = {}
for a, b, n in cooc:
    for x, y in ((a, b), (b, a)):
        top_partners.setdefault(x, []).append((n, y))
for x, lst in top_partners.items():
    for n, y in sorted(lst, reverse=True)[:4]:
        k = tuple(sorted((x, y)))
        if k[0] in pos and k[1] in pos:
            links[k] = max(links.get(k, 0), min(1.0, math.log1p(n) / 6) * 0.6)
for e in rel["edges"]:
    k = tuple(sorted((e["a"], e["b"])))
    links[k] = links.get(k, 0) + 1.0
k_rep = 120.0
temp = 60.0
for it in range(700):
    disp = {n: [0.0, 0.0] for n in order}
    for i, a in enumerate(order):
        ax, ay = pos[a]
        for b in order[i + 1:]:
            dx, dy = ax - pos[b][0], ay - pos[b][1]
            d2 = dx * dx + dy * dy + 0.01
            d = math.sqrt(d2)
            f = k_rep * k_rep / d
            disp[a][0] += dx / d * f
            disp[a][1] += dy / d * f
            disp[b][0] -= dx / d * f
            disp[b][1] -= dy / d * f
    for (a, b), w in links.items():
        dx, dy = pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]
        d = math.sqrt(dx * dx + dy * dy) + 0.01
        f = d * d / k_rep * w * 0.35
        disp[a][0] -= dx / d * f
        disp[a][1] -= dy / d * f
        disp[b][0] += dx / d * f
        disp[b][1] += dy / d * f
    for n in order:
        dx, dy = disp[n]
        d = math.sqrt(dx * dx + dy * dy) + 0.01
        step = min(d, temp)
        pos[n][0] += dx / d * step + (W / 2 - pos[n][0]) * 0.004
        pos[n][1] += dy / d * step + (H / 2 - pos[n][1]) * 0.004
    temp = max(1.5, temp * 0.993)
# Collision pass: keep node centres at least 64 units apart so labels stay readable.
for _ in range(400):
    moved = False
    for i, a in enumerate(order):
        for b in order[i + 1:]:
            dx, dy = pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]
            d = math.sqrt(dx * dx + dy * dy) + 1e-6
            if d < 64:
                push = (64 - d) / 2
                pos[a][0] += dx / d * push; pos[a][1] += dy / d * push
                pos[b][0] -= dx / d * push; pos[b][1] -= dy / d * push
                moved = True
    if not moved:
        break
xs = [p[0] for p in pos.values()]
ys = [p[1] for p in pos.values()]
pad = 60
sx = (W - 2 * pad) / (max(xs) - min(xs) or 1)
sy = (H - 2 * pad) / (max(ys) - min(ys) or 1)
layout = {n: [round(pad + (x - min(xs)) * sx, 1), round(pad + (y - min(ys)) * sy, 1)] for n, (x, y) in pos.items()}

label_of = {p["name"]: p["label"] for p in extra}
net_nodes = []
for n in order:
    src = next(p for p in net_people if p["name"] == n)
    net_nodes.append({"id": n, "label": label_of.get(n), "group": src["group"], "x": layout[n][0], "y": layout[n][1],
                      "mentions": mentions.get(n, 0), "typed": sum(1 for e in rel["edges"] if n in (e["a"], e["b"]))})

out = {
    "meta": {
        "built": "scripts/build_atlas.py",
        "sources": {name: sha(AUTH / f"{name}.json")[:16] for name in FILES} | {"text": sha(ROOT / "data" / "hongloumeng.json")[:16]},
        "checked": sum(1 for _ in re.finditer(r'"ev"', json.dumps(A, ensure_ascii=False))),
        "paragraphs": paragraphs,
    },
    "parts": parts,
    "plot": A["plot"],
    "fates": {"meta": A["fates"]["meta"], "people": fates},
    "places": places,
    "relations": {
        "meta": rel["meta"], "family": rel["family"], "edges": rel["edges"],
        "network": {"w": W, "h": H, "nodes": net_nodes, "cooc": cooc},
    },
    "chrono": ch,
    "frontier": A["frontier"],
}
OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"atlas: {len(A['plot']['nodes'])} plot nodes, {len(fates)} fates, "
      f"{sum(len(p['events']) for p in fates)} fate events, {len(places['garden']['places'])} garden places, "
      f"{len(places['world']['places'])} world places, {len(rel['edges'])} typed edges, {len(cooc)} co-occurrence pairs, "
      f"{len(ch['anchors'])} anchors, {len(ch['ages'])} ages, {len(A['frontier']['items'])} research notes; "
      f"{out['meta']['checked']} evidence strings verified")
