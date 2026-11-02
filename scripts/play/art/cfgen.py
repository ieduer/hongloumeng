#!/usr/bin/env python3
"""Workers AI (Leonardo Lucid Origin) batch generator. jobs.json: [{name,prompt,w,h,seed,steps?}] -> raw/<name>.jpg"""
import json, sys, os, time, base64, urllib.request, re
ACC = "da810f08b63347a01d3db7fd42619972"
tok = ""
for line in open(os.path.expanduser("~/.secrets.env")):
    m = re.match(r"^(?:export )?CLOUDFLARE_API_TOKEN=['\"]?([^'\"\n]+)", line)
    if m: tok = m.group(1)
jobs = json.load(open(sys.argv[1]))
only = set(sys.argv[2].split(",")) if len(sys.argv) > 2 and sys.argv[2] else None
os.makedirs("raw", exist_ok=True)
log = open("cfgen.log", "a")
n_ok = 0
for j in jobs:
    if only and j["name"] not in only: continue
    out = f"raw/{j['name']}.jpg"
    if os.path.exists(out): continue
    model = j.get("model", "@cf/leonardo/lucid-origin")
    body = {"prompt": j["prompt"], "width": j.get("w", 1024), "height": j.get("h", 1024), "steps": j.get("steps", 25), "guidance": j.get("guidance", 4.5), "seed": j.get("seed", 7)}
    t0 = time.time(); msg = ""
    for attempt in range(3):
        try:
            req = urllib.request.Request(f"https://api.cloudflare.com/client/v4/accounts/{ACC}/ai/run/{model}", data=json.dumps(body).encode(), headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=240) as r:
                d = json.loads(r.read())
            if d.get("success") and d.get("result", {}).get("image"):
                open(out, "wb").write(base64.b64decode(d["result"]["image"])); n_ok += 1; msg = f"ok {os.path.getsize(out)}B"; break
            msg = "resp " + json.dumps(d)[:200]
        except Exception as e:
            msg = f"err {e}"; time.sleep(4)
    line = f"{time.strftime('%H:%M:%S')} {j['name']} {msg} {time.time()-t0:.1f}s"
    print(line); log.write(line + "\n"); log.flush()
    time.sleep(0.8)
print("done ok", n_ok)
