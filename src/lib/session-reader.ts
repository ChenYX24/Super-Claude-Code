/**
 * Session Reader - 读取 Claude Code 的会话历史
 * 会话数据存储在 ~/.claude/projects/ 下的各项目目录中
 * 每个会话是一个 .jsonl 文件，每行是一条消息
 */

import fs from "fs";
import path from "path";
import os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

// Model pricing (USD per million tokens)
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-6": { input: 15.0, output: 75.0 },
  "claude-sonnet-4-5": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 0.8, output: 4.0 },
};

function estimateCost(model: string, input: number, output: number): number {
  const key = Object.keys(PRICING).find((k) => model?.includes(k.split("-").slice(1, 3).join("-")));
  const p = key ? PRICING[key] : PRICING["claude-sonnet-4-5"];
  return (input * p.input + output * p.output) / 1_000_000;
}

// ---- Types ----

export type SessionStatus =
  | "reading"    // Last action: reading files (cyan)
  | "thinking"   // Last action: assistant responding (orange)
  | "writing"    // Last action: writing/editing files (purple)
  | "waiting"    // Waiting for user input (yellow)
  | "completed"  // Finished normally (green)
  | "error"      // Error state (red)
  | "idle";      // Inactive/old (gray)

export interface SessionInfo {
  id: string;
  project: string;
  projectName: string;
  startTime: number;
  lastActive: number;
  messageCount: number;
  firstMessage?: string;
  model?: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  cacheReadTokens: number;
  estimatedCost: number;
  status: SessionStatus;
}

export interface SessionMessage {
  uuid: string;
  parentUuid: string | null;
  role: "user" | "assistant" | "system";
  type: string;
  content: string;
  timestamp: string;
  model?: string;
  toolUse?: { name: string; input?: string }[];
  inputTokens?: number;
  outputTokens?: number;
  cacheRead?: number;
  thinkingContent?: string;
  isCheckpoint?: boolean; // user messages = checkpoints
}

export interface SessionDetail {
  id: string;
  project: string;
  projectName: string;
  messages: SessionMessage[];
  totalInputTokens: number;
  totalOutputTokens: number;
  cacheReadTokens: number;
  estimatedCost: number;
  model?: string;
  startTime: string;
  endTime: string;
  checkpoints: { index: number; content: string; timestamp: string }[];
  contextFiles: string[]; // referenced files like CLAUDE.md
}

export interface ProjectInfo {
  path: string;
  name: string;
  sessionCount: number;
  lastActive: number;
}

// ---- Helpers ----

function sanitize(s: string): string {
  return s.replace(/[\uD800-\uDFFF]/g, "\uFFFD");
}

function decodeProjectName(entry: string): string {
  return entry.replace(/^([A-Z])--/, "$1:/").replace(/-/g, "/");
}

// ---- Project listing ----

export function listProjects(): ProjectInfo[] {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  const projects: ProjectInfo[] = [];
  try {
    for (const entry of fs.readdirSync(PROJECTS_DIR)) {
      const fullPath = path.join(PROJECTS_DIR, entry);
      try {
        if (!fs.statSync(fullPath).isDirectory()) continue;
      } catch { continue; }

      let sessionCount = 0;
      let lastActive = 0;
      try {
        for (const file of fs.readdirSync(fullPath)) {
          if (!file.endsWith(".jsonl")) continue;
          if (file === "memory") continue;
          sessionCount++;
          try {
            const stat = fs.statSync(path.join(fullPath, file));
            if (stat.mtimeMs > lastActive) lastActive = stat.mtimeMs;
          } catch { /* skip */ }
        }
      } catch { /* skip */ }

      projects.push({
        path: entry,
        name: decodeProjectName(entry),
        sessionCount,
        lastActive,
      });
    }
  } catch { /* skip */ }
  return projects.sort((a, b) => b.lastActive - a.lastActive);
}

// ---- Session Status Detection ----

const WRITE_TOOLS = new Set(["Write", "Edit", "NotebookEdit"]);
const READ_TOOLS = new Set(["Read", "Glob", "Grep", "WebFetch", "WebSearch"]);

function detectSessionStatus(
  lastActive: number,
  lines: string[],
): SessionStatus {
  const age = Date.now() - lastActive;
  const isRecent = age < 5 * 60 * 1000;    // < 5 min
  const isWarm = age < 60 * 60 * 1000;     // < 1 hour

  // Analyze last few lines for state
  const tail = lines.slice(-5);
  let lastRole = "";
  let lastToolNames: string[] = [];
  let hasError = false;

  for (const line of tail) {
    try {
      const obj = JSON.parse(sanitize(line));
      if (obj.type === "user") lastRole = "user";
      else if (obj.type === "assistant") {
        lastRole = "assistant";
        lastToolNames = [];
        if (Array.isArray(obj.message?.content)) {
          for (const block of obj.message.content) {
            if (block.type === "tool_use") lastToolNames.push(block.name);
          }
        }
      }
      // Detect error indicators
      if (obj.type === "assistant" && obj.message?.stop_reason === "error") hasError = true;
      if (obj.type === "result" && obj.error) hasError = true;
    } catch { /* skip */ }
  }

  if (hasError && isWarm) return "error";

  if (isRecent) {
    if (lastRole === "user") return "waiting";
    if (lastToolNames.some(t => WRITE_TOOLS.has(t))) return "writing";
    if (lastToolNames.some(t => READ_TOOLS.has(t))) return "reading";
    if (lastRole === "assistant") return "thinking";
    return "waiting";
  }

  if (isWarm) return "completed";
  return "idle";
}

