import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const SKILLS_DIR = path.join(CLAUDE_DIR, "skills");

interface SkillRequestBody {
  name?: string;
  content?: string;
}

// Validate path is under ~/.claude/skills/ (prevent path traversal)
function validateSkillPath(filePath: string): boolean {
  const normalized = path.normalize(filePath);
  const skillsDir = path.normalize(SKILLS_DIR);
  return normalized.startsWith(skillsDir);
}

// POST - Create new skill
export async function POST(req: NextRequest) {
  try {
    const body: SkillRequestBody = await req.json();
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
        { error: "Invalid skill name. Use simple names without path separators." },
        { status: 400 }
      );
    }

    const skillDir = path.join(SKILLS_DIR, name);
    const skillPath = path.join(skillDir, "SKILL.md");

    // Validate path
    if (!validateSkillPath(skillPath)) {
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 400 }
      );
    }

    // Check if skill already exists
    if (fs.existsSync(skillPath)) {
      return NextResponse.json(
        { error: `Skill "${name}" already exists` },
        { status: 409 }
      );
    }

    // Create skill directory
    fs.mkdirSync(skillDir, { recursive: true });

    // Write skill file
    fs.writeFileSync(skillPath, content, "utf-8");

    return NextResponse.json({
      success: true,
      message: `Skill "${name}" created successfully`,
      path: skillPath
    });
  } catch (error) {
    console.error("Error creating skill:", error);
    return NextResponse.json(
      { error: "Failed to create skill" },
      { status: 500 }
    );
  }
}

// PUT - Update existing skill
export async function PUT(req: NextRequest) {
  try {
    const body: SkillRequestBody = await req.json();
    const { name, content } = body;

    if (!name || content === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: name, content" },
        { status: 400 }
      );
    }

    if (name.includes("/") || name.includes("\\") || name.includes("..")) {
      return NextResponse.json(
        { error: "Invalid skill name." },
        { status: 400 }
      );
    }

    const skillDir = path.join(SKILLS_DIR, name);
    const skillPath = path.join(skillDir, "SKILL.md");

    if (!validateSkillPath(skillPath)) {
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 400 }
      );
    }

    if (!fs.existsSync(skillPath)) {
      return NextResponse.json(
        { error: `Skill "${name}" not found` },
        { status: 404 }
      );
    }

    fs.writeFileSync(skillPath, content, "utf-8");

    return NextResponse.json({
      success: true,
      message: `Skill "${name}" updated successfully`,
    });
  } catch (error) {
    console.error("Error updating skill:", error);
    return NextResponse.json(
      { error: "Failed to update skill" },
      { status: 500 }
    );
  }
}

// DELETE - Remove skill
export async function DELETE(req: NextRequest) {
  try {
    const body: SkillRequestBody = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }

    const skillDir = path.join(SKILLS_DIR, name);

    // Validate path
    if (!validateSkillPath(skillDir)) {
      return NextResponse.json(
        { error: "Invalid path - must be under ~/.claude/skills/" },
        { status: 400 }
      );
    }

    // Check if directory exists
    if (!fs.existsSync(skillDir)) {
      return NextResponse.json(
        { error: `Skill "${name}" not found` },
        { status: 404 }
      );
    }

    // Delete directory recursively
    fs.rmSync(skillDir, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      message: "Skill deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting skill:", error);
    return NextResponse.json(
      { error: "Failed to delete skill" },
      { status: 500 }
    );
  }
}
