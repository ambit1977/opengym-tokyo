/**
 * バーチャルイベント（AIが企画・進行）
 * 週替わりのチャレンジをAIが立て、参加者の積み上げに応じてAIが応援を返す。
 * 参加者は匿名IDのみ。個人が特定される情報は保持しない。
 */
const MODELS = ["@cf/qwen/qwen3-30b-a3b-fp8", "@cf/openai/gpt-oss-20b"];

function weekKey(now) {
  const d = new Date(now);
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const wd = new Date(t).getUTCDay() || 7;
  const th = t + (4 - wd) * 86400000;
  const y = new Date(th).getUTCFullYear();
  const w = Math.ceil(((th - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `ev:${y}-W${String(w).padStart(2, "0")}`;
}
function pick(r) {
  if (typeof r === "string") return r;
  if (!r || typeof r !== "object") return "";
  const cands = [r.response, r.result && r.result.response, r.output_text,
    r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content,
    r.result && r.result.choices && r.result.choices[0] && r.result.choices[0].message && r.result.choices[0].message.content];
  for (const c of cands) if (typeof c === "string" && c.trim()) return c;
  const out = r.output || (r.result && r.result.output);
  if (Array.isArray(out)) {
    const it = out.flatMap(o => (o && o.content) || []);
    const b = it.filter(z => z && (z.type === "output_text" || z.type === "text")).map(z => z.text).join("");
    if (b.trim()) return b;
  }
  return "";
}
const clean = t => String(t || "").replace(/<think>[\s\S]*?<\/think>/gi, "")
  .replace(/```json/gi, "").replace(/```/g, "").trim();

async function gen(env, sys, user, max) {
  const errs = [];
  for (const model of MODELS) {
    try {
      const r = await env.AI.run(model, {
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        max_tokens: max || 900, temperature: 0.6,
      });
      const t = clean(pick(r));
      if (t) return { t, model };
      errs.push(model + ": empty | raw=" + JSON.stringify(r).slice(0, 300));
    } catch (e) { errs.push(model + ": " + String(e && e.message || e).slice(0, 200)); }
  }
  return { t: "", model: null, errs };
}

export async function onRequestGet({ request, env }) {
  const J = o => new Response(JSON.stringify(o), { headers: { "content-type": "application/json; charset=utf-8" } });
  const now = Number(new URL(request.url).searchParams.get("now")) || Date.now();
  const key = weekKey(now);
  const force = new URL(request.url).searchParams.get("force");
  const raw = force ? null : await env.OGT_SHARED.get(key);
  if (raw) return J({ ok: true, ...JSON.parse(raw) });

  const g = await gen(env,
    ["あなたは公営ジムのコミュニティ運営者です。今週の匿名チャレンジ企画を1つ作ります。",
     "誰でも参加でき、器具の有無や体力差で不利にならない企画にしてください。",
     "次のJSONだけを出力。説明不要。",
     '{"title":"20字以内","body":"60字以内の説明","unit":"積み上げる単位（例: 回、セット、分）","goal":参加者全体の目標数値}',
     "考えを書き出さず、いきなりJSONだけを出力すること。 /no_think"].join("\n"),
    "今週のチャレンジを作ってください。", 1500);

  let ev = { title: "今週の積み上げチャレンジ", body: "できる範囲で回数を積み上げましょう。", unit: "回", goal: 1000, by: "fallback" };
  if (g && g.t) { try { const o = JSON.parse(g.t.slice(g.t.indexOf("{"), g.t.lastIndexOf("}") + 1));
    if (o && o.title) ev = { title: String(o.title), body: String(o.body || ""), unit: String(o.unit || "回"), goal: Number(o.goal) || 1000, by: g.model }; } catch (e) {} }

  const rec = { week: key.slice(3), ...ev, total: 0, people: 0, ids: [], cheers: [] };
  await env.OGT_SHARED.put(key, JSON.stringify(rec));
  return J({ ok: true, ...rec });
}

export async function onRequestPost({ request, env }) {
  const J = (o, st) => new Response(JSON.stringify(o), { status: st || 200,
    headers: { "content-type": "application/json; charset=utf-8" } });
  try {
    const { anonId, amount, now } = await request.json();
    if (!anonId) return J({ error: "匿名IDがありません" }, 400);
    const key = weekKey(Number(now) || Date.now());
    const raw = await env.OGT_SHARED.get(key);
    if (!raw) return J({ error: "今週のイベントがまだありません" }, 400);
    const rec = JSON.parse(raw);
    const add = Math.max(0, Math.min(500, Number(amount) || 0));
    rec.total = (rec.total || 0) + add;
    if (!rec.ids.includes(anonId)) { rec.ids.push(anonId); rec.people = rec.ids.length; }

    const g = await gen(env,
      ["あなたは匿名のトレーニング仲間です。参加者への短い応援を1文だけ返します。",
       "40字以内。名前や個人情報には触れない。押し付けず、軽く。絵文字は使わない。",
       "考えを書き出さず、応援の一文だけを返すこと。"].join("\n"),
      `今週の企画「${rec.title}」。全体で ${rec.total}${rec.unit}／目標 ${rec.goal}${rec.unit}。参加者 ${rec.people} 人。いま ${add}${rec.unit} 積んだ人に一言。 /no_think`, 900);
    const cheer = g ? g.t.split("\n")[0].slice(0, 60) : "その積み上げ、ちゃんと効いています。";
    rec.cheers = [cheer, ...(rec.cheers || [])].slice(0, 8);
    await env.OGT_SHARED.put(key, JSON.stringify(rec));
    return J({ ok: true, cheer, total: rec.total, people: rec.people, goal: rec.goal, unit: rec.unit, by: g && g.model });
  } catch (e) { return J({ error: String(e && e.message || e) }, 500); }
}
