/**
 * API endpoint to start the auto-sync service
 * This should be called once when the app starts
 */

import { autoSyncService } from "@/lib/auto-sync-service";

// Start the service immediately when this module is imported
if (typeof window === "undefined") {
  // Only run on server side
  autoSyncService.start().catch((error) => {
    console.error("Failed to start auto-sync service:", error);
  });
}

export async function GET() {
  return Response.json({ status: "Auto-sync service is running" });
}
