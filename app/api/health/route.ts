import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { user } from "@/lib/db/schema";
import { getCurrentVersion } from "@/lib/version";

export const dynamic = "force-dynamic";

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
  try {
    // better-sqlite3 executes synchronously, so this either resolves or
    // throws before control returns to the event loop — no timeout needed.
    await db.select({ count: sql<number>`count(*)` }).from(user).limit(1);

    health.checks.database.status = "ok";
  } catch (error) {
    health.status = "unhealthy";
    health.checks.database.status = "error";

    // Log the actual error for debugging
    console.error(
      "[Health] Database check failed:",
      error instanceof Error ? error.message : String(error)
    );

    // Provide generic message to client
    health.checks.database.message = "Database unavailable";
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
