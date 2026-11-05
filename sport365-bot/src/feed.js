const timeoutMs = 12000;

/**
 * Expected normalized feed:
 * { updatedAt: ISO string, matches: [{id, league, home, away, status,
 *   minute, homeScore, awayScore, events:[{type, minute, team, player, detail}]}] }
 */
export async function fetchMatches() {
  const url = process.env.SPORTS_FEED_URL;
  if (!url) return { ok: false, reason: "لم يتم إعداد مصدر بيانات المباريات بعد", matches: [] };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { accept: "application/json" };
    if (process.env.SPORTS_FEED_TOKEN) {
      headers.authorization = `Bearer ${process.env.SPORTS_FEED_TOKEN}`;
    }
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data || !Array.isArray(data.matches)) {
      throw new Error("صيغة مصدر البيانات غير مطابقة");
    }
    return { ok: true, updatedAt: data.updatedAt || new Date().toISOString(), matches: data.matches };
  } catch (error) {
    return { ok: false, reason: error.name === "AbortError" ? "انتهت مهلة مصدر البيانات" : error.message, matches: [] };
  } finally {
    clearTimeout(timer);
  }
}
