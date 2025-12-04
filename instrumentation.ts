/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Import and start the auto-sync service
    const { autoSyncService } = await import("@/lib/auto-sync-service");
    await autoSyncService.start();
  }
}
