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
    // Query an actual table to verify schema exists
    await db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .limit(1);
    health.checks.database.status = "ok";
  } catch (error) {
    health.status = "unhealthy";
    health.checks.database.status = "error";
    health.checks.database.message =
      error instanceof Error ? error.message : "Database connection failed";
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
