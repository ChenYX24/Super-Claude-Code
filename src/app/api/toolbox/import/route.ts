import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");

export const dynamic = "force-dynamic";

interface BundleItem {
  type: "skill" | "agent" | "rule";
  name: string;
  group?: string;
  content: string;
}

interface ImportBundle {
  version: string;
  exported_at?: string;
  items: BundleItem[];
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

function validateName(name: string): boolean {
  return !name.includes("/") && !name.includes("\\") && !name.includes("..");
}

function validatePath(filePath: string, baseDir: string): boolean {
  const normalized = path.normalize(filePath);
  return normalized.startsWith(path.normalize(baseDir));
}

function importSkill(item: BundleItem, overwrite: boolean): string | null {
  if (!validateName(item.name)) return `Invalid skill name: "${item.name}"`;

  const skillDir = path.join(CLAUDE_DIR, "skills", item.name);
  const skillPath = path.join(skillDir, "SKILL.md");

  if (!validatePath(skillPath, path.join(CLAUDE_DIR, "skills"))) {
    return `Invalid path for skill: "${item.name}"`;
  }

  if (fs.existsSync(skillPath) && !overwrite) {
    return null; // skip, not an error
  }

  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(skillPath, item.content, "utf-8");
  return null;
}

function importAgent(item: BundleItem, overwrite: boolean): string | null {
  if (!validateName(item.name)) return `Invalid agent name: "${item.name}"`;

  const agentsDir = path.join(CLAUDE_DIR, "agents");
  const agentPath = path.join(agentsDir, `${item.name}.md`);

  if (!validatePath(agentPath, agentsDir)) {
    return `Invalid path for agent: "${item.name}"`;
  }

  if (fs.existsSync(agentPath) && !overwrite) {
    return null; // skip
  }

  fs.mkdirSync(agentsDir, { recursive: true });
  fs.writeFileSync(agentPath, item.content, "utf-8");
  return null;
}

function importRule(item: BundleItem, overwrite: boolean): string | null {
  const group = item.group || "imported";
  if (!validateName(item.name)) return `Invalid rule name: "${item.name}"`;
  if (group.includes("..") || group.includes("/") || group.includes("\\")) {
    return `Invalid rule group: "${group}"`;
  }

  const groupDir = path.join(CLAUDE_DIR, "rules", group);
  const rulePath = path.join(groupDir, `${item.name}.md`);

  if (!validatePath(rulePath, path.join(CLAUDE_DIR, "rules"))) {
    return `Invalid path for rule: "${item.name}"`;
  }

  if (fs.existsSync(rulePath) && !overwrite) {
    return null; // skip
  }

  fs.mkdirSync(groupDir, { recursive: true });
  fs.writeFileSync(rulePath, item.content, "utf-8");
  return null;
}

function validateBundle(data: unknown): data is ImportBundle {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.version !== "string") return false;
  if (!Array.isArray(obj.items)) return false;
  for (const item of obj.items) {
    if (!item || typeof item !== "object") return false;
    const i = item as Record<string, unknown>;
    if (!["skill", "agent", "rule"].includes(i.type as string)) return false;
    if (typeof i.name !== "string" || !i.name) return false;
    if (typeof i.content !== "string") return false;
  }
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let bundle: ImportBundle;

    if (contentType.includes("application/json")) {
      const body = await req.json();
      // Support both { bundle: {...} } and direct bundle format
      const candidate = body.bundle || body;

      if (!validateBundle(candidate)) {
        return NextResponse.json(
          { error: "Invalid bundle format. Expected { version, items: [...] }" },
          { status: 400 }
        );
      }
      bundle = candidate;
    } else {
      return NextResponse.json(
        { error: "Unsupported content type. Use application/json." },
        { status: 400 }
      );
    }

    const overwrite = req.nextUrl.searchParams.get("overwrite") === "true";
    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    for (const item of bundle.items) {
      let error: string | null = null;

      switch (item.type) {
        case "skill":
          error = importSkill(item, overwrite);
          break;
        case "agent":
          error = importAgent(item, overwrite);
          break;
        case "rule":
          error = importRule(item, overwrite);
          break;
        default:
          error = `Unknown item type: "${(item as BundleItem).type}"`;
      }

      if (error) {
        result.errors.push(error);
      } else if (
        !overwrite &&
        itemExists(item)
      ) {
        result.skipped += 1;
      } else {
        result.imported += 1;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Failed to import bundle" },
      { status: 500 }
    );
  }
}

function itemExists(item: BundleItem): boolean {
  switch (item.type) {
    case "skill":
      return fs.existsSync(path.join(CLAUDE_DIR, "skills", item.name, "SKILL.md"));
    case "agent":
      return fs.existsSync(path.join(CLAUDE_DIR, "agents", `${item.name}.md`));
    case "rule": {
      const group = item.group || "imported";
      return fs.existsSync(path.join(CLAUDE_DIR, "rules", group, `${item.name}.md`));
    }
    default:
      return false;
  }
}

// GET - Import from URL
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json(
      { error: "Missing required parameter: url" },
      { status: 400 }
    );
  }

  try {
    new URL(url); // validate URL format
  } catch {
    return NextResponse.json(
      { error: "Invalid URL format" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.status} ${response.statusText}` },
        { status: 502 }
      );
    }

    const data = await response.json();

    if (!validateBundle(data)) {
      return NextResponse.json(
        { error: "URL did not return a valid bundle format" },
        { status: 422 }
      );
    }

    return NextResponse.json({ bundle: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch bundle from URL: ${message}` },
      { status: 502 }
    );
  }
}
