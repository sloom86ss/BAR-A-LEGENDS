/**
 * SPORT 365 Data Bot — server-side football data collector.
 * Primary source: OpenLigaDB (free, no API key; community maintained).
 * Coverage is limited to the configured competitions. Never fabricate match minutes or events.
 */
const API = "https://api.openligadb.de";
const DEFAULT_LEAGUES = ["bl1", "bl2", "bl3", "dfb"];
const CACHE_KEY = new Request("https://sport365-internal.invalid/openligadb-feed-v1");

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
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}
async function getJson(path) {
  const response = await fetch(API + path, {
    headers: { accept: "application/json", "user-agent": "SPORT365-DataBot/1.0" },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`OpenLigaDB HTTP ${response.status} at ${path}`);
  return response.json();
}
function seasonForNow(now = new Date()) {
  // Most German football seasons begin in July.
  return now.getUTCMonth() < 6 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
}
function scoreFromMatch(match) {
  const goals = Array.isArray(match.goals) ? match.goals : [];
  if (goals.length) {
    const last = goals[goals.length - 1];
    if (Number.isFinite(last.scoreTeam1) && Number.isFinite(last.scoreTeam2)) {
      return [last.scoreTeam1, last.scoreTeam2];
    }
  }
  const results = Array.isArray(match.matchResults) ? match.matchResults : [];
  const final = results.find(x => Number(x.resultTypeID) === 2) || results[results.length - 1];
  return final
    ? [Number(final.pointsTeam1 ?? 0), Number(final.pointsTeam2 ?? 0)]
    : [0, 0];
}
function normalizeMatch(match, now = Date.now()) {
  const kickoff = match.matchDateTimeUTC || match.matchDateTime || null;
  const kickoffMs = kickoff ? Date.parse(kickoff) : NaN;
  const finished = match.matchIsFinished === true;
  let status = "موعد المباراة غير محدد";
  let statusConfidence = "unknown";
  if (finished) {
    status = "انتهت";
    statusConfidence = "source_confirmed";
  } else if (Number.isFinite(kickoffMs) && kickoffMs > now) {
    status = "لم تبدأ";
    statusConfidence = "time_based";
  } else if (Number.isFinite(kickoffMs) && now - kickoffMs <= 3 * 60 * 60 * 1000) {
    status = "جارية حسب توقيت البداية — الدقيقة غير متاحة";
    statusConfidence = "time_inferred";
  } else if (Number.isFinite(kickoffMs)) {
    status = "حالة المباراة غير مؤكدة من المصدر";
    statusConfidence = "unknown";
  }

  const [homeScore, awayScore] = scoreFromMatch(match);
  const goals = Array.isArray(match.goals) ? match.goals : [];
  const events = goals.map(goal => ({
    type: "هدف",
    minute: Number.isFinite(Number(goal.matchMinute)) ? Number(goal.matchMinute) : null,
    player: goal.goalGetterName || null,
    team: Number(goal.scoreTeam1) > 0 ? null : null,
    detail: [goal.isPenalty ? "ركلة جزاء" : "", goal.isOwnGoal ? "هدف عكسي" : ""].filter(Boolean).join("، ") || null
  }));
  return {
    id: String(match.matchID),
    league: match.leagueName || match.leagueShortcut || "بطولة غير محددة",
    leagueCode: match.leagueShortcut || null,
    home: match.team1?.teamName || "الفريق المضيف",
    away: match.team2?.teamName || "الفريق الضيف",
    status,
    statusConfidence,
    minute: null,
    kickoff,
    homeScore,
    awayScore,
    finished,
    events,
    venue: match.location?.locationStadium || match.location?.locationName || null,
    source: "OpenLigaDB",
    sourceUpdatedAt: match.lastUpdateDateTime || null
  };
}
async function loadOpenLigaDB(env) {
  const now = new Date();
  const season = Number(env.OPENLIGADB_SEASON) || seasonForNow(now);
  const leagues = (env.OPENLIGADB_LEAGUES || DEFAULT_LEAGUES.join(","))
    .split(",").map(x => x.trim()).filter(Boolean).slice(0, 8);
  const outcomes = await Promise.all(leagues.map(async shortcut => {
    try {
      const group = await getJson(`/getcurrentgroup/${encodeURIComponent(shortcut)}`);
      if (!group || !Number.isFinite(Number(group.groupOrderID))) {
        return { league: shortcut, matches: [], note: "لا توجد جولة حالية معلنة" };
      }
      const matches = await getJson(
        `/getmatchdata/${encodeURIComponent(shortcut)}/${season}/${Number(group.groupOrderID)}`
      );
      if (!Array.isArray(matches)) throw new Error("صيغة قائمة المباريات غير متوقعة");
      return { league: shortcut, matches, note: null };
    } catch (error) {
      return { league: shortcut, matches: [], note: error.message };
    }
  }));
  const raw = outcomes.flatMap(x => x.matches);
  const unique = new Map();
  for (const match of raw) {
    if (match && match.matchID != null) unique.set(String(match.matchID), normalizeMatch(match));
  }
  const matches = [...unique.values()].sort((a, b) => {
    const liveA = a.statusConfidence === "time_inferred" ? 1 : 0;
    const liveB = b.statusConfidence === "time_inferred" ? 1 : 0;
    return liveB - liveA || String(a.kickoff || "").localeCompare(String(b.kickoff || ""));
  });
  const successful = outcomes.filter(x => !x.note).length;
  return {
    ok: successful > 0,
    source: "OpenLigaDB",
    coverage: leagues,
    updatedAt: new Date().toISOString(),
    matches,
    reason: successful ? null : "تعذر الوصول إلى مصدر OpenLigaDB لجميع البطولات المحددة",
    warnings: outcomes.filter(x => x.note).map(x => ({ league: x.league, message: x.note })),
    limitations: [
      "التغطية تقتصر على البطولات التي يوفرها OpenLigaDB.",
      "المصدر مجتمعي وقد يتأخر تحديثه.",
      "لا يوفر هذا الموصل ساعة المباراة الحية؛ لذلك لا نخمن الدقيقة."
    ]
  };
}
async function getFeed() {
  const cache = caches.default;
  const cached = await cache.match(CACHE_KEY);
  if (cached) return cached.json();
  const data = await loadOpenLigaDB();
  await cache.put(CACHE_KEY, new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=90" }
  }));
  return data;
}
async function refreshFeed() {
  const data = await loadOpenLigaDB();
  await caches.default.put(CACHE_KEY, new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=90" }
  }));
  return data;
}
export default {
  async fetch(request, env) {
    const headers = cors(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, headers);
    const path = new URL(request.url).pathname;
    if (path === "/health") {
      return json({
        service: "SPORT 365 Data Bot",
        status: "ok",
        source: "OpenLigaDB",
        sourceConfigured: true,
        competitions: (env.OPENLIGADB_LEAGUES || DEFAULT_LEAGUES.join(",")).split(",").map(x => x.trim())
      }, 200, headers);
    }
    if (path === "/api/matches") return json(await getFeed(), 200, headers);
    if (path === "/api/analysis") {
      const data = await getFeed();
      const match = data.matches.find(m => m.statusConfidence === "time_inferred") || data.matches[0] || null;
      return json({
        ok: data.ok && Boolean(match),
        source: data.source,
        reason: !data.ok ? data.reason : (match ? null : "لا توجد مباراة متاحة ضمن البطولات التي يغطيها المصدر"),
        match,
        summary: match
          ? "القراءة مبنية على النتيجة والأهداف المسجلة من المصدر فقط. لا تتوفر ساعة لعب مباشرة أو إحصاءات تكتيكية كافية."
          : null,
        limitations: data.limitations
      }, 200, headers);
    }
    return json({ error: "not_found" }, 404, headers);
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(refreshFeed());
  }
};
