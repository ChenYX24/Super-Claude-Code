import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const SETTINGS_FILE = path.join(CLAUDE_DIR, "settings.json");

interface HookRequestBody {
  type?: string;
  index?: number;
  matcher?: string;
  command?: string;
  timeout?: number;
  description?: string;
}

// Helper: atomic write (tmp + rename)
function atomicWrite(filePath: string, content: string): void {
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, content, "utf-8");
  fs.renameSync(tmpPath, filePath);
}

// Helper: read settings.json
function readSettings(): any {
  if (!fs.existsSync(SETTINGS_FILE)) {
    return { hooks: {} };
  }
  const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
  return JSON.parse(raw);
}

// Helper: write settings.json
function writeSettings(settings: any): void {
  atomicWrite(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// POST - Add new hook
export async function POST(req: NextRequest) {
  try {
    const body: HookRequestBody = await req.json();
    const { type, matcher, command, timeout, description } = body;

    if (!type || !command) {
      return NextResponse.json(
        { error: "Missing required fields: type, command" },
        { status: 400 }
      );
    }

    const settings = readSettings();
    if (!settings.hooks) {
      settings.hooks = {};
    }
    if (!settings.hooks[type]) {
      settings.hooks[type] = [];
    }

    // Ensure hooks[type] is an array
    if (!Array.isArray(settings.hooks[type])) {
      settings.hooks[type] = [settings.hooks[type]];
    }

    // Create new hook entry in the nested format
    const newHook: any = {
      hooks: [{ type: "command", command }],
    };

    if (matcher) newHook.matcher = matcher;
    if (timeout) newHook.hooks[0].timeout = timeout;
    if (description) newHook.description = description;

    settings.hooks[type].push(newHook);
    writeSettings(settings);

    return NextResponse.json({
      success: true,
      message: `Hook added to ${type} successfully`
    });
  } catch (error) {
    console.error("Error adding hook:", error);
    return NextResponse.json(
      { error: "Failed to add hook" },
      { status: 500 }
    );
  }
}

// PUT - Update existing hook
export async function PUT(req: NextRequest) {
  try {
    const body: HookRequestBody = await req.json();
    const { type, index, matcher, command, timeout, description } = body;

    if (type === undefined || index === undefined || !command) {
      return NextResponse.json(
        { error: "Missing required fields: type, index, command" },
        { status: 400 }
      );
    }

    const settings = readSettings();
    if (!settings.hooks || !settings.hooks[type] || !Array.isArray(settings.hooks[type])) {
      return NextResponse.json(
        { error: `Hook type "${type}" not found` },
        { status: 404 }
      );
    }

    if (index < 0 || index >= settings.hooks[type].length) {
      return NextResponse.json(
        { error: `Invalid index ${index}` },
        { status: 400 }
      );
    }

    // Update hook entry
    const updatedHook: any = {
      hooks: [{ type: "command", command }],
    };

    if (matcher) updatedHook.matcher = matcher;
    if (timeout) updatedHook.hooks[0].timeout = timeout;
    if (description) updatedHook.description = description;

    settings.hooks[type][index] = updatedHook;
    writeSettings(settings);

    return NextResponse.json({
      success: true,
      message: `Hook updated successfully`
    });
  } catch (error) {
    console.error("Error updating hook:", error);
    return NextResponse.json(
      { error: "Failed to update hook" },
      { status: 500 }
    );
  }
}

// DELETE - Remove hook
export async function DELETE(req: NextRequest) {
  try {
    const body: HookRequestBody = await req.json();
    const { type, index } = body;

    if (type === undefined || index === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: type, index" },
        { status: 400 }
      );
    }

    const settings = readSettings();
    if (!settings.hooks || !settings.hooks[type] || !Array.isArray(settings.hooks[type])) {
      return NextResponse.json(
        { error: `Hook type "${type}" not found` },
        { status: 404 }
      );
    }

    if (index < 0 || index >= settings.hooks[type].length) {
      return NextResponse.json(
        { error: `Invalid index ${index}` },
        { status: 400 }
      );
    }

    // Remove hook at index
    settings.hooks[type].splice(index, 1);

    // Remove type key if array is now empty
    if (settings.hooks[type].length === 0) {
      delete settings.hooks[type];
    }

    writeSettings(settings);

    return NextResponse.json({
      success: true,
      message: `Hook deleted successfully`
    });
  } catch (error) {
    console.error("Error deleting hook:", error);
    return NextResponse.json(
      { error: "Failed to delete hook" },
      { status: 500 }
    );
  }
}
