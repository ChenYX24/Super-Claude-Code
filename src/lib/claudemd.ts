/**
 * CLAUDE.md File Management
 */

import fs from "fs";
import path from "path";
import os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");
const REGISTRY_FILE = path.join(CLAUDE_DIR, "claudemd-registry.json");

// ---- Types ----

export interface ClaudeMdFile {
  path: string;          // 文件完整路径
  label: string;         // 显示名（如 "Global" 或项目名）
  scope: "global" | "project";
}

// ---- Helpers ----

/** Sanitize strings to remove broken Unicode surrogates */
function sanitize(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\uD800-\uDFFF]/g, "\uFFFD");
}

/**
 * 解码项目路径（从 ~/.claude/projects/ 目录名还原真实路径）
 * 例如: "E--" -> "E:/" 或 "home-user-dev" -> "/home/user/dev"
 */
function decodeProjectPath(encoded: string): string {
  // Windows: "E--" -> "E:/"
  if (/^[A-Z]--$/.test(encoded)) {
    return encoded.substring(0, 1) + ":/";
  }
  // Unix-like: "home-user-dev" -> "/home/user/dev"
  return "/" + encoded.replace(/-/g, "/");
}

// ---- Registry (tracks custom-created CLAUDE.md files) ----

function readRegistry(): string[] {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      return JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8"));
    }
  } catch { /* skip */ }
  return [];
}

function writeRegistry(paths: string[]): void {
  try {
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(paths, null, 2), "utf-8");
  } catch { /* skip */ }
}

function addToRegistry(filePath: string): void {
  const registry = readRegistry();
  if (!registry.includes(filePath)) {
    registry.push(filePath);
    writeRegistry(registry);
  }
}

function removeFromRegistry(filePath: string): void {
  const registry = readRegistry();
  const filtered = registry.filter((p) => p !== filePath);
  if (filtered.length !== registry.length) {
    writeRegistry(filtered);
  }
}

// ---- Public Functions ----

export function listClaudeMdFiles(): ClaudeMdFile[] {
  const files: ClaudeMdFile[] = [];
  const seenPaths = new Set<string>();

  // 1. 全局 CLAUDE.md
  const globalPath = path.join(CLAUDE_DIR, "CLAUDE.md");
  if (fs.existsSync(globalPath)) {
    files.push({ path: globalPath, label: "Global", scope: "global" });
    seenPaths.add(globalPath);
  }

  // 2. 项目级 CLAUDE.md
  if (fs.existsSync(PROJECTS_DIR)) {
    try {
      for (const projectDir of fs.readdirSync(PROJECTS_DIR)) {
        const projectPath = path.join(PROJECTS_DIR, projectDir);
        try {
          if (!fs.statSync(projectPath).isDirectory()) continue;
        } catch {
          continue;
        }

        // 方式1: ~/.claude/projects/{encoded-path}/CLAUDE.md
        const projectClaudemd = path.join(projectPath, "CLAUDE.md");
        if (fs.existsSync(projectClaudemd)) {
          const decoded = decodeProjectPath(projectDir);
          files.push({
            path: projectClaudemd,
            label: `Project: ${decoded}`,
            scope: "project",
          });
          seenPaths.add(projectClaudemd);
          continue;
        }

        // 方式2: 实际项目目录下的 CLAUDE.md
        const realProjectPath = decodeProjectPath(projectDir);
        try {
          const realClaudemd = path.join(realProjectPath, "CLAUDE.md");
          if (fs.existsSync(realClaudemd)) {
            files.push({
              path: realClaudemd,
              label: `Project: ${realProjectPath}`,
              scope: "project",
            });
            seenPaths.add(realClaudemd);
          }
        } catch {
          // skip invalid paths
        }
      }
    } catch {
      // skip
    }
  }

  // 3. Custom-registered CLAUDE.md files
  const registry = readRegistry();
  for (const regPath of registry) {
    if (!seenPaths.has(regPath) && fs.existsSync(regPath)) {
      const dirName = path.basename(path.dirname(regPath));
      files.push({
        path: regPath,
        label: `Custom: ${dirName}`,
        scope: "project",
      });
      seenPaths.add(regPath);
    }
  }

  return files;
}

