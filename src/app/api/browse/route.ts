/**
 * API route to browse directories for CLAUDE.md creation
 * GET /api/browse?path=xxx - List subdirectories of a path
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";

// Only allow browsing certain root paths for safety
const ALLOWED_ROOTS = [
  os.homedir(),
  "C:\\",
  "D:\\",
  "E:\\",
  "F:\\",
  "/home",
  "/Users",
  "/mnt",
  "/opt",
];

function isPathAllowed(targetPath: string): boolean {
  const normalized = path.resolve(targetPath);
  return ALLOWED_ROOTS.some((root) => normalized.startsWith(path.resolve(root)));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dirPath = searchParams.get("path") || os.homedir();

    const resolved = path.resolve(dirPath);
    if (!isPathAllowed(resolved)) {
      return NextResponse.json(
        { error: "Path not allowed" },
        { status: 403 }
      );
    }

    if (!fs.existsSync(resolved)) {
      return NextResponse.json(
        { error: "Path does not exist" },
        { status: 404 }
      );
    }

    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return NextResponse.json(
        { error: "Not a directory" },
        { status: 400 }
      );
    }

    const entries: { name: string; path: string; isDir: boolean; hasClaudeMd: boolean }[] = [];

    const items = fs.readdirSync(resolved);
    for (const item of items) {
      // Skip hidden dirs and node_modules
      if (item.startsWith(".") || item === "node_modules" || item === "__pycache__") continue;

      const fullPath = path.join(resolved, item);
      try {
        const itemStat = fs.statSync(fullPath);
        if (itemStat.isDirectory()) {
          const hasClaudeMd = fs.existsSync(path.join(fullPath, "CLAUDE.md"));
          entries.push({
            name: item,
            path: fullPath,
            isDir: true,
            hasClaudeMd,
          });
        }
      } catch { /* skip permission errors */ }
    }

    // Sort: dirs with CLAUDE.md first, then alphabetical
    entries.sort((a, b) => {
      if (a.hasClaudeMd !== b.hasClaudeMd) return a.hasClaudeMd ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const parentDir = path.dirname(resolved);
    const hasClaudeMd = fs.existsSync(path.join(resolved, "CLAUDE.md"));

    return NextResponse.json({
      current: resolved,
      parent: parentDir !== resolved ? parentDir : null,
      hasClaudeMd,
      entries,
    });
  } catch (error) {
    console.error("Browse error:", error);
    return NextResponse.json(
      { error: "Failed to browse directory" },
      { status: 500 }
    );
  }
}
