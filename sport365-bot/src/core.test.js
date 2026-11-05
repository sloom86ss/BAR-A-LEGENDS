import test from "node:test";
import assert from "node:assert/strict";
import { validateFeed } from "./feed.js";
import { buildAnalysis, analyzeMatch } from "./analyzer.js";

test("rejects invalid feed envelope", () => {
  const result = validateFeed({ matches: "not-an-array" });
  assert.equal(result.ok, false);
  assert.equal(result.matches.length, 0);
});

test("marks old source data as stale instead of fresh", () => {
  const result = validateFeed({
    updatedAt: "2020-01-01T00:00:00.000Z",
    matches: [{ id: "1", home: "A", away: "B", homeScore: 2, awayScore: 0 }]
  });
  assert.equal(result.sourceFreshness, "stale");
  assert.equal(result.matches[0].homeScore, 2);
});

test("drops invalid minute and score values", () => {
  const result = validateFeed({
    updatedAt: new Date().toISOString(),
    matches: [{ id: "2", home: "A", away: "B", minute: 999, homeScore: -1, awayScore: 1 }]
  });
  assert.equal(result.matches[0].minute, null);
  assert.equal(result.matches[0].homeScore, null);
  assert.equal(result.matches[0].awayScore, 1);
});

test("analysis distinguishes source facts from missing tactical metrics", () => {
  const result = buildAnalysis({
    id: "3", home: "A", away: "B", homeScore: 1, awayScore: 0,
    status: "انتهت", statusConfidence: "source_confirmed", events: [], source: "Test"
  });
  assert.equal(result.ok, true);
  assert.equal(result.facts[0].value, "1 - 0");
  assert.ok(result.unavailableMetrics.includes("الاستحواذ"));
  assert.match(analyzeMatch({ home: "A", away: "B", events: [] }), /لا تتوفر/);
});
