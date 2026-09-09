/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts
 */

let shuttingDown = false;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Import and start the auto-sync service. Wrapped so a startup failure
    // (bad version lookup, sync scheduler error) logs instead of taking the
    // whole server down.
    const { autoSyncService } = await import("@/lib/auto-sync-service");
    try {
      // Preload version during startup to avoid blocking on first request
      const { initializeVersion } = await import("@/lib/version");
      await initializeVersion();

      await autoSyncService.start();
    } catch (error) {
      console.error("[Instrumentation] Startup task failed:", error);
    }

    // Register shutdown handlers regardless of whether start() above
    // succeeded — stop() is safe to call even if the service never started.
    // dumb-init (PID 1 in the container) forwards signals to this process,
    // so SIGTERM/SIGINT are reliably delivered here.
    const shutdown = (signal: NodeJS.Signals) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`Received ${signal}, shutting down...`);
      autoSyncService.stop();
      process.exit(0);
    };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);

    // Warn about missing/insecure auth configuration. This must never throw
    // or exit the process: register() also runs on every server start of a
    // deployed image, and a hard failure here would break self-hosted
    // deployments. It is a startup warning, not a gate — validation that
    // could reach `next build` must not live here.
    try {
      const { validateAuthEnv } = await import("@/lib/auth/env");
      const { valid, errors } = validateAuthEnv();
      if (!valid) {
        for (const error of errors) {
          console.error(`[Startup Config Warning] ${error}`);
        }
      }
    } catch (error) {
      console.error("[Instrumentation] Auth config validation failed:", error);
    }
  }
}