// ---- Session listing (reads headers + tail for status) ----

export function listSessions(projectPath: string): SessionInfo[] {
  const projectDir = path.join(PROJECTS_DIR, projectPath);
  if (!fs.existsSync(projectDir)) return [];
  const sessions: SessionInfo[] = [];
  const projectName = decodeProjectName(projectPath);

  try {
    for (const file of fs.readdirSync(projectDir)) {
      if (!file.endsWith(".jsonl")) continue;
      const sessionId = file.replace(".jsonl", "");
      if (sessionId === "memory") continue;

      const filePath = path.join(projectDir, file);
      let startTime = 0;
      let lastActive = 0;
      let messageCount = 0;
      let firstMessage = "";
      let model = "";
      let totalInput = 0;
      let totalOutput = 0;
      let cacheRead = 0;
      let status: SessionStatus = "idle";

      try {
        const stat = fs.statSync(filePath);
        startTime = stat.birthtimeMs || stat.ctimeMs;
        lastActive = stat.mtimeMs;

        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n").filter((l) => l.trim());
        messageCount = lines.length;

        // Read first few lines for metadata
        for (const line of lines.slice(0, 30)) {
          try {
            const obj = JSON.parse(sanitize(line));
            if (obj.type === "user" && !firstMessage && obj.message?.content) {
              const c = obj.message.content;
              firstMessage =
                typeof c === "string" ? c.slice(0, 120) :
                Array.isArray(c) ? (c.find((b: { type: string; text?: string }) => b.type === "text")?.text || "").slice(0, 120) : "";
            }
            if (obj.type === "assistant" && obj.message?.model && !model) {
              model = obj.message.model;
            }
            const usage = obj.message?.usage;
            if (usage) {
              totalInput += usage.input_tokens || 0;
              totalOutput += usage.output_tokens || 0;
              cacheRead += usage.cache_read_input_tokens || 0;
            }
          } catch { /* skip */ }
        }

        // Detect status from tail
        status = detectSessionStatus(lastActive, lines);
      } catch { /* skip */ }

      sessions.push({
        id: sessionId, project: projectPath, projectName,
        startTime, lastActive, messageCount, firstMessage, model,
        totalInputTokens: totalInput, totalOutputTokens: totalOutput,
        cacheReadTokens: cacheRead,
        estimatedCost: estimateCost(model, totalInput, totalOutput),
        status,
      });
    }
  } catch { /* skip */ }
  return sessions.sort((a, b) => b.lastActive - a.lastActive);
}

// ---- Session Detail (full conversation) ----

