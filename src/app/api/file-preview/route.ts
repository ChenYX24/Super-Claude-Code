import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Allowed extensions for preview (security: no binaries)
const ALLOWED_EXT = new Set([
  ".md", ".txt", ".json", ".ts", ".tsx", ".js", ".jsx",
  ".py", ".yaml", ".yml", ".toml", ".css", ".html", ".xml",
  ".sh", ".bash", ".zsh", ".env.example", ".gitignore",
  ".csv", ".sql", ".rs", ".go", ".java", ".c", ".cpp", ".h",
]);

const MAX_SIZE = 512 * 1024; // 512KB max

export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  // Security: normalize and check extension
  const normalized = path.normalize(filePath);
  const ext = path.extname(normalized).toLowerCase();

  if (!ALLOWED_EXT.has(ext) && !normalized.endsWith(".env.example") && !normalized.endsWith(".gitignore")) {
    return NextResponse.json({ error: `File type ${ext} not supported for preview` }, { status: 400 });
  }

  try {
    if (!fs.existsSync(normalized)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const stat = fs.statSync(normalized);
    if (stat.size > MAX_SIZE) {
      return NextResponse.json({
        error: "File too large for preview",
        size: stat.size,
        maxSize: MAX_SIZE,
      }, { status: 413 });
    }

    const content = fs.readFileSync(normalized, "utf-8");
    const fileName = path.basename(normalized);

    return NextResponse.json({
      path: normalized,
      fileName,
      ext,
      content,
      size: stat.size,
      lastModified: stat.mtimeMs,
    });
  } catch {
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
