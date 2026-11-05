/**
 * Conservative Arabic football analysis.
 * Only source-provided facts are described. Tactical claims require real stats.
 */
const safe = value => typeof value === "string" && value.trim() ? value.trim() : "غير متاح";
const isGoal = event => /هدف|goal/i.test(event.type || "");
const isCard = event => /بطاق|card/i.test(event.type || "");
const eventLine = event => {
  const minute = event.minute == null ? "وقت غير محدد" : `${event.minute}′`;
  const team = event.team === "home" ? "صاحب الأرض" : event.team === "away" ? "الضيف" : "الفريق غير محدد";
  return `• ${minute} — ${event.type} — ${team}${event.player ? " — " + event.player : ""}${event.detail ? " (" + event.detail + ")" : ""}`;
};

export function analyzeMatch(match) {
  if (!match) return "لا توجد مباراة متاحة للتحليل من مصدر موثوق حالياً.";
  const events = Array.isArray(match.events) ? match.events : [];
  const goals = events.filter(isGoal);
  const cards = events.filter(isCard);
  const homeScore = Number.isInteger(match.homeScore) ? match.homeScore : null;
  const awayScore = Number.isInteger(match.awayScore) ? match.awayScore : null;
  const score = homeScore == null || awayScore == null ? "النتيجة غير متاحة" : `${homeScore} - ${awayScore}`;
  const latest = events.slice().sort((a, b) => (a.minute ?? -1) - (b.minute ?? -1)).slice(-8);
  const lines = [
    `المباراة: ${safe(match.home)} ضد ${safe(match.away)}`,
    `البطولة: ${safe(match.league)}`,
    `النتيجة المسجلة: ${score}`,
    `الحالة: ${safe(match.status)}`,
    `الأهداف المسجلة في سجل الأحداث: ${goals.length}`,
    `البطاقات المسجلة في سجل الأحداث: ${cards.length}`,
    "",
    latest.length ? "آخر الأحداث المسجلة:" : "لا توجد أحداث مسجلة في المصدر حتى الآن.",
    ...latest.map(eventLine),
    "",
    "حدود التحليل:",
    "لا تتوفر في البيانات الحالية إحصاءات كافية للحكم على الاستحواذ أو الضغط أو جودة الفرص أو التفوق التكتيكي.",
    "لا يصدر هذا المحرك توقع فوز أو نتيجة من دون نموذج مدرّب وبيانات تاريخية قابلة للتحقق.",
    `مصدر السجل: ${safe(match.source)} | تحديث المصدر: ${safe(match.sourceUpdatedAt)}`
  ];
  return lines.join("\n");
}

export function buildAnalysis(match) {
  if (!match) return { ok: false, reason: "لا توجد مباراة للتحليل", facts: [], interpretation: null, confidence: "none" };
  const events = Array.isArray(match.events) ? match.events : [];
  const goals = events.filter(isGoal);
  const cards = events.filter(isCard);
  const scoreAvailable = Number.isInteger(match.homeScore) && Number.isInteger(match.awayScore);
  const facts = [
    { label: "النتيجة", value: scoreAvailable ? `${match.homeScore} - ${match.awayScore}` : "غير متاحة", source: match.source || "غير محدد" },
    { label: "الأهداف المسجلة", value: goals.length, source: "سجل أحداث المصدر" },
    { label: "البطاقات المسجلة", value: cards.length, source: "سجل أحداث المصدر" },
    { label: "حالة المباراة", value: match.status || "غير محددة", confidence: match.statusConfidence || "unknown" }
  ];
  return {
    ok: true, matchId: match.id, facts,
    interpretation: "الوصف يقتصر على الوقائع الواردة. التحليل التكتيكي المتقدم غير متاح حتى ورود بيانات موثوقة عن التسديدات والتمريرات والاستحواذ والتمركز.",
    confidence: scoreAvailable ? "source_dependent" : "limited",
    unavailableMetrics: ["الاستحواذ", "التسديدات", "الأهداف المتوقعة", "الضغط", "التمريرات", "التشكيل التكتيكي"]
  };
}

export function formatMatches(matches) {
  if (!Array.isArray(matches) || !matches.length) return "لا توجد مباريات واردة من مصدر البيانات حالياً.";
  return matches.slice(0, 15).map((m, i) =>
    `${i + 1}) ${m.home || "؟"} ${m.homeScore ?? "—"} - ${m.awayScore ?? "—"} ${m.away || "؟"}\n   ${m.league || "بطولة غير محددة"} | ${m.status || "الحالة غير محددة"}${m.minute != null ? ` | ${m.minute}′` : ""}`
  ).join("\n");
}
