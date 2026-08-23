/**
 * AIトレーナー
 * その施設に「実際にある」マシン構成と、利用者の記録履歴を渡して助言させる。
 * 汎用の記録アプリやYouTubeでは成立しない「実機に紐づいた個別アドバイス」を担う。
 */
const MODELS = ["@cf/qwen/qwen3-30b-a3b-fp8", "@cf/openai/gpt-oss-20b"];

const SYS = [
  "あなたは公営ジムのパーソナルトレーナーです。",
  "利用者が通う施設に『実際に設置されているマシン』と、その利用者の記録履歴だけを根拠に助言します。",
  "施設に無いマシンや、フリーウエイト種目を勝手に前提にしてはいけません。",
  "出力は次の3項目。各項目2文以内。合計250字以内。前置き不要。",
  "【次回の目安】 マシン名と具体的な重量。刻み幅に沿った実在する重量にすること。",
  "【フォームの注意】 そのマシン特有の注意点を1つ。",
  "【休息】 前回からの経過日数を踏まえて、今日やるべきか休むべきか。",
  "医療的な断定はせず、痛みがある場合は無理をしないよう添えること。",
  "考えを書き出さず、いきなり3項目を出力すること。 /no_think",
].join("\n");

function pickText(r) {
  if (typeof r === "string") return r;
  if (!r || typeof r !== "object") return "";
  const c = [r.response, r.result && r.result.response, r.output_text,
             r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content];
  for (const x of c) if (typeof x === "string" && x.trim()) return x;
  const out = r.output || (r.result && r.result.output);
  if (Array.isArray(out)) {
    // gpt-oss は reasoning と output_text が混在する。本文を優先する
    const items = out.flatMap(o => (o && o.content) || []);
    const body = items.filter(z => z && (z.type === "output_text" || z.type === "text"))
                      .map(z => z.text).filter(Boolean).join("");
    if (body.trim()) return body;
    const any = items.map(z => z && z.text).filter(x => typeof x === "string").join("");
    if (any.trim()) return any;
  }
  return "";
}

/** 推論ブロックを落とす。閉じていない場合も考慮する */
function stripThink(t) {
  if (!t) return "";
  let s = String(t).replace(/<think>[\s\S]*?<\/think>/gi, "");
  if (/<think>/i.test(s)) {
    const i = s.toLowerCase().lastIndexOf("</think>");
    s = i >= 0 ? s.slice(i + 8) : s.replace(/<think>[\s\S]*$/i, "");
  }
  return s.trim();
}

export async function onRequestPost({ request, env }) {
  const J = (o, st) => new Response(JSON.stringify(o), { status: st || 200,
    headers: { "content-type": "application/json; charset=utf-8" } });
  try {
    const { facility, machines, history } = await request.json();
    if (!Array.isArray(machines) || !machines.length)
      return J({ error: "施設のマシン構成がありません" }, 400);

    const ms = machines.slice(0, 20)
      .map(m => `${m.name}（${m.min}〜${m.max}kg / ${m.step}kg刻み）`).join("、");
    const hs = (history || []).slice(-12)
      .map(h => `${h.m} ${h.w}kg（${h.d}日前）`).join("、") || "記録なし（初回）";

    const user = [
      `施設: ${facility || "公営ジム"}`,
      `設置マシン: ${ms}`,
      `直近の記録: ${hs}`,
      "この人への今日の助言を、上の3項目で。",
    ].join("\n");

    let lastErr = "";
    for (const model of MODELS) {
      try {
        const r = await env.AI.run(model, {
          messages: [{ role: "system", content: SYS }, { role: "user", content: user }],
          max_tokens: 1600, temperature: 0.4,
        });
        let t = stripThink(pickText(r));
        if (t) return J({ ok: true, model, advice: t });
        lastErr = model + ": 空応答";
      } catch (e) { lastErr = model + ": " + String(e && e.message || e); }
    }
    return J({ error: "助言の生成に失敗しました", detail: lastErr }, 502);
  } catch (e) { return J({ error: String(e && e.message || e) }, 500); }
}
