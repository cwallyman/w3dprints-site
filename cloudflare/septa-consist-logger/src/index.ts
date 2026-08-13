import { fetchTrainView, serviceDateFor } from "./septa";
import { ingestTrainView, type TripRow } from "./db";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

async function handleTrips(env: Env, url: URL): Promise<Response> {
  const date = url.searchParams.get("date") ?? serviceDateFor(new Date());
  const { results } = await env.DB.prepare(
    `SELECT * FROM trips WHERE service_date = ? ORDER BY trainno`
  )
    .bind(date)
    .all<TripRow>();
  return json({ date, trips: results ?? [] });
}

async function handleTrain(env: Env, trainno: string, url: URL): Promise<Response> {
  const date = url.searchParams.get("date") ?? serviceDateFor(new Date());
  const trip = await env.DB.prepare(
    `SELECT * FROM trips WHERE service_date = ? AND trainno = ? ORDER BY first_seen_at DESC LIMIT 1`
  )
    .bind(date, trainno)
    .first<TripRow>();

  if (!trip) {
    return json({ error: "not found" }, { status: 404 });
  }

  const { results: observations } = await env.DB.prepare(
    `SELECT consist, observed_at FROM observations WHERE trip_id = ? ORDER BY observed_at ASC`
  )
    .bind(trip.id)
    .all();

  return json({ trip, observations: observations ?? [] });
}

async function handleCar(env: Env, carno: string): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT t.service_date, t.trainno, t.line, t.source, t.dest, o.consist, o.observed_at
     FROM observations o
     JOIN trips t ON t.id = o.trip_id
     WHERE (',' || o.consist || ',') LIKE ('%,' || ? || ',%')
     ORDER BY o.observed_at DESC
     LIMIT 200`
  )
    .bind(carno)
    .all();
  return json({ carno, sightings: results ?? [] });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/trips") {
      return handleTrips(env, url);
    }
    const trainMatch = url.pathname.match(/^\/api\/trains\/([^/]+)$/);
    if (trainMatch) {
      return handleTrain(env, decodeURIComponent(trainMatch[1]), url);
    }
    const carMatch = url.pathname.match(/^\/api\/cars\/([^/]+)$/);
    if (carMatch) {
      return handleCar(env, decodeURIComponent(carMatch[1]));
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        const now = new Date();
        const nowIso = now.toISOString();
        const serviceDate = serviceDateFor(now);
        try {
          const entries = await fetchTrainView();
          const summary = await ingestTrainView(env.DB, entries, serviceDate, nowIso);
          console.log(
            `[poll ${nowIso}] seen=${summary.seen} new=${summary.newTrips} changed=${summary.consistChanges} touched=${summary.touched} skipped=${summary.skipped}`
          );
        } catch (err) {
          console.error("poll failed", err);
        }
      })()
    );
  },
};
