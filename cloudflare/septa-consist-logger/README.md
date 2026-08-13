# SEPTA Consist Logger

Polls SEPTA's public `TrainView` API once a minute, logs train number, line,
source, destination, and car consist for every Regional Rail trip running
that day, and serves a small browser UI to look up a trip's consist history
or find every train a given car number has run in.

## Data model

- `trips` — one row per (service_date, trainno) run. Reused train numbers
  later in the day (gap > 3h since last seen) start a new trip row.
- `observations` — append-only; a new row is only written when the consist
  for a trip actually changes, so storage stays small.

## Local setup

```bash
npm install
wrangler login
wrangler d1 create septa-consists
```

Copy the `database_id` from the create command's output into
`wrangler.toml`, then run the migration:

```bash
npm run db:migrate:local   # for `wrangler dev`
npm run db:migrate:remote  # for the deployed Worker
```

## Dev / deploy

```bash
npm run dev       # local dev server (cron trigger won't fire automatically;
                   # trigger a poll manually — see below)
npm run deploy     # deploy Worker + cron trigger to Cloudflare
```

To trigger a poll manually while testing locally, add a temporary debug
route, or use `wrangler dev --test-scheduled` and hit
`http://localhost:8787/__scheduled` per Wrangler's docs.

## API

- `GET /api/trips?date=YYYY-MM-DD` — all trips for a service date
- `GET /api/trains/:trainno?date=YYYY-MM-DD` — one trip + its full consist
  change history
- `GET /api/cars/:carno` — every trip a given car number has appeared in
