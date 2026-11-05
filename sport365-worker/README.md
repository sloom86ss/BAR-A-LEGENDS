# SPORT 365 Data Bot

A Cloudflare Worker that collects football fixtures, results and goal events from OpenLigaDB and serves them to the SPORT 365 website.

## Current source and coverage

- Primary source: [OpenLigaDB](https://www.openligadb.de/) public JSON API.
- No API key or paid subscription is required for public reads.
- Default competitions: `bl1,bl2,bl3,dfb` (German Bundesliga, 2. Bundesliga, 3. Liga and DFB-Pokal).
- This is a limited starter feed, not worldwide coverage. OpenLigaDB is community maintained and may update late.
- The source does not provide a reliable live match clock through this adapter. The bot deliberately leaves `minute` null and labels any in-progress state inferred from kickoff time as estimated.

## Deploy

1. In Cloudflare, create or open the Worker named `sport365-api`.
2. Connect this repository and set the deploy root to `sport365-worker`, or deploy this folder with Wrangler.
3. Deploy. No secret or API key is needed for the OpenLigaDB starter source.
4. Keep `ALLOWED_ORIGIN` set to `https://sloom86ss.github.io`.
5. After deployment, test `/health`, then `/api/matches`.
6. Set the deployed Worker URL in the `sport365-api` meta tag in `sport365/index.html`.

## Scheduled collection

The Worker runs every two minutes using a Cron Trigger and refreshes its edge cache. Website requests use the cached feed to avoid repeatedly querying the upstream source.

## Configuration

- `OPENLIGADB_LEAGUES`: comma-separated competition shortcuts. Default: `bl1,bl2,bl3,dfb`.
- `OPENLIGADB_SEASON`: optional season start year. If omitted, the year is inferred (German season convention: July onward).
- `ALLOWED_ORIGIN`: allowed website origin.

## API

- `GET /health`
- `GET /api/matches`
- `GET /api/analysis`

Normalized match records include teams, league, kickoff, score, goals/events, venue when supplied, source, source update time, and a confidence label for status.

## Data integrity

- No synthetic matches, goals, scores, match minutes, possession, xG or tactical statistics.
- Finished state is accepted only when the upstream source marks the match finished.
- A not-finished match whose kickoff was within the last three hours is labelled as time-inferred, not source-confirmed live.
- Source limitations and upstream errors are returned in the API payload.
