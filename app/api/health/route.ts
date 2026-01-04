import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { user } from "@/lib/db/schema";
import { getCurrentVersion } from "@/lib/version";

export const dynamic = "force-dynamic";

const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds for health endpoint

interface HealthStatus {
  status: "healthy" | "unhealthy";
  timestamp: string;
  version: string;
  checks: {
    database: {
      status: "ok" | "error";
      message?: string;
    };
    server: {
      status: "ok";
      uptime: number;
    };
  };
}

export async function GET() {
  const startTime = Date.now();
  const health: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: await getCurrentVersion(),
    checks: {
      database: {
        status: "ok",
      },
      server: {
        status: "ok",
        uptime: process.uptime(),
      },
    },
  };

  // Check database connection and schema
  let timeoutId: NodeJS.Timeout | null = null;
  try {
    // Create a timeout promise that rejects after HEALTH_CHECK_TIMEOUT
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Database health check timeout"));
      }, HEALTH_CHECK_TIMEOUT);
    });

    // Create the database query promise
    const dbPromise = db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .limit(1);

    // Race the query against the timeout
    await Promise.race([dbPromise, timeoutPromise]);

    // Query succeeded before timeout
    if (timeoutId) clearTimeout(timeoutId);
    health.checks.database.status = "ok";
  } catch (error) {
    // Clear timeout if it exists
    if (timeoutId) clearTimeout(timeoutId);

    health.status = "unhealthy";
    health.checks.database.status = "error";

    // Log the actual error for debugging
    console.error(
      "[Health] Database check failed:",
      error instanceof Error ? error.message : String(error)
    );

    // Provide generic message to client
    if (error instanceof Error && error.message.includes("timeout")) {
      health.checks.database.message = "Database query timeout";
    } else {
      health.checks.database.message = "Database unavailable";
    }
  }

  const responseTime = Date.now() - startTime;
  const status = health.status === "healthy" ? 200 : 503;

  return NextResponse.json(
    {
      ...health,
      responseTime: `${responseTime}ms`,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    }
  );
}
