/**
 * Toolbox Reader - reads skills, commands, hooks, agents, and rules
 * from ~/.claude/ directory structure
 */

import fs from "fs";
import path from "path";
import os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const SETTINGS_FILE = path.join(CLAUDE_DIR, "settings.json");

// ---- Types ----

export interface SkillInfo {
  name: string;
  description: string;
  allowedTools?: string[];
  content: string;
  path: string;
}

export interface CommandInfo {
  name: string;
  description: string;
  content: string;
  path: string;
}

export interface AgentInfo {
  name: string;
  description: string;
  content: string;
  path: string;
}

export interface RuleInfo {
  name: string;
  group: string;
  preview: string;
  content: string;
  path: string;
}

export interface HookEntry {
  type: string;
  matcher?: string;
  command: string;
  timeout?: number;
  description?: string;
  index?: number; // Index in the hooks[type] array
}

export interface ToolboxData {
  skills: SkillInfo[];
  commands: CommandInfo[];
  agents: AgentInfo[];
  rules: RuleInfo[];
  hooks: HookEntry[];
}

// ---- Helpers ----

function sanitize(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\uD800-\uDFFF]/g, "\uFFFD");
}

function safeReadFile(filePath: string): string {
  try {
    return sanitize(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return "";
  }
}

function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      meta[key] = val;
    }
  }
  return { meta, body: match[2] };
}

function dirExists(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

// ---- Skills ----

export function listSkills(): SkillInfo[] {
  const skillsDir = path.join(CLAUDE_DIR, "skills");
  if (!dirExists(skillsDir)) return [];

  const skills: SkillInfo[] = [];
  try {
    for (const entry of fs.readdirSync(skillsDir)) {
      const skillDir = path.join(skillsDir, entry);
      if (!dirExists(skillDir)) continue;

      const skillFile = path.join(skillDir, "SKILL.md");
      if (!fs.existsSync(skillFile)) continue;

      const raw = safeReadFile(skillFile);
      const { meta, body } = parseFrontmatter(raw);
      skills.push({
        name: meta.name || entry,
        description: meta.description || body.split("\n")[0] || "",
        allowedTools: meta.allowed_tools ? meta.allowed_tools.split(",").map(s => s.trim()) : undefined,
        content: body,
        path: skillFile,
      });
    }
  } catch { /* skip */ }
  return skills;
}

// ---- Commands ----

export function listCommands(): CommandInfo[] {
  const commandsDir = path.join(CLAUDE_DIR, "commands");
  if (!dirExists(commandsDir)) return [];

  const commands: CommandInfo[] = [];
  try {
    for (const file of fs.readdirSync(commandsDir)) {
      if (!file.endsWith(".md")) continue;
      const filePath = path.join(commandsDir, file);
      const raw = safeReadFile(filePath);
      const { meta, body } = parseFrontmatter(raw);
      commands.push({
        name: meta.name || file.replace(".md", ""),
        description: meta.description || body.split("\n")[0] || "",
        content: body,
        path: filePath,
      });
    }
  } catch { /* skip */ }
  return commands;
}

// ---- Agents ----

export function listAgents(): AgentInfo[] {
  const agentsDir = path.join(CLAUDE_DIR, "agents");
  if (!dirExists(agentsDir)) return [];

  const agents: AgentInfo[] = [];
  try {
    for (const file of fs.readdirSync(agentsDir)) {
      if (!file.endsWith(".md")) continue;
      const filePath = path.join(agentsDir, file);
      const raw = safeReadFile(filePath);
      const { meta, body } = parseFrontmatter(raw);
      agents.push({
        name: meta.name || file.replace(".md", ""),
        description: meta.description || body.split("\n")[0] || "",
        content: body,
        path: filePath,
      });
    }
  } catch { /* skip */ }
  return agents;
}

// ---- Rules ----

export function listRules(): RuleInfo[] {
  const rulesDir = path.join(CLAUDE_DIR, "rules");
  if (!dirExists(rulesDir)) return [];

  const rules: RuleInfo[] = [];

  function scanDir(dir: string, group: string) {
    try {
      for (const entry of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, entry);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            scanDir(fullPath, entry);
          } else if (entry.endsWith(".md")) {
            const raw = safeReadFile(fullPath);
            const { meta, body } = parseFrontmatter(raw);
            const lines = body.split("\n").filter(l => l.trim());
            rules.push({
              name: entry.replace(".md", ""),
              group,
              preview: lines.slice(0, 3).join("\n"),
              content: body,
              path: fullPath,
            });
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  scanDir(rulesDir, "root");
  return rules;
}

// ---- Hooks ----

export function getHooksConfig(): HookEntry[] {
  const hooks: HookEntry[] = [];

  // Read from settings.json
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const raw = safeReadFile(SETTINGS_FILE);
      const settings = JSON.parse(raw);

      if (settings.hooks && typeof settings.hooks === "object") {
        for (const [hookType, hookDef] of Object.entries(settings.hooks)) {
          const entries = Array.isArray(hookDef) ? hookDef : [hookDef];
          for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
            const h = entries[entryIndex];
            if (!h || typeof h !== "object") continue;
            const hook = h as Record<string, unknown>;

            // New format: hooks array with {type, command} inside each entry
            const innerHooks = hook.hooks as Array<Record<string, unknown>> | undefined;
            if (Array.isArray(innerHooks)) {
              for (const inner of innerHooks) {
                if (inner.command && typeof inner.command === "string") {
                  hooks.push({
                    type: hookType,
                    matcher: hook.matcher as string | undefined,
                    command: inner.command,
                    timeout: (inner.timeout ?? hook.timeout) as number | undefined,
                    description: hook.description as string | undefined,
                    index: entryIndex,
                  });
                }
              }
            } else if (hook.command && typeof hook.command === "string") {
              // Legacy format: command directly on the entry
              hooks.push({
                type: hookType,
                matcher: hook.matcher as string | undefined,
                command: hook.command,
                timeout: hook.timeout as number | undefined,
                description: hook.description as string | undefined,
                index: entryIndex,
              });
            }
          }
        }
      }
    } catch { /* skip */ }
  }

  return hooks.filter(h => h.command && h.command.trim());
}

// ---- Combined ----

export function getToolboxData(): ToolboxData {
  return {
    skills: listSkills(),
    commands: listCommands(),
    agents: listAgents(),
    rules: listRules(),
    hooks: getHooksConfig(),
  };
}
