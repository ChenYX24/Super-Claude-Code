import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const RULES_DIR = path.join(CLAUDE_DIR, "rules");

interface RuleRequestBody {
  group?: string;
  name?: string;
  content?: string;
  path?: string;
}

// Validate path is under ~/.claude/rules/ (prevent path traversal)
function validateRulePath(filePath: string): boolean {
  const normalized = path.normalize(filePath);
  const rulesDir = path.normalize(RULES_DIR);
  return normalized.startsWith(rulesDir);
}

// POST - Create new rule
export async function POST(req: NextRequest) {
  try {
    const body: RuleRequestBody = await req.json();
    const { group, name, content } = body;

    if (!group || !name || content === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: group, name, content" },
        { status: 400 }
      );
    }

    // Validate name (no path separators)
    if (name.includes("/") || name.includes("\\") || name.includes("..")) {
      return NextResponse.json(
        { error: "Invalid rule name. Use simple names without path separators." },
        { status: 400 }
      );
    }

    // Validate group (no path traversal)
    if (group.includes("..") || group.includes("\\")) {
      return NextResponse.json(
        { error: "Invalid group name" },
        { status: 400 }
      );
    }

    const groupDir = path.join(RULES_DIR, group);
    const rulePath = path.join(groupDir, `${name}.md`);

    // Validate path
    if (!validateRulePath(rulePath)) {
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 400 }
      );
    }

    // Check if rule already exists
    if (fs.existsSync(rulePath)) {
      return NextResponse.json(
        { error: `Rule "${name}" already exists in group "${group}"` },
        { status: 409 }
      );
    }

    // Create group directory if needed
    if (!fs.existsSync(groupDir)) {
      fs.mkdirSync(groupDir, { recursive: true });
    }

    // Write rule file
    fs.writeFileSync(rulePath, content, "utf-8");

    return NextResponse.json({
      success: true,
      message: `Rule "${name}" created successfully in group "${group}"`,
      path: rulePath
    });
  } catch (error) {
    console.error("Error creating rule:", error);
    return NextResponse.json(
      { error: "Failed to create rule" },
      { status: 500 }
    );
  }
}

// PUT - Update existing rule
export async function PUT(req: NextRequest) {
  try {
    const body: RuleRequestBody = await req.json();
    const { path: filePath, content } = body;

    if (!filePath || content === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: path, content" },
        { status: 400 }
      );
    }

    // Validate path
    if (!validateRulePath(filePath)) {
      return NextResponse.json(
        { error: "Invalid path - must be under ~/.claude/rules/" },
        { status: 400 }
      );
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: `Rule not found at path: ${filePath}` },
        { status: 404 }
      );
    }

    // Update file content
    fs.writeFileSync(filePath, content, "utf-8");

    return NextResponse.json({
      success: true,
      message: "Rule updated successfully"
    });
  } catch (error) {
    console.error("Error updating rule:", error);
    return NextResponse.json(
      { error: "Failed to update rule" },
      { status: 500 }
    );
  }
}

// DELETE - Remove rule
export async function DELETE(req: NextRequest) {
  try {
    const body: RuleRequestBody = await req.json();
    const { path: filePath } = body;

    if (!filePath) {
      return NextResponse.json(
        { error: "Missing required field: path" },
        { status: 400 }
      );
    }

    // Validate path
    if (!validateRulePath(filePath)) {
      return NextResponse.json(
        { error: "Invalid path - must be under ~/.claude/rules/" },
        { status: 400 }
      );
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: `Rule not found at path: ${filePath}` },
        { status: 404 }
      );
    }

    // Delete file
    fs.unlinkSync(filePath);

    return NextResponse.json({
      success: true,
      message: "Rule deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting rule:", error);
    return NextResponse.json(
      { error: "Failed to delete rule" },
      { status: 500 }
    );
  }
}
