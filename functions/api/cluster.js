/**
 * 匿名クラスタ
 * 許諾を得た人からのみ、匿名IDと粗い属性（年代10歳刻み・性別・目的）と
 * 種目別ベスト重量だけを集める。日付・施設・氏名は送らない。
 * 近い属性の人の中での自分の位置と、伸びた人の傾向を返す。
 */
const K = m => "cl:" + m;
const BK = m => "cb:" + m;
const CAP = 3000;

const band = a => (a === "" || a == null) ? "" : String(a);

function stats(vals) {
  if (!vals.length) return null;
  const s = [...vals].sort((a, b) => a - b);
  const q = p => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  return { n: s.length, min: s[0], q1: q(0.25), med: q(0.5), q3: q(0.75), max: s[s.length - 1] };
}

export async function onRequestPost({ request, env }) {
  const J = (o, st) => new Response(JSON.stringify(o), { status: st || 200,
    headers: { "content-type": "application/json; charset=utf-8" } });
  try {
    const { consent, anonId, age, sex, area, goal, records, body } = await request.json();
    if (!consent) return J({ error: "共有の同意がありません" }, 400);
    if (!anonId || ((!Array.isArray(records) || !records.length) && !body))
      return J({ error: "匿名IDまたは記録がありません" }, 400);

    const prof = { a: band(age), s: sex || "", ar: band(area), g: goal || "" };
    const touched = [];
    for (const r of (records || []).slice(0, 30)) {
      if (!r || !r.machine || !(Number(r.weight) > 0)) continue;
      const key = K(r.machine);
      const raw = await env.OGT_SHARED.get(key);
      let arr = raw ? JSON.parse(raw) : [];
      arr = arr.filter(x => x.i !== anonId);          // 同一人物は最新のみ
      arr.push({ i: anonId, ...prof, w: Number(r.weight), r: Number(r.reps) || 0 });
      if (arr.length > CAP) arr = arr.slice(-CAP);
      await env.OGT_SHARED.put(key, JSON.stringify(arr));
      touched.push(r.machine);
    }
    const sharedBody = [];
    if (body && typeof body === "object") {
      for (const [metric, rawValue] of Object.entries({ weight: body.weight, fat: body.fat, muscle: body.muscle })) {
        const value = Number(rawValue); if (!(value > 0)) continue;
        const key = BK(metric), raw = await env.OGT_SHARED.get(key); let arr = raw ? JSON.parse(raw) : [];
        arr = arr.filter(x => x.i !== anonId); arr.push({ i: anonId, ...prof, v: value });
        if (arr.length > CAP) arr = arr.slice(-CAP); await env.OGT_SHARED.put(key, JSON.stringify(arr)); sharedBody.push(metric);
      }
    }
    return J({ ok: true, machines: touched, body: sharedBody });
  } catch (e) { return J({ error: String(e && e.message || e) }, 500); }
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const type = u.searchParams.get("type") || "machine";
  const machine = u.searchParams.get("machine");
  const my = Number(u.searchParams.get("weight")) || 0;
  const age = u.searchParams.get("age") || "";
  const sex = u.searchParams.get("sex") || "";
  const area = u.searchParams.get("area") || "";
  const goal = u.searchParams.get("goal") || "";
  const J = o => new Response(JSON.stringify(o),
    { headers: { "content-type": "application/json; charset=utf-8" } });
  if (type === "body") {
    const metrics = {};
    for (const metric of ["weight", "fat", "muscle"]) {
      const mine = Number(u.searchParams.get(metric)) || 0, raw = await env.OGT_SHARED.get(BK(metric));
      const all = raw ? JSON.parse(raw) : [];
      const tries = [
        { f: x => x.a === age && x.s === sex && x.ar === area, label: "同年代・同性別・同じ居住エリア" },
        { f: x => x.a === age && x.s === sex, label: "同年代・同性別" },
        { f: x => x.a === age, label: "同年代" },
        { f: () => true, label: "全体" },
      ];
      let use = tries[tries.length - 1];
      for (const t of tries) { const vals = all.filter(t.f); if (vals.length >= 5 || t.label === "全体") { use = { ...t, vals }; break; } }
      const vals = (use.vals || all.filter(use.f)).map(x => x.v), st = stats(vals);
      metrics[metric] = { scope: use.label, stats: st, percentile: st && mine > 0 ? Math.round(vals.filter(v => v <= mine).length / vals.length * 100) : null, total: all.length };
    }
    return J({ ok: true, type: "body", metrics });
  }
  if (!machine) return J({ error: "machine が必要です" });

  const raw = await env.OGT_SHARED.get(K(machine));
  const all = raw ? JSON.parse(raw) : [];
  // まず近い属性で絞り、少なすぎたら段階的に広げる（n が小さいと意味がないため）
  const tries = [
    { f: x => x.a === age && x.s === sex && x.g === goal, label: `同年代・同性別・同じ目的` },
    { f: x => x.a === age && x.s === sex,                 label: `同年代・同性別` },
    { f: x => x.s === sex,                                label: `同性別` },
    { f: () => true,                                      label: `全体` },
  ];
  let use = null;
  for (const t of tries) {
    const v = all.filter(t.f);
    if (v.length >= 5 || t.label === "全体") { use = { ...t, vals: v }; break; }
  }
  const vals = use.vals.map(x => x.w);
  const st = stats(vals);
  let pct = null;
  if (st && my > 0) pct = Math.round(vals.filter(v => v <= my).length / vals.length * 100);
  return J({ ok: true, machine, scope: use.label, stats: st, percentile: pct, total: all.length });
}
