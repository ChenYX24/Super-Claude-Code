import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const AGENTS_DIR = path.join(CLAUDE_DIR, "agents");

interface AgentRequestBody {
  name?: string;
  content?: string;
}

// Validate path is under ~/.claude/agents/ (prevent path traversal)
function validateAgentPath(filePath: string): boolean {
  const normalized = path.normalize(filePath);
  const agentsDir = path.normalize(AGENTS_DIR);
  return normalized.startsWith(agentsDir);
}

// POST - Create new agent
export async function POST(req: NextRequest) {
  try {
    const body: AgentRequestBody = await req.json();
    const { name, content } = body;

    if (!name || content === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: name, content" },
        { status: 400 }
      );
    }

    // Validate name (no path separators)
    if (name.includes("/") || name.includes("\\") || name.includes("..")) {
      return NextResponse.json(
        { error: "Invalid agent name. Use simple names without path separators." },
        { status: 400 }
      );
    }

    const agentPath = path.join(AGENTS_DIR, `${name}.md`);

    // Validate path
    if (!validateAgentPath(agentPath)) {
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 400 }
      );
    }

    // Check if agent already exists
    if (fs.existsSync(agentPath)) {
      return NextResponse.json(
        { error: `Agent "${name}" already exists` },
        { status: 409 }
      );
    }

    // Create agents directory if needed
    if (!fs.existsSync(AGENTS_DIR)) {
      fs.mkdirSync(AGENTS_DIR, { recursive: true });
    }

    // Write agent file
    fs.writeFileSync(agentPath, content, "utf-8");

    return NextResponse.json({
      success: true,
      message: `Agent "${name}" created successfully`,
      path: agentPath
    });
  } catch (error) {
    console.error("Error creating agent:", error);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}

// PUT - Update existing agent
export async function PUT(req: NextRequest) {
  try {
    const body: AgentRequestBody = await req.json();
    const { name, content } = body;

    if (!name || content === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: name, content" },
        { status: 400 }
      );
    }

    const agentPath = path.join(AGENTS_DIR, `${name}.md`);

    // Validate path
    if (!validateAgentPath(agentPath)) {
      return NextResponse.json(
        { error: "Invalid path - must be under ~/.claude/agents/" },
        { status: 400 }
      );
    }

    // Check if file exists
    if (!fs.existsSync(agentPath)) {
      return NextResponse.json(
        { error: `Agent "${name}" not found` },
        { status: 404 }
      );
    }

    // Update file content
    fs.writeFileSync(agentPath, content, "utf-8");

    return NextResponse.json({
      success: true,
      message: "Agent updated successfully"
    });
  } catch (error) {
    console.error("Error updating agent:", error);
    return NextResponse.json(
      { error: "Failed to update agent" },
      { status: 500 }
    );
  }
}

// DELETE - Remove agent
export async function DELETE(req: NextRequest) {
  try {
    const body: AgentRequestBody = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }

    const agentPath = path.join(AGENTS_DIR, `${name}.md`);

    // Validate path
    if (!validateAgentPath(agentPath)) {
      return NextResponse.json(
        { error: "Invalid path - must be under ~/.claude/agents/" },
        { status: 400 }
      );
    }

    // Check if file exists
    if (!fs.existsSync(agentPath)) {
      return NextResponse.json(
        { error: `Agent "${name}" not found` },
        { status: 404 }
      );
    }

    // Delete file
    fs.unlinkSync(agentPath);

    return NextResponse.json({
      success: true,
      message: "Agent deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting agent:", error);
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 }
    );
  }
}
