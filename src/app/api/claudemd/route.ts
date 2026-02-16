/**
 * API route to list CLAUDE.md files and create new ones
 * GET /api/claudemd - List all CLAUDE.md files + project options
 * POST /api/claudemd - Create CLAUDE.md for a project
 */

import { NextRequest, NextResponse } from "next/server";
import { listClaudeMdFiles, listProjectOptions, createClaudeMd, createClaudeMdAtPath } from "@/lib/claudemd";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const files = listClaudeMdFiles();
    const projects = listProjectOptions();
    return NextResponse.json({ files, projects });
  } catch (error) {
    console.error("Failed to list CLAUDE.md files:", error);
    return NextResponse.json(
      { error: "Failed to list CLAUDE.md files" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectEncoded, customPath } = body;

    if (!projectEncoded && !customPath) {
      return NextResponse.json(
        { error: "Missing projectEncoded or customPath" },
        { status: 400 }
      );
    }

    const result = customPath
      ? createClaudeMdAtPath(customPath)
      : createClaudeMd(projectEncoded);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to create", path: result.path },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, path: result.path });
  } catch (error) {
    console.error("Failed to create CLAUDE.md:", error);
    return NextResponse.json(
      { error: "Failed to create CLAUDE.md" },
      { status: 500 }
    );
  }
}
