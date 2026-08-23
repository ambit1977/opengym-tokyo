#!/usr/bin/env python3
"""住所から緯度経度を補完する（国土地理院 地名検索API）。
「住所さえあれば緯度は導ける」ことを実証するための処理。
出典: 国土地理院 https://msearch.gsi.go.jp/"""
import json, time, urllib.parse, urllib.request, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
API = "https://msearch.gsi.go.jp/address-search/AddressSearch?q="
UA = {"User-Agent": "opengym-tokyo/1.0 (hackathon)"}

fac = json.load(open(ROOT/"data/facilities.json"))
had = sum(1 for f in fac if f.get("緯度"))
ok = miss = 0
for f in fac:
    if f.get("緯度") and f.get("経度"):
        f["_geo"] = "opendata"; continue
    addr = (f.get("所在地_連結表記") or "").strip()
    if not addr: f["_geo"]="none"; miss+=1; continue
    try:
        r = urllib.request.urlopen(
            urllib.request.Request(API+urllib.parse.quote(addr), headers=UA), timeout=20)
        j = json.loads(r.read())
        if j:
            lon, lat = j[0]["geometry"]["coordinates"]
            f["緯度"], f["経度"] = f"{lat:.6f}", f"{lon:.6f}"
            f["_geo"] = "geocoded"; ok += 1
        else:
            f["_geo"]="none"; miss+=1
    except Exception:
        f["_geo"]="none"; miss+=1
    time.sleep(0.25)

json.dump(fac, open(ROOT/"data/facilities.json","w"), ensure_ascii=False, indent=1)
tot=len(fac); now=sum(1 for f in fac if f.get("緯度"))
print(f"トレーニング室のある施設: {tot}")
print(f"  オープンデータに緯度あり : {had}  ({had/tot*100:.1f}%)")
print(f"  住所から補完できた       : {ok}")
print(f"  補完できず               : {miss}")
print(f"  → 地図に置ける施設       : {now}  ({now/tot*100:.1f}%)")
