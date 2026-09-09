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
    //
    // Deliberately does not exit: Next registers its own SIGTERM/SIGINT
    // cleanup before instrumentation runs, which closes the server, drains
    // in-flight requests and then exits with the signal-based code (143/130).
    // Calling process.exit() here would run first and cut that short, killing
    // in-flight requests and reporting exit 0 on every container stop.
    // stop() is fully synchronous (it only clears timers), so it completes
    // inline and Next's cleanup takes over from here.
    const shutdown = (signal: NodeJS.Signals) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`Received ${signal}, shutting down auto-sync service...`);
      autoSyncService.stop();
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