export function readClaudeMdContent(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return sanitize(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

export function writeClaudeMdContent(filePath: string, content: string): boolean {
  // 安全检查：只允许写入 CLAUDE.md 文件
  if (!filePath.endsWith("CLAUDE.md")) return false;

  try {
    // 确保目录存在
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, "utf-8");
    return true;
  } catch {
    return false;
  }
}

/**
 * 列出所有已知项目（有 session 数据但可能没有 CLAUDE.md）
 */
export interface ProjectOption {
  encoded: string;   // 编码路径（目录名）
  decoded: string;   // 解码后的路径
  hasClaudeMd: boolean;
  claudeMdPath: string; // CLAUDE.md 将会/已经在的路径
}

export function listProjectOptions(): ProjectOption[] {
  if (!fs.existsSync(PROJECTS_DIR)) return [];

  const options: ProjectOption[] = [];

  // 全局
  const globalPath = path.join(CLAUDE_DIR, "CLAUDE.md");
  options.push({
    encoded: "__global__",
    decoded: "Global (~/.claude/)",
    hasClaudeMd: fs.existsSync(globalPath),
    claudeMdPath: globalPath,
  });

  try {
    for (const projectDir of fs.readdirSync(PROJECTS_DIR)) {
      const projectPath = path.join(PROJECTS_DIR, projectDir);
      try {
        if (!fs.statSync(projectPath).isDirectory()) continue;
      } catch { continue; }

      const decoded = decodeProjectPath(projectDir);
      const claudeMdInProject = path.join(projectPath, "CLAUDE.md");
      const realClaudeMd = path.join(decoded, "CLAUDE.md");

      // 检查两个可能位置
      const hasInProjectDir = fs.existsSync(claudeMdInProject);
      let hasInRealDir = false;
      try { hasInRealDir = fs.existsSync(realClaudeMd); } catch { /* skip */ }

      options.push({
        encoded: projectDir,
        decoded,
        hasClaudeMd: hasInProjectDir || hasInRealDir,
        claudeMdPath: hasInRealDir ? realClaudeMd : claudeMdInProject,
      });
    }
  } catch { /* skip */ }

  return options;
}

/**
 * 为项目创建 CLAUDE.md（在实际项目目录或 ~/.claude/projects/{project}/ 下）
 */
export function createClaudeMd(projectEncoded: string): { success: boolean; path: string; error?: string } {
  if (projectEncoded === "__global__") {
    const globalPath = path.join(CLAUDE_DIR, "CLAUDE.md");
    if (fs.existsSync(globalPath)) {
      return { success: false, path: globalPath, error: "Global CLAUDE.md already exists" };
    }
    const ok = writeClaudeMdContent(globalPath, "# Global Instructions\n\n");
    return { success: ok, path: globalPath };
  }

  const decoded = decodeProjectPath(projectEncoded);
  const realClaudeMd = path.join(decoded, "CLAUDE.md");
  const projectClaudeMd = path.join(PROJECTS_DIR, projectEncoded, "CLAUDE.md");

  // 优先在实际项目目录创建
  let targetPath = projectClaudeMd;
  try {
    if (fs.existsSync(decoded) && fs.statSync(decoded).isDirectory()) {
      targetPath = realClaudeMd;
    }
  } catch { /* fallback to project dir */ }

  if (fs.existsSync(targetPath)) {
    return { success: false, path: targetPath, error: "CLAUDE.md already exists" };
  }

  const template = `# ${decoded}\n\n## Project Instructions\n\n`;
  const ok = writeClaudeMdContent(targetPath, template);
  return { success: ok, path: targetPath };
}

/**
 * 删除 CLAUDE.md 文件
 */
export function deleteClaudeMdFile(filePath: string): { success: boolean; error?: string } {
  if (!filePath.endsWith("CLAUDE.md")) {
    return { success: false, error: "Can only delete CLAUDE.md files" };
  }
  if (!fs.existsSync(filePath)) {
    return { success: false, error: "File does not exist" };
  }
  try {
    fs.unlinkSync(filePath);
    removeFromRegistry(filePath);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete file" };
  }
}

/**
 * 注册一个已存在的 CLAUDE.md 文件到 registry
 */
export function registerClaudeMdFile(filePath: string): { success: boolean; error?: string } {
  if (!filePath.endsWith("CLAUDE.md")) {
    return { success: false, error: "Can only register CLAUDE.md files" };
  }
  if (!fs.existsSync(filePath)) {
    return { success: false, error: "File does not exist" };
  }
  addToRegistry(filePath);
  return { success: true };
}

/**
 * 在任意路径下创建 CLAUDE.md
 */
export function createClaudeMdAtPath(dirPath: string): { success: boolean; path: string; error?: string } {
  const targetPath = path.join(dirPath, "CLAUDE.md");

  if (fs.existsSync(targetPath)) {
    return { success: false, path: targetPath, error: "CLAUDE.md already exists at this path" };
  }

  // Verify directory exists
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    return { success: false, path: targetPath, error: "Directory does not exist" };
  }

  const dirName = path.basename(dirPath) || dirPath;
  const template = `# ${dirName}\n\n## Project Instructions\n\n`;
  const ok = writeClaudeMdContent(targetPath, template);
  if (ok) {
    addToRegistry(targetPath);
  }
  return { success: ok, path: targetPath };
}
