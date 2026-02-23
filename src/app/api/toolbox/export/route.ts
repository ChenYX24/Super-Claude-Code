import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");

export const dynamic = "force-dynamic";

interface ExportRequest {
  types: ("skills" | "agents" | "rules")[];
  items: string[]; // item names to export
}

interface BundleItem {
  type: "skill" | "agent" | "rule";
  name: string;
  group?: string; // for rules
  content: string;
}

interface ExportBundle {
  version: "1.0";
  exported_at: string;
  items: BundleItem[];
}

function validatePath(filePath: string, baseDir: string): boolean {
  const normalized = path.normalize(filePath);
  return normalized.startsWith(path.normalize(baseDir));
}

function readSkill(name: string): BundleItem | null {
  const skillPath = path.join(CLAUDE_DIR, "skills", name, "SKILL.md");
  if (!validatePath(skillPath, path.join(CLAUDE_DIR, "skills"))) return null;
  if (!fs.existsSync(skillPath)) return null;
  return {
    type: "skill",
    name,
    content: fs.readFileSync(skillPath, "utf-8"),
  };
}

function readAgent(name: string): BundleItem | null {
  const agentPath = path.join(CLAUDE_DIR, "agents", `${name}.md`);
  if (!validatePath(agentPath, path.join(CLAUDE_DIR, "agents"))) return null;
  if (!fs.existsSync(agentPath)) return null;
  return {
    type: "agent",
    name,
    content: fs.readFileSync(agentPath, "utf-8"),
  };
}

function readRule(identifier: string): BundleItem | null {
  // identifier format: "group/name" (without .md extension)
  const parts = identifier.split("/");
  if (parts.length !== 2) return null;
  const [group, name] = parts;

  if (group.includes("..") || name.includes("..")) return null;

  const rulePath = path.join(CLAUDE_DIR, "rules", group, `${name}.md`);
  if (!validatePath(rulePath, path.join(CLAUDE_DIR, "rules"))) return null;
  if (!fs.existsSync(rulePath)) return null;
  return {
    type: "rule",
    name,
    group,
    content: fs.readFileSync(rulePath, "utf-8"),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: ExportRequest = await req.json();
    const { types, items } = body;

    if (!types || !Array.isArray(types) || types.length === 0) {
      return NextResponse.json(
        { error: "Missing required field: types (array of 'skills', 'agents', 'rules')" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required field: items (array of item identifiers)" },
        { status: 400 }
      );
    }

    const bundleItems: BundleItem[] = [];
    const errors: string[] = [];

    for (const item of items) {
      // item format: "type:identifier" e.g. "skill:my-skill", "agent:planner", "rule:common/git-workflow"
      const colonIdx = item.indexOf(":");
      if (colonIdx === -1) {
        errors.push(`Invalid item format: "${item}" (expected "type:name")`);
        continue;
      }

      const itemType = item.slice(0, colonIdx);
      const itemName = item.slice(colonIdx + 1);

      if (!itemName || itemName.includes("..")) {
        errors.push(`Invalid item name: "${itemName}"`);
        continue;
      }

      let bundleItem: BundleItem | null = null;

      switch (itemType) {
        case "skill":
          if (types.includes("skills")) bundleItem = readSkill(itemName);
          break;
        case "agent":
          if (types.includes("agents")) bundleItem = readAgent(itemName);
          break;
        case "rule":
          if (types.includes("rules")) bundleItem = readRule(itemName);
          break;
        default:
          errors.push(`Unknown item type: "${itemType}"`);
      }

      if (bundleItem) {
        bundleItems.push(bundleItem);
      } else if (!errors.some((e) => e.includes(itemName))) {
        errors.push(`Not found: ${item}`);
      }
    }

    const bundle: ExportBundle = {
      version: "1.0",
      exported_at: new Date().toISOString(),
      items: bundleItems,
    };

    return NextResponse.json({ bundle, errors });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export items" },
      { status: 500 }
    );
  }
}
