/**
 * CLAUDE.md File Management
 */

import fs from "fs";
import path from "path";
import os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

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

// ---- Public Functions ----

export function listClaudeMdFiles(): ClaudeMdFile[] {
  const files: ClaudeMdFile[] = [];

  // 1. 全局 CLAUDE.md
  const globalPath = path.join(CLAUDE_DIR, "CLAUDE.md");
  if (fs.existsSync(globalPath)) {
    files.push({ path: globalPath, label: "Global", scope: "global" });
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
          }
        } catch {
          // skip invalid paths
        }
      }
    } catch {
      // skip
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
    fs.writeFileSync(filePath, content, "utf-8");
    return true;
  } catch {
    return false;
  }
}
