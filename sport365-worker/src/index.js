/**
 * SPORT 365 read-only API gateway.
 * Configure SPORTS_FEED_URL to an authorized JSON feed matching the documented schema.
 * Never put provider credentials in the website.
 */
function cors(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGIN || "").split(",").map(x => x.trim()).filter(Boolean);
  const allowOrigin = !allowed.length || allowed.includes(origin) ? (origin || "*") : "null";
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
}
function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}
async function loadFeed(env) {
  if (!env.SPORTS_FEED_URL) return { ok:false, reason:"لم يتم ضبط مصدر مباريات مصرح به", matches:[] };
  let url;
  try { url = new URL(env.SPORTS_FEED_URL); } catch { return { ok:false, reason:"عنوان مصدر البيانات غير صالح", matches:[] }; }
  if (url.protocol !== "https:") return { ok:false, reason:"يجب أن يستخدم مصدر البيانات HTTPS", matches:[] };
  const headers = { accept:"application/json" };
  if (env.SPORTS_FEED_TOKEN) headers.authorization = `Bearer ${env.SPORTS_FEED_TOKEN}`;
  try {
    const response = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (!body || !Array.isArray(body.matches)) throw new Error("صيغة المصدر غير مطابقة: يجب أن تحتوي matches على قائمة");
    return { ok:true, updatedAt:body.updatedAt || null, matches:body.matches, reason:null };
  } catch (error) {
    return { ok:false, reason:`تعذر جلب المصدر: ${error.message}`, matches:[] };
  }
}
async function getFeed(env, ctx) {
  const cache = caches.default;
  const key = new Request("https://sport365-internal.invalid/feed-cache");
  const cached = await cache.match(key);
  if (cached) return cached.json();
  const data = { ...(await loadFeed(env)), checkedAt:new Date().toISOString() };
  const response = new Response(JSON.stringify(data), { headers:{ "content-type":"application/json", "cache-control":"public, max-age=15" } });
  ctx.waitUntil(cache.put(key, response.clone()));
  return data;
}
export default {
  async fetch(request, env, ctx) {
    const headers = cors(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status:204, headers });
    if (request.method !== "GET") return json({error:"method_not_allowed"},405,headers);
    const path = new URL(request.url).pathname;
    if (path === "/health") return json({ service:"SPORT 365 API", status:"ok", feedConfigured:Boolean(env.SPORTS_FEED_URL) },200,headers);
    if (path === "/api/matches") return json(await getFeed(env,ctx),200,headers);
    if (path === "/api/analysis") {
      const data = await getFeed(env,ctx);
      const match = data.matches.find(m => /live|مباشر|الشوط|حي/i.test(m.status || "")) || data.matches[0] || null;
      return json({ ok:data.ok && Boolean(match), reason:!data.ok?data.reason:(match?null:"لا توجد مباراة متاحة"), match,
        summary:match ? "قراءة وصفية للأحداث الواردة فقط. لا يمكن استنتاج الاستحواذ أو الضغط أو xG دون إحصاءات موثوقة." : null },200,headers);
    }
    return json({error:"not_found"},404,headers);
  }
};
