import { parseV1 } from "./schemas/v1";
import { sendToPostHog } from "./targets/posthog";

interface Env {
  POSTHOG_API_KEY: string;
  // Optional ingest host, e.g. https://us.i.posthog.com; defaults to EU.
  POSTHOG_HOST?: string;
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
      await sendToPostHog(payload, env.POSTHOG_API_KEY, env.POSTHOG_HOST || undefined);
    } catch (error) {
      // The sender still gets a 200. Only the message is logged (a status, never the payload).
      console.error(error instanceof Error ? error.message : "PostHog forward failed");
    }

    return new Response(null, { status: 200 });
  },
};
