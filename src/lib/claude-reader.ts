/**
 * Claude Reader - 读取 ~/.claude/ 目录下的 teams/tasks/sessions 数据
 */

import fs from "fs";
import path from "path";
import os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const TEAMS_DIR = path.join(CLAUDE_DIR, "teams");
const TASKS_DIR = path.join(CLAUDE_DIR, "tasks");

// ---- Types ----

export interface TeamMember {
  agentId: string;
  name: string;
  agentType: string;
  model: string;
  joinedAt: number;
  prompt?: string;
  color?: string;
}

export interface TeamConfig {
  name: string;
  description: string;
  createdAt: number;
  leadAgentId: string;
  members: TeamMember[];
}

export interface TeamMessage {
  from: string;
  to?: string;
  text: string;
  summary?: string;
  timestamp: string;
  color?: string;
  read?: boolean;
  type?: string;
}

export interface TaskItem {
  id: string;
  subject: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  owner?: string;
  blockedBy?: string[];
  blocks?: string[];
  activeForm?: string;
  createdAt?: number;
}

// ---- Helpers ----

/** Sanitize strings to remove broken Unicode surrogates */
function sanitize(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\uD800-\uDFFF]/g, "\uFFFD");
}

function safeReadJSON<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    const raw = sanitize(fs.readFileSync(filePath, "utf-8"));
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// ---- Team Reading ----

