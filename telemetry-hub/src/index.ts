import { buildAggregate, readAggregate, storeAggregate } from "./aggregate";
import { parseV1 } from "./schemas/v1";
import { storeInD1 } from "./targets/d1";

// The key must match the `binding` of the [[d1_databases]] block in wrangler.toml.
interface Env {
  bettershift_telemetry: D1Database;
}

const MAX_BODY_BYTES = 16 * 1024;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/data.json") {
      if (request.method !== "GET") return new Response(null, { status: 405 });
      const aggregate = await readAggregate(env.bettershift_telemetry);
      return new Response(JSON.stringify(aggregate ?? { computedAt: null }), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=300, s-maxage=900",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (pathname !== "/") return new Response(null, { status: 404 });

    if (request.method === "GET") {
      // Task 5 replaces this with the rendered page.
      return new Response(null, { status: 404 });
    }

    if (request.method !== "POST") return new Response(null, { status: 405 });

    // Content-Length only: a chunked body skips this check, which is acceptable
    // because Workers cap the request size first and parseV1 gates every field.
    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > MAX_BODY_BYTES) {
      return new Response(null, { status: 413 });
    }

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return new Response(null, { status: 400 });
    }

    const payload = parseV1(input);
    // Unknown or retired schema versions are accepted and discarded: the
    // sender is fire-and-forget and must never learn anything but "received".
    if (!payload) {
      return new Response(null, { status: 200 });
    }

    try {
      await storeInD1(payload, env.bettershift_telemetry);
    } catch (error) {
      // The sender still gets a 200. Only the message is logged (never the payload).
      console.error(error instanceof Error ? error.message : "D1 write failed");
    }

    return new Response(null, { status: 200 });
  },

  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    try {
      await storeAggregate(env.bettershift_telemetry, await buildAggregate(env.bettershift_telemetry));
    } catch (error) {
      // db.batch + INSERT OR REPLACE already keep the previous aggregate intact;
      // rethrow so Cloudflare's cron success metric reflects the failure.
      console.error(error instanceof Error ? error.message : "Aggregate run failed");
      throw error;
    }
  },
};
