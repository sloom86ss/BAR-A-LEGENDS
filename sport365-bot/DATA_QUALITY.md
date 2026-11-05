# SPORT 365 — data quality and architecture policy

## Mission
A football-only data collection and analysis service. It is not a general sports feed and it is not a copy of Sloom Koura 365.

## Pipeline
1. Source adapters retrieve only data the provider permits us to use.
2. Normalizers map provider payloads to the canonical match/event/statistic model.
3. Validators reject malformed IDs, scores, timestamps, minutes and event shapes.
4. Freshness checks label data as fresh (<=3 min), aging (3–10 min), stale (>10 min), or unknown.
5. Source reconciliation compares independent observations. Conflicts are retained as conflicts; they are not silently guessed away.
6. The analysis engine receives only accepted facts and labels its interpretation separately.
7. The web UI and optional Telegram notifier read the same canonical feed.

## Confidence rules
- source_confirmed: provider explicitly reports the status/event.
- time_based: derived only from a scheduled kickoff; never enough to claim a match is live.
- source_recorded: an event exists in the provider's event log.
- unknown: the provider did not supply a reliable value.
- No score, minute, lineup, assist, injury, xG, possession or tactical metric may be fabricated.
- If providers disagree, expose a conflict and source timestamps. Do not average categorical facts.

## Source requirements
A source may be enabled only after reviewing coverage, update cadence, terms/licensing, attribution rules, rate limits and fields available. No scraping that violates site terms, no circumvention, and no copying paid data without a licence.
OpenLigaDB is currently the initial community-maintained adapter and is not global coverage. It cannot satisfy the full worldwide/Arabic coverage goal alone.

## Analysis stages
- Stage 1: event chronology and score context (available from current adapter).
- Stage 2: statistical analysis when a licensed source supplies shots, possession, passes, cards, lineups and substitutions.
- Stage 3: tactical analysis when event and positional data are sufficiently rich.
- Stage 4: probability forecasts only after historical datasets, validation splits, calibration and backtesting exist. Never present forecasts as certainty.

## Operations and security
- API tokens stay in server-side secrets, never in browser JavaScript or Git.
- Health endpoints report connectivity and source freshness separately.
- Stale feeds remain visibly stale; stale data is not relabelled as current.
- Provider errors are surfaced in warnings and logs without leaking secrets.
- Database migrations are in `sport365-bot/db/`.
