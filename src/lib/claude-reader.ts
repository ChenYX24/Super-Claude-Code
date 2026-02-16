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

// ---- Task Reading ----

export function readTasks(teamName: string): TaskItem[] {
  const taskDir = path.join(TASKS_DIR, teamName);
  if (!fs.existsSync(taskDir)) return [];
  const tasks: TaskItem[] = [];
  try {
    for (const file of fs.readdirSync(taskDir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = sanitize(
          fs.readFileSync(path.join(taskDir, file), "utf-8")
        );
        const data = JSON.parse(raw);
        tasks.push({ id: file.replace(".json", ""), ...data });
      } catch {
        // skip corrupt files
      }
    }
  } catch {
    // skip
  }
  return tasks.sort(
    (a, b) => parseInt(a.id || "0") - parseInt(b.id || "0")
  );
}

// ---- Aggregate: Team + Members + Tasks + Messages ----

export interface TeamOverview {
  config: TeamConfig & { leadSessionId?: string };
  tasks: TaskItem[];
  messages: TeamMessage[];
  memberStatus: Record<string, "working" | "idle" | "completed">;
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

  // Determine member status from tasks
  const memberStatus: Record<string, "working" | "idle" | "completed"> = {};
  for (const member of config.members) {
    const memberTasks = tasks.filter((t) => t.owner === member.name);
    if (memberTasks.some((t) => t.status === "in_progress")) {
      memberStatus[member.name] = "working";
    } else if (
      memberTasks.length > 0 &&
      memberTasks.every((t) => t.status === "completed")
    ) {
      memberStatus[member.name] = "completed";
    } else {
      memberStatus[member.name] = "idle";
    }
  }

  return { config, tasks, messages, memberStatus };
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
