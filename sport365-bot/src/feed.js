const timeoutMs = 12000;
const MAX_MATCHES = 500;
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const validMinute = value => Number.isInteger(value) && value >= 0 && value <= 130;
const validScore = value => Number.isInteger(value) && value >= 0 && value <= 30;

function normalizeEvent(event) {
  if (!isObject(event) || typeof event.type !== "string" || !event.type.trim()) return null;
  return {
    type: event.type.trim().slice(0, 60),
    minute: validMinute(event.minute) ? event.minute : null,
    team: ["home", "away"].includes(event.team) ? event.team : null,
    player: typeof event.player === "string" ? event.player.slice(0, 100) : null,
    detail: typeof event.detail === "string" ? event.detail.slice(0, 180) : null,
    confidence: typeof event.confidence === "string" ? event.confidence : "source_recorded"
  };
}
function normalizeMatch(match) {
  if (!isObject(match) || match.id == null) return null;
  if (typeof match.home !== "string" || typeof match.away !== "string") return null;
  const events = Array.isArray(match.events) ? match.events.slice(0, 300).map(normalizeEvent).filter(Boolean) : [];
  return {
    id: String(match.id).slice(0, 120),
    league: typeof match.league === "string" ? match.league.slice(0, 120) : "بطولة غير محددة",
    home: match.home.slice(0, 120),
    away: match.away.slice(0, 120),
    status: typeof match.status === "string" ? match.status.slice(0, 100) : "الحالة غير محددة",
    statusConfidence: ["source_confirmed", "time_based", "unknown"].includes(match.statusConfidence) ? match.statusConfidence : "unknown",
    minute: validMinute(match.minute) ? match.minute : null,
    homeScore: validScore(match.homeScore) ? match.homeScore : null,
    awayScore: validScore(match.awayScore) ? match.awayScore : null,
    kickoff: typeof match.kickoff === "string" && !Number.isNaN(Date.parse(match.kickoff)) ? match.kickoff : null,
    finished: match.finished === true,
    events,
    source: typeof match.source === "string" ? match.source.slice(0, 80) : "غير محدد",
    sourceUpdatedAt: typeof match.sourceUpdatedAt === "string" ? match.sourceUpdatedAt : null,
    recordUpdatedAt: typeof match.recordUpdatedAt === "string" ? match.recordUpdatedAt : null
  };
}
export function validateFeed(data) {
  if (!isObject(data) || !Array.isArray(data.matches)) {
    return { ok: false, reason: "صيغة مصدر البيانات غير مطابقة", matches: [], sourceFreshness: "unknown" };
  }
  const matches = data.matches.slice(0, MAX_MATCHES).map(normalizeMatch).filter(Boolean);
  const updated = typeof data.updatedAt === "string" ? Date.parse(data.updatedAt) : NaN;
  const ageMs = Number.isFinite(updated) ? Math.max(0, Date.now() - updated) : null;
  const sourceFreshness = ageMs == null ? "unknown" : ageMs <= 180000 ? "fresh" : ageMs <= 600000 ? "aging" : "stale";
  return {
    ok: data.ok !== false,
    reason: typeof data.reason === "string" ? data.reason : null,
    source: typeof data.source === "string" ? data.source : "غير محدد",
    sourceType: typeof data.sourceType === "string" ? data.sourceType : "unknown",
    updatedAt: Number.isFinite(updated) ? new Date(updated).toISOString() : null,
    retrievedAt: typeof data.retrievedAt === "string" ? data.retrievedAt : null,
    sourceFreshness,
    ageSeconds: ageMs == null ? null : Math.floor(ageMs / 1000),
    warnings: Array.isArray(data.warnings) ? data.warnings.slice(0, 50) : [],
    limitations: Array.isArray(data.limitations) ? data.limitations.slice(0, 30) : [],
    matches
  };
}

/**
 * Read only a configured, licensed JSON feed. The token is server-side only.
 * A stale feed is returned as stale metadata, never silently relabelled fresh.
 */
export async function fetchMatches() {
  const url = process.env.SPORTS_FEED_URL;
  if (!url) return { ok: false, reason: "لم يتم إعداد مصدر بيانات المباريات بعد", matches: [], sourceFreshness: "unknown" };
  let parsed;
  try { parsed = new URL(url); } catch { return { ok: false, reason: "عنوان مصدر البيانات غير صالح", matches: [], sourceFreshness: "unknown" }; }
  if (parsed.protocol !== "https:") return { ok: false, reason: "يجب أن يستخدم مصدر البيانات اتصال HTTPS", matches: [], sourceFreshness: "unknown" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { accept: "application/json" };
    if (process.env.SPORTS_FEED_TOKEN) headers.authorization = `Bearer ${process.env.SPORTS_FEED_TOKEN}`;
    const response = await fetch(parsed, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const normalized = validateFeed(data);
    return { ...normalized, checkedAt: new Date().toISOString() };
  } catch (error) {
    return {
      ok: false,
      reason: error.name === "AbortError" ? "انتهت مهلة مصدر البيانات" : error.message,
      matches: [], sourceFreshness: "unknown", checkedAt: new Date().toISOString()
    };
  } finally {
    clearTimeout(timer);
  }
}
