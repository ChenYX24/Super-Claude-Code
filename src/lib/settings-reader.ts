/**
 * Settings Reader - 读取 Claude Code 配置文件
 */

import fs from "fs";
import path from "path";
import os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const SETTINGS_FILE = path.join(CLAUDE_DIR, "settings.json");
const SETTINGS_LOCAL_FILE = path.join(CLAUDE_DIR, "settings.local.json");

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

export interface SettingsData {
  global: ClaudeSettings;
  local: ClaudeSettings;
  merged: ClaudeSettings;
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

  return {
    global: maskedGlobal,
    local: maskedLocal,
    merged: maskedMerged,
  };
}

// ---- Get Environment Info ----

export interface EnvironmentInfo {
  homeDir: string;
  claudeDir: string;
  platform: string;
  nodeVersion: string;
  hasApiKey: boolean;
  apiKeyMasked?: string;
  proxyUrl?: string;
}

export function getEnvironmentInfo(settings: ClaudeSettings): EnvironmentInfo {
  return {
    homeDir: os.homedir(),
    claudeDir: CLAUDE_DIR,
    platform: os.platform(),
    nodeVersion: process.version,
    hasApiKey: !!settings.apiKey || !!process.env.ANTHROPIC_API_KEY,
    apiKeyMasked: settings.apiKey || maskApiKey(process.env.ANTHROPIC_API_KEY),
    proxyUrl: settings.proxyUrl || process.env.HTTP_PROXY || process.env.HTTPS_PROXY,
  };
}
