/**
 * Settings Reader - 读取 Claude Code 和 Codex CLI 配置文件
 */

import fs from "fs";
import path from "path";
import os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const CODEX_DIR = path.join(os.homedir(), ".codex");
const SETTINGS_FILE = path.join(CLAUDE_DIR, "settings.json");
const SETTINGS_LOCAL_FILE = path.join(CLAUDE_DIR, "settings.local.json");
const CODEX_CONFIG_FILE = path.join(CODEX_DIR, "config.toml");

// ---- Types ----

export interface HookConfig {
  command: string;
  description?: string;
}

export interface PermissionConfig {
  allowedTools?: string[];
  deniedTools?: string[];
  autoApprove?: boolean;
}

export interface ClaudeSettings {
  // General
  defaultModel?: string;
  theme?: string;
  autoUpdate?: boolean;
  alwaysThinkingEnabled?: boolean;

  // Permissions
  permissions?: PermissionConfig;

  // Hooks
  preToolUseHook?: HookConfig;
  postToolUseHook?: HookConfig;
  stopHook?: HookConfig;

  // Environment
  apiKey?: string;
  apiKeySource?: string;
  proxyUrl?: string;

  // MCP Servers (for reference)
  mcpServers?: Record<string, unknown>;

  // Other settings
  [key: string]: unknown;
}

export interface CodexProjectConfig {
  path: string;
  trust_level: string;
}

export interface CodexSettings {
  projects: CodexProjectConfig[];
  sandbox?: string;
  [key: string]: unknown;
}

export interface SettingsData {
  global: ClaudeSettings;
  local: ClaudeSettings;
  merged: ClaudeSettings;
  codex: CodexSettings | null;
}

// ---- Helpers ----

function safeReadJSON<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function maskApiKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  if (key.length < 12) return "***";
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

// ---- Minimal TOML Parser ----

/**
 * Minimal TOML parser supporting:
 * - key = "value" (string values)
 * - key = value (unquoted values: numbers, booleans)
 * - [section] and [section.'quoted key']
 * - Comments (#)
 * Does NOT handle arrays, inline tables, multi-line strings, etc.
 */
function parseMinimalToml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentSection = "";

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    // Section header: [section] or [section.'quoted.key']
    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }

    // Key = value
    const kvMatch = line.match(/^([^\s=]+)\s*=\s*(.+)$/);
    if (!kvMatch) continue;

    const key = kvMatch[1].trim();
    let value: string | number | boolean = kvMatch[2].trim();

    // Parse value type
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else if (value === "true") {
      value = true;
    } else if (value === "false") {
      value = false;
    } else if (!isNaN(Number(value))) {
      value = Number(value);
    }

    const fullKey = currentSection ? `${currentSection}.${key}` : key;
    result[fullKey] = value;
  }

  return result;
}

// ---- Codex Settings Reader ----

export function readCodexSettings(): CodexSettings | null {
  if (!fs.existsSync(CODEX_CONFIG_FILE)) return null;

  try {
    const raw = fs.readFileSync(CODEX_CONFIG_FILE, "utf-8");
    const parsed = parseMinimalToml(raw);

    // Extract project configs from [projects.'path'] sections
    const projects: CodexProjectConfig[] = [];
    const otherSettings: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(parsed)) {
      const projectMatch = key.match(/^projects\.'(.+?)'\.(.*)/);
      if (projectMatch) {
        const projectPath = projectMatch[1];
        const field = projectMatch[2];
        let project = projects.find(p => p.path === projectPath);
        if (!project) {
          project = { path: projectPath, trust_level: "default" };
          projects.push(project);
        }
        if (field === "trust_level") {
          project.trust_level = String(value);
        }
      } else if (key.startsWith("windows.")) {
        otherSettings[key] = value;
      } else {
        otherSettings[key] = value;
      }
    }

    return { projects, ...otherSettings };
  } catch {
    return null;
  }
}

// ---- Main Reader ----

export function readSettings(): SettingsData {
  const global = safeReadJSON<ClaudeSettings>(SETTINGS_FILE, {});
  const local = safeReadJSON<ClaudeSettings>(SETTINGS_LOCAL_FILE, {});

  // Merge settings (local overrides global)
  const merged: ClaudeSettings = {
    ...global,
    ...local,
    permissions: {
      ...global.permissions,
      ...local.permissions,
    },
  };

  // Mask API keys in the response
  const maskedGlobal = { ...global };
  const maskedLocal = { ...local };
  const maskedMerged = { ...merged };

  if (maskedGlobal.apiKey) maskedGlobal.apiKey = maskApiKey(maskedGlobal.apiKey);
  if (maskedLocal.apiKey) maskedLocal.apiKey = maskApiKey(maskedLocal.apiKey);
  if (maskedMerged.apiKey) maskedMerged.apiKey = maskApiKey(maskedMerged.apiKey);

  // Read Codex settings
  const codex = readCodexSettings();

  return {
    global: maskedGlobal,
    local: maskedLocal,
    merged: maskedMerged,
    codex,
  };
}

// ---- Get Environment Info ----

export interface EnvironmentInfo {
  homeDir: string;
  claudeDir: string;
  codexDir: string;
  platform: string;
  nodeVersion: string;
  hasApiKey: boolean;
  apiKeyMasked?: string;
  proxyUrl?: string;
  claudeInstalled: boolean;
  codexInstalled: boolean;
}

export function getEnvironmentInfo(settings: ClaudeSettings): EnvironmentInfo {
  return {
    homeDir: os.homedir(),
    claudeDir: CLAUDE_DIR,
    codexDir: CODEX_DIR,
    platform: os.platform(),
    nodeVersion: process.version,
    hasApiKey: !!settings.apiKey || !!process.env.ANTHROPIC_API_KEY,
    apiKeyMasked: settings.apiKey || maskApiKey(process.env.ANTHROPIC_API_KEY),
    proxyUrl: settings.proxyUrl || process.env.HTTP_PROXY || process.env.HTTPS_PROXY,
    claudeInstalled: fs.existsSync(CLAUDE_DIR),
    codexInstalled: fs.existsSync(CODEX_DIR),
  };
}
