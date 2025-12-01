import { NextResponse } from "next/server";

// GET config settings
export async function GET() {
  return NextResponse.json({
    demoMode: process.env.DEMO_MODE === "true",
  });
}
