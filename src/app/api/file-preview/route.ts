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

// Sensitive file basenames that must never be served
const SENSITIVE_BASENAMES = new Set([
  ".env", ".env.local", ".env.production", ".env.development",
  "credentials.json", "secrets.json", "service-account.json",
  "id_rsa", "id_ed25519", "id_ecdsa", "id_dsa",
  "shadow", "passwd", "master.key",
  ".npmrc", ".pypirc", ".netrc", ".pgpass",
]);

// Sensitive path segments (case-insensitive check)
const SENSITIVE_PATH_SEGMENTS = [
  ".ssh", ".gnupg", ".aws", ".azure", ".gcloud",
];

/**
 * Validate that the resolved path is safe to serve:
 *  1. No path traversal (must not contain '..' after resolution)
 *  2. Not a sensitive file
 *  3. Not inside a sensitive directory
 */
function validatePath(filePath: string): { ok: true; resolved: string } | { ok: false; reason: string } {
  // Resolve to absolute path to canonicalize any '..' or '.' segments
  const resolved = path.resolve(filePath);

  // Block explicit '..' in the original input (defense in depth)
  if (filePath.includes("..")) {
    return { ok: false, reason: "Path traversal is not allowed" };
  }

  // Block sensitive filenames
  const basename = path.basename(resolved).toLowerCase();
  if (SENSITIVE_BASENAMES.has(basename)) {
    return { ok: false, reason: "Access to this file is not allowed" };
  }

  // Block sensitive directory segments anywhere in the path
  const lowerResolved = resolved.toLowerCase().replace(/\\/g, "/");
  for (const segment of SENSITIVE_PATH_SEGMENTS) {
    if (lowerResolved.includes(`/${segment}/`) || lowerResolved.endsWith(`/${segment}`)) {
      return { ok: false, reason: "Access to this directory is not allowed" };
    }
  }

  // Block paths under system-sensitive locations (Unix)
  const systemPaths = ["/etc/shadow", "/etc/passwd", "/proc/", "/sys/"];
  for (const sp of systemPaths) {
    if (lowerResolved.startsWith(sp)) {
      return { ok: false, reason: "Access to system files is not allowed" };
    }
  }

  return { ok: true, resolved };
}

export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  // Security: validate path against traversal and sensitive-file rules
  const validation = validatePath(filePath);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 403 });
  }
  const normalized = validation.resolved;

  // Security: check extension
  const ext = path.extname(normalized).toLowerCase();

  if (!ALLOWED_EXT.has(ext) && !normalized.endsWith(".env.example") && !normalized.endsWith(".gitignore")) {
    return NextResponse.json({ error: `File type ${ext} not supported for preview` }, { status: 400 });
  }

  try {
    if (!fs.existsSync(normalized)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Ensure we're reading a regular file (not a symlink to a sensitive target, directory, etc.)
    const stat = fs.lstatSync(normalized);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Path is not a regular file" }, { status: 400 });
    }

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
