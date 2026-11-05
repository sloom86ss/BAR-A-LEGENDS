import http from "node:http";
import { fetchMatches } from "./feed.js";
import { analyzeMatch, formatMatches } from "./analyzer.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const pollSeconds = Math.max(30, Number(process.env.POLL_SECONDS || 60));
const port = Number(process.env.PORT || 8787);
let lastFeed = { ok: false, reason: "لم يبدأ الفحص", matches: [] };
let lastUpdateId = 0;
let lastFingerprint = "";

async function telegram(method, body = {}) {
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN غير مضبوط");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.description || "Telegram API error");
  return data.result;
}

async function sendMessage(target, text) {
  if (!token || !target) return;
  return telegram("sendMessage", { chat_id: target, text, disable_web_page_preview: true });
}

async function handleCommand(message) {
  const target = message.chat?.id;
  const command = (message.text || "").trim().split(/\s+/)[0].split("@")[0].toLowerCase();
  if (!target || !command.startsWith("/")) return;
  if (command === "/start" || command === "/help") {
    return sendMessage(target, "مرحباً بك في SPORT 365 AI BOT ⚽\nالأوامر:\n/status حالة النظام\n/matches المباريات المتاحة\n/analysis تحليل آخر مباراة واردة");
  }
  if (command === "/status") {
    return sendMessage(target, `حالة البوت: يعمل\nمصدر المباريات: ${lastFeed.ok ? "متصل" : "غير متصل"}\nعدد المباريات: ${lastFeed.matches.length}\nآخر فحص: ${lastFeed.checkedAt || "لم يتم"}\nسبب التعذر: ${lastFeed.ok ? "لا يوجد" : lastFeed.reason}`);
  }
  if (command === "/matches") return sendMessage(target, formatMatches(lastFeed.matches));
  if (command === "/analysis") {
    const match = lastFeed.matches.find(m => m.status && /live|مباشر|الشوط|حي/i.test(m.status)) || lastFeed.matches[0];
    return sendMessage(target, match ? analyzeMatch(match) : "لا توجد مباراة متاحة للتحليل من المصدر حالياً.");
  }
  return sendMessage(target, "أمر غير معروف. أرسل /help لعرض الأوامر.");
}

async function pollTelegram() {
  if (!token) return;
  try {
    const updates = await telegram("getUpdates", { offset: lastUpdateId + 1, timeout: 0, allowed_updates: ["message"] });
    for (const update of updates) {
      lastUpdateId = Math.max(lastUpdateId, update.update_id);
      await handleCommand(update.message || {});
    }
  } catch (error) {
    console.error("Telegram polling:", error.message);
  }
}

async function refreshFeed() {
  const result = await fetchMatches();
  lastFeed = { ...result, checkedAt: new Date().toISOString() };
  if (!result.ok) {
    console.error("Feed unavailable:", result.reason);
    return;
  }
  // Push only new event snapshots; do not repeatedly spam the same update.
  const live = result.matches.filter(m => /live|مباشر|الشوط|حي/i.test(m.status || ""));
  const fingerprint = JSON.stringify(live.map(m => ({ id: m.id, score: [m.homeScore,m.awayScore], minute: m.minute, events: m.events })));
  if (chatId && fingerprint !== lastFingerprint && lastFingerprint) {
    await sendMessage(chatId, "تحديث مباريات SPORT 365 ⚽\n" + formatMatches(live));
  }
  lastFingerprint = fingerprint;
}

const server = http.createServer((req, res) => {
  res.setHeader("content-type", "application/json; charset=utf-8");
  if (req.url === "/health") {
    res.writeHead(200);
    return res.end(JSON.stringify({ service: "SPORT 365 AI BOT", status: "ok", feedConnected: lastFeed.ok, checkedAt: lastFeed.checkedAt || null }));
  }
  res.writeHead(404);
  res.end(JSON.stringify({ error: "not_found" }));
});
server.listen(port, () => console.log(`SPORT 365 AI BOT listening on ${port}`));

await refreshFeed();
setInterval(refreshFeed, pollSeconds * 1000);
setInterval(pollTelegram, 2500);