export function getSessionDetail(
  projectPath: string, sessionId: string
): SessionDetail | null {
  const filePath = path.join(PROJECTS_DIR, projectPath, `${sessionId}.jsonl`);
  if (!fs.existsSync(filePath)) return null;

  const messages: SessionMessage[] = [];
  let totalInput = 0, totalOutput = 0, cacheReadTotal = 0;
  let model = "";
  let startTime = "", endTime = "";
  const checkpoints: SessionDetail["checkpoints"] = [];
  const contextFilesSet = new Set<string>();

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());

    for (const line of lines) {
      try {
        const obj = JSON.parse(sanitize(line));
        if (!obj.type || obj.type === "file-history-snapshot" || obj.isSnapshotUpdate) continue;
        const msg = obj.message;
        if (!msg) continue;

        let textContent = "";
        let thinkingContent = "";
        const toolUse: { name: string; input?: string }[] = [];

        if (typeof msg.content === "string") {
          textContent = msg.content;
        } else if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === "text") textContent += (textContent ? "\n" : "") + (block.text || "");
            else if (block.type === "thinking") thinkingContent += block.thinking || "";
            else if (block.type === "tool_use") {
              const inputStr = typeof block.input === "string"
                ? block.input : JSON.stringify(block.input || {});
              toolUse.push({ name: block.name, input: inputStr.slice(0, 1500) });
              // Track referenced files
              if (block.name === "Read" || block.name === "Edit" || block.name === "Write") {
                const fp = block.input?.file_path;
                if (fp && (fp.endsWith(".md") || fp.endsWith(".json") || fp.endsWith(".ts") || fp.endsWith(".tsx") || fp.endsWith(".py"))) {
                  contextFilesSet.add(fp);
                }
              }
            }
          }
        }

        const usage = msg.usage;
        if (usage) {
          totalInput += usage.input_tokens || 0;
          totalOutput += usage.output_tokens || 0;
          cacheReadTotal += usage.cache_read_input_tokens || 0;
        }
        if (!model && msg.model) model = msg.model;

        const ts = obj.timestamp || "";
        if (!startTime) startTime = ts;
        endTime = ts;

        const isUser = msg.role === "user" || obj.type === "user";
        if (isUser && textContent.trim()) {
          checkpoints.push({
            index: messages.length,
            content: textContent.slice(0, 100),
            timestamp: ts,
          });
        }

        messages.push({
          uuid: obj.uuid || "",
          parentUuid: obj.parentUuid || null,
          role: msg.role || obj.type,
          type: obj.type,
          content: sanitize(textContent),
          timestamp: ts,
          model: msg.model,
          toolUse: toolUse.length > 0 ? toolUse : undefined,
          inputTokens: usage?.input_tokens,
          outputTokens: usage?.output_tokens,
          cacheRead: usage?.cache_read_input_tokens,
          thinkingContent: thinkingContent ? sanitize(thinkingContent.slice(0, 800)) : undefined,
          isCheckpoint: isUser && !!textContent.trim(),
        });
      } catch { /* skip */ }
    }
  } catch { return null; }

  return {
    id: sessionId, project: projectPath,
    projectName: decodeProjectName(projectPath),
    messages, totalInputTokens: totalInput, totalOutputTokens: totalOutput,
    cacheReadTokens: cacheReadTotal,
    estimatedCost: estimateCost(model, totalInput, totalOutput),
    model, startTime, endTime, checkpoints,
    contextFiles: Array.from(contextFilesSet).slice(0, 50),
  };
}

// ---- Aggregates ----

export function getRecentSessions(limit: number = 30): SessionInfo[] {
  const projects = listProjects();
  const allSessions: SessionInfo[] = [];
  for (const project of projects) {
    allSessions.push(...listSessions(project.path));
  }
  return allSessions.sort((a, b) => b.lastActive - a.lastActive).slice(0, limit);
}

export interface ProjectsSummary {
  projects: ProjectInfo[];
  totalSessions: number;
  recentSessions: SessionInfo[];
}

export function getProjectsSummary(): ProjectsSummary {
  const projects = listProjects();
  const totalSessions = projects.reduce((s, p) => s + p.sessionCount, 0);
  const recentSessions = getRecentSessions(30);
  return { projects, totalSessions, recentSessions };
}

// ---- Token Summary (from all sessions) ----

export interface TokenSummary {
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  totalCost: number;
  byModel: Record<string, { input: number; output: number; cost: number; sessions: number }>;
  byDate: Record<string, { input: number; output: number; cost: number; sessions: number }>;
  sessionCount: number;
}

export function getTokenSummary(): TokenSummary {
  const sessions = getRecentSessions(100);
  let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCost = 0;
  const byModel: TokenSummary["byModel"] = {};
  const byDate: TokenSummary["byDate"] = {};

  for (const s of sessions) {
    totalInput += s.totalInputTokens;
    totalOutput += s.totalOutputTokens;
    totalCacheRead += s.cacheReadTokens;
    totalCost += s.estimatedCost;

    const m = s.model || "unknown";
    if (!byModel[m]) byModel[m] = { input: 0, output: 0, cost: 0, sessions: 0 };
    byModel[m].input += s.totalInputTokens;
    byModel[m].output += s.totalOutputTokens;
    byModel[m].cost += s.estimatedCost;
    byModel[m].sessions++;

    const date = s.startTime ? new Date(s.startTime).toISOString().split("T")[0] : "unknown";
    if (!byDate[date]) byDate[date] = { input: 0, output: 0, cost: 0, sessions: 0 };
    byDate[date].input += s.totalInputTokens;
    byDate[date].output += s.totalOutputTokens;
    byDate[date].cost += s.estimatedCost;
    byDate[date].sessions++;
  }

  return { totalInput, totalOutput, totalCacheRead, totalCost, byModel, byDate, sessionCount: sessions.length };
}

// ---- CSV Export ----

export interface TokenExportRow {
  date: string;
  project: string;
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  estimatedCost: number;
}

export function getTokenExportData(): TokenExportRow[] {
  const projects = listProjects();
  const rows: TokenExportRow[] = [];

  for (const project of projects) {
    const sessions = listSessions(project.path);
    for (const session of sessions) {
      rows.push({
        date: session.startTime ? new Date(session.startTime).toISOString().split("T")[0] : "unknown",
        project: session.projectName,
        sessionId: session.id,
        model: session.model || "unknown",
        inputTokens: session.totalInputTokens,
        outputTokens: session.totalOutputTokens,
        cacheReadTokens: session.cacheReadTokens,
        estimatedCost: session.estimatedCost,
      });
    }
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date));
}
