/**
 * POST /api/claudemd/register - Register an existing CLAUDE.md file
 */

import { NextRequest, NextResponse } from "next/server";
import { registerClaudeMdFile } from "@/lib/claudemd";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path: filePath } = body;

    if (!filePath) {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }

    const result = registerClaudeMdFile(filePath);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to register CLAUDE.md:", error);
    return NextResponse.json({ error: "Failed to register" }, { status: 500 });
  }
}