export function listTeams(): string[] {
  if (!fs.existsSync(TEAMS_DIR)) return [];
  try {
    return fs
      .readdirSync(TEAMS_DIR)
      .filter((d) => {
        try {
          return fs.statSync(path.join(TEAMS_DIR, d)).isDirectory();
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

export function readTeamConfig(teamName: string): TeamConfig | null {
  const configPath = path.join(TEAMS_DIR, teamName, "config.json");
  return safeReadJSON<TeamConfig | null>(configPath, null);
}

export function readTeamInbox(
  teamName: string,
  inboxName: string
): TeamMessage[] {
  const inboxPath = path.join(
    TEAMS_DIR,
    teamName,
    "inboxes",
    `${inboxName}.json`
  );
  return safeReadJSON<TeamMessage[]>(inboxPath, []);
}

export function readAllInboxes(
  teamName: string
): Record<string, TeamMessage[]> {
  const inboxDir = path.join(TEAMS_DIR, teamName, "inboxes");
  if (!fs.existsSync(inboxDir)) return {};
  const result: Record<string, TeamMessage[]> = {};
  try {
    for (const file of fs.readdirSync(inboxDir)) {
      if (!file.endsWith(".json")) continue;
      const name = file.replace(".json", "");
      result[name] = readTeamInbox(teamName, name);
    }
  } catch {
    // skip
  }
  return result;
}

// ---- Task Reading (with persistence cache) ----

// Cache dir lives next to the dashboard source
const TASK_CACHE_DIR = path.join(__dirname, "..", "..", ".task-cache");

function getTaskCachePath(teamName: string): string {
  return path.join(TASK_CACHE_DIR, `${teamName}.json`);
}

function loadTaskCache(teamName: string): TaskItem[] {
  const cachePath = getTaskCachePath(teamName);
  return safeReadJSON<TaskItem[]>(cachePath, []);
}

function saveTaskCache(teamName: string, tasks: TaskItem[]): void {
  try {
    if (!fs.existsSync(TASK_CACHE_DIR)) {
      fs.mkdirSync(TASK_CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(
      getTaskCachePath(teamName),
      JSON.stringify(tasks, null, 2),
      "utf-8"
    );
  } catch { /* skip */ }
}

export function readTasks(teamName: string): TaskItem[] {
  const taskDir = path.join(TASKS_DIR, teamName);

  // Read live tasks from Claude's task dir
  const liveTasks: TaskItem[] = [];
  if (fs.existsSync(taskDir)) {
    try {
      for (const file of fs.readdirSync(taskDir)) {
        if (!file.endsWith(".json")) continue;
        try {
          const raw = sanitize(
            fs.readFileSync(path.join(taskDir, file), "utf-8")
          );
          const data = JSON.parse(raw);
          liveTasks.push({ id: file.replace(".json", ""), ...data });
        } catch {
          // skip corrupt files
        }
      }
    } catch { /* skip */ }
  }

  // Load cached tasks
  const cachedTasks = loadTaskCache(teamName);

  // Merge: live tasks override cache, cache fills in deleted tasks
  const mergedMap = new Map<string, TaskItem>();
  for (const t of cachedTasks) {
    mergedMap.set(t.id, t);
  }
  for (const t of liveTasks) {
    mergedMap.set(t.id, t);
  }

  const merged = Array.from(mergedMap.values()).sort(
    (a, b) => parseInt(a.id || "0") - parseInt(b.id || "0")
  );

  // Persist merged snapshot back to cache
  if (merged.length > 0) {
    saveTaskCache(teamName, merged);
  }

  return merged;
}

// ---- Aggregate: Team + Members + Tasks + Messages ----

export type MemberStatus = "working" | "idle" | "completed" | "stale" | "terminated";

export interface MemberInfo {
  status: MemberStatus;
  lastSeen?: number; // timestamp of last activity
}

export interface TeamOverview {
  config: TeamConfig & { leadSessionId?: string };
  tasks: TaskItem[];
  messages: TeamMessage[];
  memberStatus: Record<string, MemberStatus>;
  memberInfo: Record<string, MemberInfo>;
  pastMembers: TeamMember[];
}

export function getTeamOverview(teamName: string): TeamOverview | null {
  const config = readTeamConfig(teamName);
  if (!config) return null;

  const tasks = readTasks(teamName) || [];
  const allInboxes = readAllInboxes(teamName);

  // Flatten all messages, label inbox owner, and sort by time
  const messages: TeamMessage[] = [];
  for (const [inboxOwner, msgs] of Object.entries(allInboxes)) {
    for (const m of msgs) {
      // Skip JSON protocol messages
      if (m.text && m.text.startsWith("{")) continue;
      messages.push({
        ...m,
        to: inboxOwner,
        text: sanitize(m.text || ""),
        summary: m.summary ? sanitize(m.summary) : undefined,
      });
    }
  }
  messages.sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Determine last seen time for each member from messages
  const lastSeenMap: Record<string, number> = {};
  for (const msg of messages) {
    const ts = new Date(msg.timestamp).getTime();
    if (msg.from && ts > (lastSeenMap[msg.from] || 0)) {
      lastSeenMap[msg.from] = ts;
    }
  }

  // Also check inbox file mtimes for activity signal
  const inboxDir = path.join(TEAMS_DIR, teamName, "inboxes");
  if (fs.existsSync(inboxDir)) {
    try {
      for (const file of fs.readdirSync(inboxDir)) {
        if (!file.endsWith(".json")) continue;
        const name = file.replace(".json", "");
        try {
          const mtime = fs.statSync(path.join(inboxDir, file)).mtimeMs;
          if (mtime > (lastSeenMap[name] || 0)) {
            lastSeenMap[name] = mtime;
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  const STALE_THRESHOLD = 10 * 60 * 1000; // 10 minutes
  const now = Date.now();

  // Determine member status from tasks + activity
  const memberStatus: Record<string, MemberStatus> = {};
  const memberInfo: Record<string, MemberInfo> = {};
  for (const member of config.members) {
    const memberTasks = tasks.filter((t) => t.owner === member.name);
    const lastSeen = lastSeenMap[member.name];
    const isStale = lastSeen ? (now - lastSeen > STALE_THRESHOLD) : true;

    let status: MemberStatus;
    if (memberTasks.some((t) => t.status === "in_progress")) {
      // Has in_progress tasks but hasn't been active → stale
      status = isStale ? "stale" : "working";
    } else if (
      memberTasks.length > 0 &&
      memberTasks.every((t) => t.status === "completed")
    ) {
      status = "completed";
    } else {
      status = "idle";
    }

    memberStatus[member.name] = status;
    memberInfo[member.name] = { status, lastSeen };
  }

  // Discover past members from messages/tasks not in current config
  const currentNames = new Set(config.members.map((m) => m.name));
  const discoveredNames = new Set<string>();

  for (const msg of messages) {
    if (msg.from && !currentNames.has(msg.from)) discoveredNames.add(msg.from);
    if (msg.to && !currentNames.has(msg.to)) discoveredNames.add(msg.to);
  }
  for (const task of tasks) {
    if (task.owner && !currentNames.has(task.owner)) discoveredNames.add(task.owner);
  }

  // Also check inbox file names for agents that had inboxes
  if (fs.existsSync(inboxDir)) {
    try {
      for (const file of fs.readdirSync(inboxDir)) {
        if (!file.endsWith(".json")) continue;
        const name = file.replace(".json", "");
        if (!currentNames.has(name)) discoveredNames.add(name);
      }
    } catch { /* skip */ }
  }

  const pastMembers: TeamMember[] = [];
  for (const name of discoveredNames) {
    pastMembers.push({
      agentId: `${name}@${config.name}`,
      name,
      agentType: "general-purpose",
      model: "unknown",
      joinedAt: 0,
      color: undefined,
    });
    memberStatus[name] = "terminated";
    memberInfo[name] = { status: "terminated", lastSeen: lastSeenMap[name] };
  }

  return { config, tasks, messages, memberStatus, memberInfo, pastMembers };
}

// ---- All Teams Summary ----

export interface TeamsSummary {
  teams: {
    name: string;
    description: string;
    memberCount: number;
    taskCount: number;
    completedTasks: number;
    activeSince: number;
    leadSessionId?: string;
  }[];
}

export function getAllTeamsSummary(): TeamsSummary {
  const teamNames = listTeams();
  const teams = teamNames
    .map((name) => {
      const config = readTeamConfig(name);
      // Skip teams without a valid config (empty dirs like UUIDs or "default")
      if (!config || !config.name) return null;
      const tasks = readTasks(name);
      return {
        name,
        description: config.description || "",
        memberCount: config.members?.length || 0,
        taskCount: tasks.length,
        completedTasks: tasks.filter((t) => t.status === "completed").length,
        activeSince: config.createdAt || 0,
        leadSessionId: (config as TeamConfig & { leadSessionId?: string }).leadSessionId,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);
  return { teams };
}

// ---- MCP Server Reading ----

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  type?: string;
}

export interface MCPServersData {
  global: Record<string, MCPServerConfig>;
  projects: { project: string; servers: Record<string, MCPServerConfig> }[];
}

const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");
const SETTINGS_FILE = path.join(CLAUDE_DIR, "settings.json");

export function readMCPServers(): MCPServersData {
  const result: MCPServersData = {
    global: {},
    projects: [],
  };

  // Read global settings
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const raw = sanitize(fs.readFileSync(SETTINGS_FILE, "utf-8"));
      const settings = JSON.parse(raw);
      if (settings.mcpServers && typeof settings.mcpServers === "object") {
        result.global = settings.mcpServers;
      }
    } catch {
      // skip
    }
  }

  // Scan projects for .mcp.json files
  if (fs.existsSync(PROJECTS_DIR)) {
    try {
      const projectDirs = fs.readdirSync(PROJECTS_DIR).filter((d) => {
        try {
          return fs.statSync(path.join(PROJECTS_DIR, d)).isDirectory();
        } catch {
          return false;
        }
      });

      for (const projectName of projectDirs) {
        const mcpFile = path.join(PROJECTS_DIR, projectName, ".mcp.json");
        if (fs.existsSync(mcpFile)) {
          try {
            const raw = sanitize(fs.readFileSync(mcpFile, "utf-8"));
            const mcpConfig = JSON.parse(raw);
            if (mcpConfig.mcpServers && typeof mcpConfig.mcpServers === "object") {
              result.projects.push({
                project: projectName,
                servers: mcpConfig.mcpServers,
              });
            }
          } catch {
            // skip corrupt files
          }
        }
      }
    } catch {
      // skip
    }
  }

  return result;
}
