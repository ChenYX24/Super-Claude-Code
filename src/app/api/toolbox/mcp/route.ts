import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const SETTINGS_FILE = path.join(CLAUDE_DIR, "settings.json");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

interface RequestBody {
  scope: "global" | string; // "global" or project name
  name: string;
  config?: MCPServerConfig;
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
    return { mcpServers: {} };
  }
  const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
  return JSON.parse(raw);
}

// Helper: write settings.json
function writeSettings(settings: any): void {
  atomicWrite(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// Helper: read project .mcp.json
function readProjectMCP(projectName: string): any {
  const mcpFile = path.join(PROJECTS_DIR, projectName, ".mcp.json");
  if (!fs.existsSync(mcpFile)) {
    return { mcpServers: {} };
  }
  const raw = fs.readFileSync(mcpFile, "utf-8");
  return JSON.parse(raw);
}

// Helper: write project .mcp.json
function writeProjectMCP(projectName: string, config: any): void {
  const mcpFile = path.join(PROJECTS_DIR, projectName, ".mcp.json");
  const projectDir = path.join(PROJECTS_DIR, projectName);

  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  atomicWrite(mcpFile, JSON.stringify(config, null, 2));
}

// POST - Add new server
export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { scope, name, config } = body;

    if (!name || !config || !config.command) {
      return NextResponse.json(
        { error: "Missing required fields: name, config.command" },
        { status: 400 }
      );
    }

    // Validate server name (alphanumeric + hyphens/underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return NextResponse.json(
        { error: "Invalid server name. Use alphanumeric characters, hyphens, and underscores only." },
        { status: 400 }
      );
    }

    if (scope === "global") {
      const settings = readSettings();
      if (!settings.mcpServers) {
        settings.mcpServers = {};
      }

      if (settings.mcpServers[name]) {
        return NextResponse.json(
          { error: `Server "${name}" already exists in global scope` },
          { status: 409 }
        );
      }

      settings.mcpServers[name] = config;
      writeSettings(settings);
    } else {
      // Project scope
      const mcpConfig = readProjectMCP(scope);
      if (!mcpConfig.mcpServers) {
        mcpConfig.mcpServers = {};
      }

      if (mcpConfig.mcpServers[name]) {
        return NextResponse.json(
          { error: `Server "${name}" already exists in project "${scope}"` },
          { status: 409 }
        );
      }

      mcpConfig.mcpServers[name] = config;
      writeProjectMCP(scope, mcpConfig);
    }

    return NextResponse.json({ success: true, message: `Server "${name}" added successfully` });
  } catch (error) {
    console.error("Error adding MCP server:", error);
    return NextResponse.json(
      { error: "Failed to add server" },
      { status: 500 }
    );
  }
}

// PUT - Update existing server
export async function PUT(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { scope, name, config } = body;

    if (!name || !config || !config.command) {
      return NextResponse.json(
        { error: "Missing required fields: name, config.command" },
        { status: 400 }
      );
    }

    if (scope === "global") {
      const settings = readSettings();
      if (!settings.mcpServers || !settings.mcpServers[name]) {
        return NextResponse.json(
          { error: `Server "${name}" not found in global scope` },
          { status: 404 }
        );
      }

      settings.mcpServers[name] = config;
      writeSettings(settings);
    } else {
      // Project scope
      const mcpConfig = readProjectMCP(scope);
      if (!mcpConfig.mcpServers || !mcpConfig.mcpServers[name]) {
        return NextResponse.json(
          { error: `Server "${name}" not found in project "${scope}"` },
          { status: 404 }
        );
      }

      mcpConfig.mcpServers[name] = config;
      writeProjectMCP(scope, mcpConfig);
    }

    return NextResponse.json({ success: true, message: `Server "${name}" updated successfully` });
  } catch (error) {
    console.error("Error updating MCP server:", error);
    return NextResponse.json(
      { error: "Failed to update server" },
      { status: 500 }
    );
  }
}

// DELETE - Remove server
export async function DELETE(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { scope, name } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }

    if (scope === "global") {
      const settings = readSettings();
      if (!settings.mcpServers || !settings.mcpServers[name]) {
        return NextResponse.json(
          { error: `Server "${name}" not found in global scope` },
          { status: 404 }
        );
      }

      delete settings.mcpServers[name];
      writeSettings(settings);
    } else {
      // Project scope
      const mcpConfig = readProjectMCP(scope);
      if (!mcpConfig.mcpServers || !mcpConfig.mcpServers[name]) {
        return NextResponse.json(
          { error: `Server "${name}" not found in project "${scope}"` },
          { status: 404 }
        );
      }

      delete mcpConfig.mcpServers[name];
      writeProjectMCP(scope, mcpConfig);
    }

    return NextResponse.json({ success: true, message: `Server "${name}" deleted successfully` });
  } catch (error) {
    console.error("Error deleting MCP server:", error);
    return NextResponse.json(
      { error: "Failed to delete server" },
      { status: 500 }
    );
  }
}
