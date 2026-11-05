/**
 * Rule-based Arabic match commentary.
 * It deliberately describes only supplied, verified feed events.
 * It does not invent xG, possession, lineups, injuries or predictions.
 */
export function analyzeMatch(match) {
  const events = Array.isArray(match.events) ? match.events : [];
  const recent = events.slice(-5);
  const lines = recent.map((event) => {
    const minute = event.minute != null ? `${event.minute}′` : "وقت غير محدد";
    const who = event.player ? ` — ${event.player}` : "";
    const detail = event.detail ? ` (${event.detail})` : "";
    return `• ${minute}: ${event.type || "حدث"}${who}${detail}`;
  });
  const score = `${match.homeScore ?? "—"} - ${match.awayScore ?? "—"}`;
  const state = match.status || "الحالة غير محددة";
  return [
    `تحليل ${match.home || "الفريق الأول"} ضد ${match.away || "الفريق الثاني"}`,
    `النتيجة: ${score} | الحالة: ${state}${match.minute != null ? ` | الدقيقة: ${match.minute}` : ""}`,
    lines.length ? "آخر الأحداث المسجلة:\n" + lines.join("\n") : "لا توجد أحداث مسجلة في المصدر حتى الآن.",
    "",
    "هذه قراءة وصفية للأحداث الواردة من مصدر البيانات، وليست توقعاً أو إحصائية غير موثقة."
  ].join("\n");
}

export function formatMatches(matches) {
  if (!matches.length) return "لا توجد مباريات واردة من مصدر البيانات حالياً.";
  return matches.slice(0, 15).map((m, i) =>
    `${i + 1}) ${m.home || "؟"} ${m.homeScore ?? "—"} - ${m.awayScore ?? "—"} ${m.away || "؟"}\n   ${m.league || "بطولة غير محددة"} | ${m.status || "الحالة غير محددة"}${m.minute != null ? ` | ${m.minute}′` : ""}`
  ).join("\n");
}
