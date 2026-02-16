/**
 * API route to list all CLAUDE.md files
 * GET /api/claudemd
 */

import { NextResponse } from "next/server";
import { listClaudeMdFiles } from "@/lib/claudemd";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const files = listClaudeMdFiles();
    return NextResponse.json({ files });
  } catch (error) {
    console.error("Failed to list CLAUDE.md files:", error);
    return NextResponse.json(
      { error: "Failed to list CLAUDE.md files" },
      { status: 500 }
    );
  }
}
