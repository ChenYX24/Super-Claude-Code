import { NextRequest, NextResponse } from "next/server";
import { readSettings, getEnvironmentInfo } from "@/lib/settings-reader";
import fs from "fs";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";

export function GET() {
  const settings = readSettings();
  const environment = getEnvironmentInfo(settings.merged);

  return NextResponse.json({
    ...settings,
    environment,
  });
}

export async function PUT(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();

    // Only allow safe fields to be edited
    const ALLOWED_FIELDS = ["defaultModel", "theme", "autoUpdate", "alwaysThinkingEnabled"];

    // Read current settings.json
    const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
    let current: Record<string, unknown> = {};

    try {
      if (fs.existsSync(settingsPath)) {
        const raw = fs.readFileSync(settingsPath, "utf-8");
        current = JSON.parse(raw);
      }
    } catch (err) {
      console.error("Failed to read existing settings:", err);
    }

    // Merge only allowed fields
    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        current[field] = body[field];
      }
    }

    // Write atomically (tmp file + rename for safety)
    const tmpPath = settingsPath + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(current, null, 2), "utf-8");
    fs.renameSync(tmpPath, settingsPath);

    // Return updated settings
    const updatedSettings = readSettings();
    const environment = getEnvironmentInfo(updatedSettings.merged);

    return NextResponse.json({
      success: true,
      ...updatedSettings,
      environment,
    });
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
