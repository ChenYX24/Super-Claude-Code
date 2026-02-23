/**
 * Environment variable management API for bot configuration.
 * Reads/writes .env.local in the dashboard root directory.
 *
 * GET /api/env - Read bot-related env vars
 * PUT /api/env - Update bot-related env vars (writes to .env.local)
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Only allow managing these specific env vars (security: no arbitrary env access)
const ALLOWED_KEYS = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_IDS",
  "TELEGRAM_MODE",
  "FEISHU_APP_ID",
  "FEISHU_APP_SECRET",
  "FEISHU_VERIFICATION_TOKEN",
  "FEISHU_ENCRYPT_KEY",
  "FEISHU_ALLOWED_CHATS",
  "SCC_BASE_URL",
];

function getEnvLocalPath(): string {
  return path.join(process.cwd(), ".env.local");
}

function readEnvLocal(): Record<string, string> {
  const envPath = getEnvLocalPath();
  if (!fs.existsSync(envPath)) return {};

  const content = fs.readFileSync(envPath, "utf-8");
  const result: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function writeEnvLocal(vars: Record<string, string>): void {
  const envPath = getEnvLocalPath();
  const existing = readEnvLocal();

  // Merge new vars into existing
  const merged = { ...existing, ...vars };

  // Remove empty values
  for (const [key, val] of Object.entries(merged)) {
    if (val === "") delete merged[key];
  }

  // Generate .env.local content
  const lines = [
    "# Bot configuration (managed by SCC Dashboard)",
    "# Do not edit manually while the dashboard is running.",
    "",
  ];

  for (const [key, value] of Object.entries(merged).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`${key}="${value}"`);
  }

  fs.writeFileSync(envPath, lines.join("\n") + "\n", "utf-8");
}

/** Mask sensitive values */
function maskValue(key: string, value: string): string {
  if (key.includes("SECRET") || key.includes("TOKEN") || key.includes("KEY")) {
    if (value.length <= 8) return "***";
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }
  return value;
}

export async function GET() {
  const envVars = readEnvLocal();
  const processEnv: Record<string, string | undefined> = {};

  // Include both .env.local and process.env values
  const result: Record<string, { value: string; masked: string; source: "env.local" | "process" }> = {};

  for (const key of ALLOWED_KEYS) {
    if (envVars[key]) {
      result[key] = {
        value: envVars[key],
        masked: maskValue(key, envVars[key]),
        source: "env.local",
      };
    } else if (process.env[key]) {
      processEnv[key] = process.env[key];
      result[key] = {
        value: process.env[key]!,
        masked: maskValue(key, process.env[key]!),
        source: "process",
      };
    }
  }

  return NextResponse.json({ vars: result, allowedKeys: ALLOWED_KEYS });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const updates: Record<string, string> = {};

    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_KEYS.includes(key)) {
        return NextResponse.json(
          { error: `Key "${key}" is not allowed` },
          { status: 403 },
        );
      }
      updates[key] = String(value);
    }

    writeEnvLocal(updates);

    return NextResponse.json({
      success: true,
      message: "Environment variables updated. Restart the server to apply changes.",
    });
  } catch (err) {
    console.error("[Env API] Error:", err);
    return NextResponse.json(
      { error: "Failed to update environment variables" },
      { status: 500 },
    );
  }
}
