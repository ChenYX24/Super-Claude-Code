/**
 * API route to read and write CLAUDE.md content
 * GET /api/claudemd/content?path=xxx - Read content
 * PUT /api/claudemd/content - Save content
 */

import { NextRequest, NextResponse } from "next/server";
import { readClaudeMdContent, writeClaudeMdContent } from "@/lib/claudemd";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("path");

    if (!filePath) {
      return NextResponse.json(
        { error: "Missing path parameter" },
        { status: 400 }
      );
    }

    const content = readClaudeMdContent(filePath);
    if (content === null) {
      return NextResponse.json(
        { error: "File not found or cannot be read" },
        { status: 404 }
      );
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Failed to read CLAUDE.md content:", error);
    return NextResponse.json(
      { error: "Failed to read CLAUDE.md content" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { path: filePath, content } = body;

    if (!filePath || typeof content !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid path/content" },
        { status: 400 }
      );
    }

    const success = writeClaudeMdContent(filePath, content);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to write file (invalid path or permission denied)" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to write CLAUDE.md content:", error);
    return NextResponse.json(
      { error: "Failed to write CLAUDE.md content" },
      { status: 500 }
    );
  }
}
