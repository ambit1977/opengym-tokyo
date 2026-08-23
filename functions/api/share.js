/**
 * 施設設定の共有ストア（CGM）
 *
 * 設計の要点:
 *  - データ整備を目的にしない。利用者は「自分の記録のため」にマシン名と重量を入れる。
 *  - その入力は、そのままその施設のマシン構成そのものである。
 *  - 明示的な同意を取ったものだけを共有し、次に来た人の初期設定として配る。
 *  - 一極集中で誰かが作るのではなく、使う人が少しずつ整える。
 */
const KEY = f => "fac:" + f;

function mergeMachines(base, add) {
  const map = new Map();
  for (const m of base) map.set(m.name, { ...m, n: m.n || 1 });
  for (const m of add) {
    const cur = map.get(m.name);
    if (!cur) { map.set(m.name, { ...m, n: 1 }); continue; }
    // 多数決に寄せる: より多く報告された値を残し、報告数を積む
    map.set(m.name, {
      name: m.name,
      min: cur.n >= 1 ? cur.min : m.min,
      max: Math.max(Number(cur.max) || 0, Number(m.max) || 0),
      step: cur.step || m.step,
      n: (cur.n || 1) + 1,
    });
  }
  return [...map.values()].sort((a, b) => b.n - a.n);
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const f = u.searchParams.get("facility");
  const J = o => new Response(JSON.stringify(o),
    { headers: { "content-type": "application/json; charset=utf-8" } });
  if (!f) {
    const list = await env.OGT_SHARED.list({ prefix: "fac:" });
    return J({ ok: true, facilities: list.keys.length });
  }
  const raw = await env.OGT_SHARED.get(KEY(f));
  const rec = raw ? JSON.parse(raw) : { machines: [], contributions: 0 };
  return J({ ok: true, facility: f, ...rec });
}

export async function onRequestPost({ request, env }) {
  const J = (o, st) => new Response(JSON.stringify(o), { status: st || 200,
    headers: { "content-type": "application/json; charset=utf-8" } });
  try {
    const { facility, machines, consent } = await request.json();
    if (!consent) return J({ error: "共有の同意がありません" }, 400);
    if (!facility || !Array.isArray(machines) || !machines.length)
      return J({ error: "施設名またはマシン情報がありません" }, 400);

    const clean = machines.slice(0, 40).filter(m => m && m.name).map(m => ({
      name: String(m.name).slice(0, 40),
      min: Number(m.min) || 0, max: Number(m.max) || 0, step: Number(m.step) || 0,
    }));
    const raw = await env.OGT_SHARED.get(KEY(facility));
    const rec = raw ? JSON.parse(raw) : { machines: [], contributions: 0 };
    rec.machines = mergeMachines(rec.machines, clean);
    rec.contributions = (rec.contributions || 0) + 1;
    rec.updated = new Date().toISOString();
    await env.OGT_SHARED.put(KEY(facility), JSON.stringify(rec));
    return J({ ok: true, facility, machines: rec.machines, contributions: rec.contributions });
  } catch (e) { return J({ error: String(e && e.message || e) }, 500); }
}
