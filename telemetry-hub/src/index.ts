import { buildAggregate, storeAggregate } from "./aggregate";
import { parseV1 } from "./schemas/v1";
import { storeInD1 } from "./targets/d1";

// The key must match the `binding` of the [[d1_databases]] block in wrangler.toml.
interface Env {
  bettershift_telemetry: D1Database;
}

const MAX_BODY_BYTES = 16 * 1024;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response(null, { status: 405 });
    }

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

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        try {
          await storeAggregate(env.bettershift_telemetry, await buildAggregate(env.bettershift_telemetry));
        } catch (error) {
          // The previous aggregate stays in place and keeps being served.
          console.error(error instanceof Error ? error.message : "Aggregate run failed");
        }
      })(),
    );
  },
};
