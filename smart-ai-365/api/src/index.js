export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";
    const corsOrigin = allowedOrigin === "*" || origin === allowedOrigin ? (allowedOrigin === "*" ? "*" : origin) : "";

    const headers = {
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    };
    if (corsOrigin) headers["Access-Control-Allow-Origin"] = corsOrigin;

    const json = (data, status = 200) => new Response(JSON.stringify(data), {
      status,
      headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });

    if (request.method === "OPTIONS") {
      if (!corsOrigin) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "SMART AI 365", engine: "Qwen3", status: "worker_ready" });
    }
    if (request.method !== "POST" || url.pathname !== "/api/chat") {
      return json({ error: "المسار غير موجود." }, 404);
    }
    if (!corsOrigin) return json({ error: "هذا النطاق غير مصرح له." }, 403);

    try {
      const body = await request.json();
      if (!Array.isArray(body.messages) || body.messages.length === 0) {
        return json({ error: "أرسل رسالة واحدة على الأقل." }, 400);
      }

      const recent = body.messages.slice(-12).map((m) => {
        if (!m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string") {
          throw new Error("صيغة الرسائل غير صحيحة.");
        }
        const content = m.content.trim();
        if (!content || content.length > 6000) throw new Error("يجب أن تكون الرسالة بين حرف واحد و6000 حرف.");
        return { role: m.role, content };
      });
      if (recent[recent.length - 1].role !== "user") {
        return json({ error: "آخر رسالة يجب أن تكون من المستخدم." }, 400);
      }

      const system = {
        role: "system",
        content: "You are SMART AI 365, a careful, capable multilingual assistant. Reply in the same language as the user's latest message unless asked otherwise. Support Arabic, English, Hindi and other languages. Be accurate, structured and helpful. For math, reason carefully and verify calculations. For code, provide runnable code and explain assumptions. Never invent facts, citations, live data, or capabilities. If uncertain or information may be outdated, say so clearly and suggest verification. Distinguish facts from estimates and opinions. Do not claim to have browsed the web, opened files, or executed code unless a tool actually did so. Keep answers clear and adapt detail to the request."
      };

      const result = await env.AI.run(env.MODEL || "@cf/qwen/qwen3-30b-a3b-fp8", {
        messages: [system, ...recent],
        max_tokens: 1400,
        temperature: 0.35
      });

      const answer = result?.response || result?.result?.response || "";
      if (typeof answer !== "string" || !answer.trim()) {
        return json({ error: "لم يصل رد صالح من محرك الذكاء الاصطناعي. حاول مرة أخرى." }, 502);
      }
      return json({
        ok: true,
        answer: answer.trim(),
        model: env.MODEL || "@cf/qwen/qwen3-30b-a3b-fp8"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع.";
      return json({ error: message }, 400);
    }
  }
};
