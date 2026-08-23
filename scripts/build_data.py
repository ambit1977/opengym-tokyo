#!/usr/bin/env python3
"""東京都オープンデータカタログから自治体標準オープンデータセット
「スポーツ施設一覧」(d3100000004) を全自治体分取得し、
 - data/facilities.json  トレーニング室のある施設
 - data/coverage.json    カラム充足率の実測
を生成する。出典: 各区市町村 / CC BY 4.0"""
import csv, io, json, re, urllib.request, concurrent.futures as cf
from pathlib import Path

CAT = "https://catalog.data.metro.tokyo.lg.jp/api/3/action/package_search?q=name:*d3100000004&rows=100"
UA  = {"User-Agent": "Mozilla/5.0 (opengym-tokyo data builder)"}
ROOT = Path(__file__).resolve().parent.parent

def get(url, t=40):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=t).read()

def decode(raw):
    for enc in ("utf-8-sig", "cp932", "utf-8"):
        try: return raw.decode(enc)
        except UnicodeDecodeError: continue
    return raw.decode("utf-8", "ignore")

# 充足率を見るカラム（利用者が「探す」ために要るもの）
WATCH = ["緯度","経度","利用可能曜日","開始時間","終了時間","更衣室","シャワー室",
         "フリーWi-Fi","車椅子可","URL","電話番号","所在地_連結表記"]
KEEP  = ["名称","所在地_連結表記","電話番号","緯度","経度","利用可能曜日",
         "開始時間","終了時間","更衣室","シャワー室","フリーWi-Fi","車椅子可","URL"]

def fetch(rec):
    org = rec.get("organization", {}).get("title", "?")
    res = [r for r in rec.get("resources", []) if (r.get("format") or "").upper() == "CSV"]
    if not res: return None
    try:
        rows = list(csv.reader(io.StringIO(decode(get(res[0]["url"])))))
    except Exception as e:
        return {"org": org, "error": f"{type(e).__name__}"}
    if len(rows) < 2: return None
    h, data = rows[0], [r for r in rows[1:] if any(c.strip() for c in r)]
    idx = {c: h.index(c) for c in set(WATCH + KEEP) if c in h}
    def val(r, c):
        i = idx.get(c)
        return r[i].strip() if i is not None and len(r) > i else ""
    gyms = []
    if "トレーニング室" in h:
        ti = h.index("トレーニング室")
        for r in data:
            if len(r) > ti and r[ti].strip() == "有":
                gyms.append({"自治体": org, **{c: val(r, c) for c in KEEP}})
    return {"org": org, "columns": len(h), "facilities": len(data), "gyms": gyms,
            "filled": {c: sum(1 for r in data if val(r, c)) for c in WATCH if c in idx},
            "has": {c: (c in idx) for c in WATCH}}

print("カタログ照会…")
recs = json.loads(get(CAT))["result"]["results"]
print(f"  {len(recs)} 自治体")

out = []
with cf.ThreadPoolExecutor(max_workers=12) as ex:
    for r in ex.map(fetch, recs):
        if r: out.append(r)

ok = [r for r in out if "error" not in r]
err = [r for r in out if "error" in r]

tot_f = sum(r["facilities"] for r in ok)
tot_g = sum(len(r["gyms"]) for r in ok)
cov = {}
for c in WATCH:
    tgt = [r for r in ok if r["has"].get(c)]
    denom = sum(r["facilities"] for r in tgt)
    num   = sum(r["filled"].get(c, 0) for r in tgt)
    cov[c] = {"filled": num, "total": denom,
              "pct": round(num / denom * 100, 1) if denom else 0.0}

gyms = sorted([g for r in ok for g in r["gyms"]], key=lambda g: (g["自治体"], g["名称"]))
maxcol = max((r["columns"] for r in ok), default=0)

coverage = {
    "source": "東京都オープンデータカタログサイト／自治体標準オープンデータセット「スポーツ施設一覧」",
    "license": "CC BY 4.0",
    "municipalities": len(ok), "facilities": tot_f, "gyms": tot_g,
    "max_columns": maxcol, "coverage": cov,
    "errors": [e["org"] for e in err],
}
(ROOT / "data").mkdir(exist_ok=True)
json.dump(coverage, open(ROOT/"data/coverage.json","w"), ensure_ascii=False, indent=1)
json.dump(gyms,     open(ROOT/"data/facilities.json","w"), ensure_ascii=False, indent=1)

print(f"\n自治体 {len(ok)} / 施設 {tot_f} / トレーニング室あり {tot_g}")
print(f"最大カラム数 {maxcol}")
print("\n--- 充足率（実測）---")
for c in WATCH:
    v = cov[c]; print(f"  {c:<14} {v['pct']:>5.1f}%  ({v['filled']}/{v['total']})")
if err: print("\n取得失敗:", ", ".join(e["org"] for e in err))
