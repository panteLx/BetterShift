import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { readFile } from "fs/promises";
import { join } from "path";

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

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const health: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "unknown",
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

  // Check version
  try {
    const versionPath = join(process.cwd(), ".version");
    const version = await readFile(versionPath, "utf-8");
    health.version = version.trim();
  } catch (error) {
    // Version file might not exist in dev mode
    health.version = process.env.NODE_ENV === "production" ? "unknown" : "dev";
  }

  // Check database connection
  try {
    db.run(sql`SELECT 1`);
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
