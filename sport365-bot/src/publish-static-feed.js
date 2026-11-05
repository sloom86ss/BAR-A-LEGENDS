import { mkdir, writeFile } from "node:fs/promises";

const API = "https://api.openligadb.de";
const leagues = (process.env.OPENLIGADB_LEAGUES || "bl1,bl2,bl3,dfb")
  .split(",").map(x => x.trim()).filter(Boolean).slice(0, 20);
const now = new Date();

async function getJson(path) {
  const response = await fetch(API + path, {
    headers: { accept: "application/json", "user-agent": "SPORT365-Football-Intelligence/1.0" },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`OpenLigaDB HTTP ${response.status}`);
  return response.json();
}
function seasonForNow(date) {
  return date.getUTCMonth() < 6 ? date.getUTCFullYear() - 1 : date.getUTCFullYear();
}
function normalize(match) {
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
  const goals = Array.isArray(match.goals) ? match.goals : [];
  let home = 0, away = 0;
  const events = goals.map(goal => {
    const nextHome = Number(goal.scoreTeam1);
    const nextAway = Number(goal.scoreTeam2);
    let team = null;
    if (Number.isFinite(nextHome) && Number.isFinite(nextAway)) {
      if (nextHome > home && nextAway === away) team = "home";
      else if (nextAway > away && nextHome === home) team = "away";
      home = nextHome;
      away = nextAway;
    }
    const minute = Number(goal.matchMinute);
    return {
      type: "هدف",
      minute: Number.isFinite(minute) && minute >= 0 && minute <= 130 ? minute : null,
      player: goal.goalGetterName || null,
      team,
      detail: [goal.isPenalty ? "ركلة جزاء" : "", goal.isOwnGoal ? "هدف عكسي" : ""].filter(Boolean).join("، ") || null,
      confidence: "source_recorded"
    };
  });
  let homeScore = null, awayScore = null;
  if (goals.length) {
    const last = goals[goals.length - 1];
    if (Number.isFinite(Number(last.scoreTeam1)) && Number.isFinite(Number(last.scoreTeam2))) {
      homeScore = Number(last.scoreTeam1); awayScore = Number(last.scoreTeam2);
    }
  }
  if (homeScore === null) {
    const results = Array.isArray(match.matchResults) ? match.matchResults : [];
    const result = results.find(x => Number(x.resultTypeID) === 2) || results[results.length - 1];
    if (result) {
      const h = Number(result.pointsTeam1), a = Number(result.pointsTeam2);
      homeScore = Number.isFinite(h) ? h : null;
      awayScore = Number.isFinite(a) ? a : null;
    }
  }
  return {
    id: String(match.matchID),
    league: match.leagueName || match.leagueShortcut || "بطولة غير محددة",
    home: match.team1?.teamName || "الفريق المضيف",
    away: match.team2?.teamName || "الفريق الضيف",
    status, statusConfidence, minute: null, kickoff,
    homeScore, awayScore, finished, events,
    source: "OpenLigaDB",
    sourceUpdatedAt: match.lastUpdateDateTime || null,
    recordUpdatedAt: now.toISOString()
  };
}

const outcomes = await Promise.all(leagues.map(async shortcut => {
  try {
    const group = await getJson(`/getcurrentgroup/${encodeURIComponent(shortcut)}`);
    if (!group || !Number.isFinite(Number(group.groupOrderID))) {
      return { league: shortcut, matches: [], error: "لا توجد جولة حالية معلنة" };
    }
    const rows = await getJson(`/getmatchdata/${encodeURIComponent(shortcut)}/${seasonForNow(now)}/${Number(group.groupOrderID)}`);
    if (!Array.isArray(rows)) throw new Error("صيغة قائمة المباريات غير متوقعة");
    return { league: shortcut, matches: rows, error: null };
  } catch (error) {
    return { league: shortcut, matches: [], error: error.message };
  }
}));
const successful = outcomes.filter(x => !x.error).length;
const matches = [...new Map(outcomes.flatMap(x => x.matches).filter(x => x?.matchID != null)
  .map(x => [String(x.matchID), normalize(x)])).values()]
  .sort((a, b) => String(a.kickoff || "").localeCompare(String(b.kickoff || "")));
const sourceTimes = matches.map(x => Date.parse(x.sourceUpdatedAt || "")).filter(Number.isFinite);
const updatedAt = sourceTimes.length ? new Date(Math.max(...sourceTimes)).toISOString() : null;
const age = updatedAt ? Math.max(0, now.getTime() - Date.parse(updatedAt)) : null;
const data = {
  ok: successful > 0,
  source: "OpenLigaDB",
  sourceType: "community",
  coverage: leagues,
  updatedAt,
  retrievedAt: now.toISOString(),
  sourceFreshness: age == null ? "unknown" : age <= 180000 ? "fresh" : age <= 600000 ? "aging" : "stale",
  ageSeconds: age == null ? null : Math.floor(age / 1000),
  matches,
  reason: successful ? null : "تعذر الوصول إلى مصدر OpenLigaDB لجميع البطولات المحددة",
  warnings: outcomes.filter(x => x.error).map(x => ({ league: x.league, message: x.error })),
  limitations: [
    "تغطية أولية محدودة ببطولات OpenLigaDB المحددة فقط.",
    "المصدر مجتمعي وقد يتأخر؛ لا يمثل بثاً مباشراً مضموناً.",
    "دقيقة اللعب المباشرة غير متاحة في هذا الموصل.",
    "لا تتوفر إحصاءات تكتيكية أو استحواذ أو تسديدات في هذا الموصل."
  ]
};
await mkdir("sport365/data", { recursive: true });
await writeFile("sport365/data/matches.json", JSON.stringify(data, null, 2) + "\n");
console.log(`Feed built: ${matches.length} matches; successful competitions: ${successful}/${leagues.length}; freshness: ${data.sourceFreshness}`);
if (!successful) process.exitCode = 1;
