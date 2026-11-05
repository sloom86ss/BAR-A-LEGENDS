/**
 * SPORT 365 Football Intelligence — verified-data foundation.
 * OpenLigaDB is the first limited-coverage adapter. Never infer live status,
 * fabricate scores, or invent match statistics.
 */
const API = "https://api.openligadb.de";
const DEFAULT_LEAGUES = ["bl1", "bl2", "bl3", "dfb"];
const CACHE_KEY = new Request("https://sport365-internal.invalid/football-feed-v2");

function cors(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGIN || "").split(",").map(x => x.trim()).filter(Boolean);
  return {
    "access-control-allow-origin": !allowed.length || allowed.includes(origin) ? (origin || "*") : "null",
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
    headers: { accept: "application/json", "user-agent": "SPORT365-Football-Intelligence/1.0" },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`OpenLigaDB HTTP ${response.status}`);
  return response.json();
}
function seasonForNow(now = new Date()) {
  return now.getUTCMonth() < 6 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
}
function scoreFromMatch(match) {
  const goals = Array.isArray(match.goals) ? match.goals : [];
  if (goals.length) {
    const last = goals[goals.length - 1];
    if (Number.isFinite(Number(last.scoreTeam1)) && Number.isFinite(Number(last.scoreTeam2))) {
      return [Number(last.scoreTeam1), Number(last.scoreTeam2)];
    }
  }
  const results = Array.isArray(match.matchResults) ? match.matchResults : [];
  const final = results.find(x => Number(x.resultTypeID) === 2) || results[results.length - 1];
  if (!final) return [null, null];
  const home = Number(final.pointsTeam1);
  const away = Number(final.pointsTeam2);
  return [Number.isFinite(home) ? home : null, Number.isFinite(away) ? away : null];
}
function normalizeEvents(goals) {
  let previousHome = 0;
  let previousAway = 0;
  return goals.map(goal => {
    const home = Number(goal.scoreTeam1);
    const away = Number(goal.scoreTeam2);
    let team = null;
    if (Number.isFinite(home) && Number.isFinite(away)) {
      if (home > previousHome && away === previousAway) team = "home";
      else if (away > previousAway && home === previousHome) team = "away";
      previousHome = home;
      previousAway = away;
    }
    const minute = Number(goal.matchMinute);
    return {
      type: "هدف",
      minute: Number.isFinite(minute) && minute >= 0 ? minute : null,
      player: goal.goalGetterName || null,
      team,
      detail: [goal.isPenalty ? "ركلة جزاء" : "", goal.isOwnGoal ? "هدف عكسي" : ""].filter(Boolean).join("، ") || null,
      confidence: "source_recorded"
    };
  });
}
function normalizeMatch(match) {
  const kickoff = match.matchDateTimeUTC || match.matchDateTime || null;
  const kickoffMs = kickoff ? Date.parse(kickoff) : NaN;
  const finished = match.matchIsFinished === true;
  let status = "الحالة غير محددة من المصدر";
  let statusConfidence = "unknown";
  if (finished) {
    status = "انتهت";
    statusConfidence = "source_confirmed";
  } else if (Number.isFinite(kickoffMs) && kickoffMs > Date.now()) {
    status = "لم تبدأ";
    statusConfidence = "time_based";
  } else if (Number.isFinite(kickoffMs)) {
    status = "موعد البداية مضى — الحالة غير مؤكدة";
  }

  const [homeScore, awayScore] = scoreFromMatch(match);
  const goals = Array.isArray(match.goals) ? match.goals : [];
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
    events: normalizeEvents(goals),
    venue: match.location?.locationStadium || match.location?.locationName || null,
    source: "OpenLigaDB",
    sourceUpdatedAt: match.lastUpdateDateTime || null,
    recordUpdatedAt: new Date().toISOString()
  };
}
async function loadOpenLigaDB(env) {
  const now = new Date();
  const season = Number(env.OPENLIGADB_SEASON) || seasonForNow(now);
  const leagues = (env.OPENLIGADB_LEAGUES || DEFAULT_LEAGUES.join(","))
    .split(",").map(x => x.trim()).filter(Boolean).slice(0, 20);
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
  const unique = new Map();
  for (const item of outcomes.flatMap(x => x.matches)) {
    if (item && item.matchID != null) unique.set(String(item.matchID), normalizeMatch(item));
  }
  const matches = [...unique.values()].sort((a, b) =>
    String(a.kickoff || "").localeCompare(String(b.kickoff || ""))
  );
  const successful = outcomes.filter(x => !x.note).length;
  return {
    ok: successful > 0,
    service: "SPORT 365 Football Intelligence",
    source: "OpenLigaDB",
    sourceType: "community",
    coverage: leagues,
    updatedAt: new Date().toISOString(),
    matches,
    reason: successful ? null : "تعذر الوصول إلى مصدر OpenLigaDB لجميع البطولات المحددة",
    warnings: outcomes.filter(x => x.note).map(x => ({ league: x.league, message: x.note })),
    limitations: [
      "هذه مرحلة أولى بتغطية محدودة للبطولات التي يوفرها OpenLigaDB فقط.",
      "المصدر مجتمعي وقد يتأخر تحديثه؛ لا تُعد البيانات بثاً مباشراً مضموناً.",
      "لا توجد ساعة لعب مباشرة مؤكدة في هذا الموصل.",
      "الإحصاءات التكتيكية والاستحواذ والتسديدات وخرائط الحرارة غير متاحة ما لم يوفرها مصدر موثوق إضافي."
    ]
  };
}
async function getFeed(env) {
  const cache = caches.default;
  const cached = await cache.match(CACHE_KEY);
  if (cached) return cached.json();
  const data = await loadOpenLigaDB(env);
  await cache.put(CACHE_KEY, new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=90" }
  }));
  return data;
}
async function refreshFeed(env) {
  const data = await loadOpenLigaDB(env);
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
        service: "SPORT 365 Football Intelligence",
        status: "ok",
        source: "OpenLigaDB",
        sourceConfigured: true,
        sourceType: "community",
        competitions: (env.OPENLIGADB_LEAGUES || DEFAULT_LEAGUES.join(",")).split(",").map(x => x.trim()),
        liveClockAvailable: false
      }, 200, headers);
    }
    try {
      if (path === "/api/matches") return json(await getFeed(env), 200, headers);
      if (path === "/api/analysis") {
        const data = await getFeed(env);
        const match = data.matches.find(m => m.statusConfidence === "source_confirmed") || data.matches[0] || null;
        return json({
          ok: data.ok && Boolean(match),
          source: data.source,
          reason: !data.ok ? data.reason : (match ? null : "لا توجد مباراة متاحة ضمن البطولات التي يغطيها المصدر"),
          match,
          summary: match
            ? "القراءة مبنية على بيانات المباراة والأحداث المسجلة من المصدر فقط؛ لا تتوفر في هذا الموصل إحصاءات تكتيكية كافية."
            : null,
          limitations: data.limitations
        }, 200, headers);
      }
      return json({ error: "not_found" }, 404, headers);
    } catch (error) {
      return json({ error: "upstream_unavailable", message: error.message, dataTrusted: false }, 502, headers);
    }
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(refreshFeed(env));
  }
};
