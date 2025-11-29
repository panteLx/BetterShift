import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const versionFilePath = path.join(process.cwd(), "public", "version.json");

    // Check if version file exists
    if (!fs.existsSync(versionFilePath)) {
      return NextResponse.json(
        {
          version: "dev-local",
          branch: "unknown",
          commitHash: "unknown",
          buildDate: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    const versionData = fs.readFileSync(versionFilePath, "utf-8");
    const version = JSON.parse(versionData);

    return NextResponse.json(version, {
      headers: {
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error("Error reading version info:", error);
    return NextResponse.json(
      {
        version: "dev-local",
        branch: "unknown",
        commitHash: "unknown",
        buildDate: new Date().toISOString(),
      },
      { status: 200 }
    );
  }
}
