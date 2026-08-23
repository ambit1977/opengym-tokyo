/**
 * 自然文 → 施設設定JSON
 * Cloudflare Workers AI（参加者特典）を Pages Functions から呼び出す。
 * 「JSONを書かせない」ための構造化エンドポイント。
 */
const MODELS = [
  "@cf/qwen/qwen3-30b-a3b-fp8",          // 特典マニュアルの推奨モデル
  "@cf/openai/gpt-oss-20b",
  "@cf/qwen/qwen2.5-coder-32b-instruct",
];

const SYS = [
  "あなたは公営ジムの設備情報をJSONに整理する担当です。",
  "入力された日本語の口頭メモから、次のスキーマのJSONだけを出力してください。",
  "説明・前置き・コードフェンスは一切出力しないでください。",
  '{"facility":"施設名","machines":[{"name":"マシン名","min":最小kg,"max":最大kg,"step":刻みkg}]}',
  "規則:",
  "- 数値は数値型で出力する（文字列にしない）",
  "- 施設名が不明なら facility は空文字にする",
  "- マシン名は一般的な日本語表記に正規化する（例: ラットプル → ラットプルダウン）",
  "- 重量が語られていないマシンは min:0, max:0, step:0 とする",
].join("\n");

function pickText(r) {
  if (typeof r === "string") return r;
  if (!r || typeof r !== "object") return "";
  const cands = [r.response, r.result && r.result.response, r.output_text,
                 r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content];
  for (const c of cands) if (typeof c === "string" && c.trim()) return c;
  const out = r.output || (r.result && r.result.output);
  if (Array.isArray(out)) {
    const t = out.flatMap(o => (o && o.content) || [])
                 .map(c => c && c.text).filter(x => typeof x === "string").join("");
    if (t.trim()) return t;
  }
  if (r.response && typeof r.response === "object") return JSON.stringify(r.response);
  return "";
}

function extractJSON(raw) {
  const t = pickText(raw);
  if (!t) return null;
  const s = t.replace(/<think>[\s\S]*?<\/think>/gi, "")
             .replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b < a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
}

export async function onRequestPost({ request, env }) {
  const J = (o, st) => new Response(JSON.stringify(o), { status: st || 200,
    headers: { "content-type": "application/json; charset=utf-8" } });
  try {
    const body = await request.json();
    const text = (body && body.text || "").trim();
    if (!text) return J({ error: "テキストが空です" }, 400);
    if (text.length > 2000) return J({ error: "長すぎます（2000字まで）" }, 400);

    let lastErr = "";
    for (const model of MODELS) {
      try {
        const r = await env.AI.run(model, {
          messages: [{ role: "system", content: SYS }, { role: "user", content: text }],
          max_tokens: 1200, temperature: 0.1,
        });
        const out = extractJSON(r);
        if (out && Array.isArray(out.machines)) {
          out.facility = String(out.facility || "");
          out.machines = out.machines.filter(m => m && m.name).map(m => ({
            name: String(m.name), min: Number(m.min) || 0,
            max: Number(m.max) || 0, step: Number(m.step) || 0 }));
          return J({ ok: true, model, data: out });
        }
        lastErr = model + ": " + JSON.stringify(r).slice(0, 200);
      } catch (e) { lastErr = model + ": " + String(e && e.message || e); }
    }
    return J({ error: "構造化に失敗しました", detail: lastErr }, 502);
  } catch (e) {
    return J({ error: String(e && e.message || e) }, 500);
  }
}
