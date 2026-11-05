# SPORT 365 Cloudflare Worker API

This Worker exposes the read-only API consumed by the SPORT 365 website.

## Deploy
1. In Cloudflare, create a Worker named `sport365-api`.
2. Connect this repository and set the deploy root to `sport365-worker`, or deploy this folder with Wrangler.
3. Set `SPORTS_FEED_URL` as a Worker variable to an HTTPS JSON endpoint you are authorized to use.
4. If needed, set `SPORTS_FEED_TOKEN` as a Secret. Never put credentials in the website.
5. Set `ALLOWED_ORIGIN` to `https://sloom86ss.github.io`.
6. Set the website meta tag `sport365-api` to the deployed Worker URL.

## Feed contract
The configured endpoint must return JSON:
```json
{
  "updatedAt": "2026-11-06T12:00:00Z",
  "matches": [
    {
      "id": "match-123",
      "league": "اسم البطولة",
      "home": "الفريق الأول",
      "away": "الفريق الثاني",
      "status": "مباشر",
      "minute": 42,
      "homeScore": 1,
      "awayScore": 0,
      "events": [
        { "minute": 21, "type": "هدف", "player": "اسم اللاعب" }
      ]
    }
  ]
}
```

The Worker validates the shape and returns an explicit unavailable status if no feed is configured. It does not scrape websites, invent matches, or manufacture statistics. Responses are briefly cached at the edge (15 seconds).
