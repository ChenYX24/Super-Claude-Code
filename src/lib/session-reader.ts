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
const CODEX_DIR = path.join(os.homedir(), ".codex");
const CODEX_SESSIONS_DIR = path.join(CODEX_DIR, "sessions");

// Model pricing (USD per million tokens)
const PRICING: Record<string, { input: number; output: number }> = {
  // Claude models
  "claude-opus-4-6": { input: 15.0, output: 75.0 },
  "claude-sonnet-4-5": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 0.8, output: 4.0 },
  // Codex / OpenAI models
  "gpt-5.2-codex": { input: 2.0, output: 8.0 },
  "gpt-5.3-codex": { input: 2.0, output: 8.0 },
  "o3-pro": { input: 20.0, output: 80.0 },
  "o3": { input: 10.0, output: 40.0 },
  "o4-mini": { input: 1.1, output: 4.4 },
  "gpt-4.1": { input: 2.0, output: 8.0 },
};

function estimateCost(model: string, input: number, output: number): number {
  if (!model) {
    const p = PRICING["claude-sonnet-4-5"];
    return (input * p.input + output * p.output) / 1_000_000;
  }
  // Direct match first
  if (PRICING[model]) {
    const p = PRICING[model];
    return (input * p.input + output * p.output) / 1_000_000;
  }
  // Partial match for Claude models
  const key = Object.keys(PRICING).find((k) => model.includes(k.split("-").slice(1, 3).join("-")));
  // Fallback: detect provider to pick a sensible default
  const provider = detectProvider(model);
  const fallbackKey = provider === "codex" ? "gpt-5.2-codex" : "claude-sonnet-4-5";
  const p = key ? PRICING[key] : PRICING[fallbackKey];
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

export type SessionProvider = "claude" | "codex" | "unknown";

export interface SessionInfo {
  id: string;
  project: string;
  projectName: string;
  startTime: number;
  lastActive: number;
  messageCount: number;
  firstMessage?: string;
  model?: string;
  provider: SessionProvider;
  totalInputTokens: number;
  totalOutputTokens: number;
  cacheReadTokens: number;
  estimatedCost: number;
  status: SessionStatus;
}

/** Detect provider from model name */
function detectProvider(model: string): SessionProvider {
  if (!model) return "unknown";
  const m = model.toLowerCase();
  if (m.includes("claude")) return "claude";
  if (m.includes("gpt") || m.includes("o3") || m.includes("o4") || m.includes("codex")) return "codex";
  return "unknown";
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
  /** Original content array from JSONL; required unchanged for last assistant message when calling Anthropic API. */
  rawContent?: unknown[];
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
  const projects: ProjectInfo[] = [];

  // Claude projects
  if (fs.existsSync(PROJECTS_DIR)) {
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
  }

  // Codex project (aggregated)
  const codexProject = getCodexProjectInfo();
  if (codexProject) projects.push(codexProject);

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
  // Route Codex project to Codex session listing
  if (projectPath === "__codex__") return listCodexSessions();

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

        // Scan all lines for usage totals + metadata
        for (let li = 0; li < lines.length; li++) {
          try {
            const obj = JSON.parse(sanitize(lines[li]));
            // First message: only from first 30 lines for performance
            if (li < 30) {
              if (obj.type === "user" && !firstMessage && obj.message?.content) {
                const c = obj.message.content;
                firstMessage =
                  typeof c === "string" ? c.slice(0, 120) :
                    Array.isArray(c) ? (c.find((b: { type: string; text?: string }) => b.type === "text")?.text || "").slice(0, 120) : "";
              }
            }
            // Model detection: scan ALL lines
            if (obj.type === "assistant" && obj.message?.model && !model) {
              model = obj.message.model;
            }
            // Usage: accumulate from ALL lines
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
        provider: detectProvider(model),
        totalInputTokens: totalInput, totalOutputTokens: totalOutput,
        cacheReadTokens: cacheRead,
        estimatedCost: estimateCost(model, totalInput, totalOutput),
        status,
      });
    }
  } catch { /* skip */ }
  return sessions.sort((a, b) => b.lastActive - a.lastActive);
}

// ---- Codex Session Listing ----

/** Parse a Codex rollout JSONL file into SessionInfo */
function parseCodexSessionFile(filePath: string, fileName: string): SessionInfo | null {
  let content: string;
  try { content = fs.readFileSync(filePath, "utf-8"); } catch { return null; }

  const lines = content.split("\n").filter(l => l.trim());
  if (lines.length === 0) return null;

  let sessionId = "";
  let cwd = "";
  let model = "";
  let firstMessage = "";
  let startTime = 0;
  let lastActive = 0;
  let messageCount = 0;
  let totalInput = 0;
  let totalOutput = 0;

  for (const line of lines) {
    try {
      const obj = JSON.parse(sanitize(line));
      const ts = obj.timestamp ? new Date(obj.timestamp).getTime() : 0;
      if (ts && (!startTime || ts < startTime)) startTime = ts;
      if (ts > lastActive) lastActive = ts;

      if (obj.type === "session_meta") {
        sessionId = obj.payload?.id || "";
        cwd = obj.payload?.cwd || "";
      } else if (obj.type === "turn_context") {
        if (!model && obj.payload?.model) model = obj.payload.model;
      } else if (obj.type === "event_msg") {
        const evtType = obj.payload?.type;
        if (evtType === "user_message") {
          messageCount++;
          if (!firstMessage) firstMessage = (obj.payload.message || "").slice(0, 120);
        } else if (evtType === "agent_message") {
          messageCount++;
        } else if (evtType === "token_count" && obj.payload?.info?.total_token_usage) {
          // Cumulative: always take the latest
          const usage = obj.payload.info.total_token_usage;
          totalInput = usage.input_tokens || 0;
          totalOutput = usage.output_tokens || 0;
        }
      }
    } catch { /* skip */ }
  }

  if (!sessionId) {
    // Extract ID from filename: rollout-{datetime}-{uuid}.jsonl
    const match = fileName.match(/rollout-.*?-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i);
    sessionId = match ? match[1] : fileName.replace(".jsonl", "");
  }

  // Use file stat as fallback for times
  if (!startTime || !lastActive) {
    try {
      const stat = fs.statSync(filePath);
      if (!startTime) startTime = stat.birthtimeMs || stat.ctimeMs;
      if (!lastActive) lastActive = stat.mtimeMs;
    } catch { /* skip */ }
  }

  const projectName = cwd || "Codex Session";

  return {
    id: sessionId,
    project: "__codex__",
    projectName,
    startTime,
    lastActive,
    messageCount,
    firstMessage,
    model,
    provider: "codex",
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    cacheReadTokens: 0,
    estimatedCost: estimateCost(model, totalInput, totalOutput),
    status: detectSessionStatus(lastActive, lines),
  };
}

/** List all Codex sessions from ~/.codex/sessions/ */
export function listCodexSessions(): SessionInfo[] {
  if (!fs.existsSync(CODEX_SESSIONS_DIR)) return [];
  const sessions: SessionInfo[] = [];

  // Traverse year/month/day directories
  try {
    for (const year of fs.readdirSync(CODEX_SESSIONS_DIR)) {
      const yearDir = path.join(CODEX_SESSIONS_DIR, year);
      try { if (!fs.statSync(yearDir).isDirectory()) continue; } catch { continue; }

      for (const month of fs.readdirSync(yearDir)) {
        const monthDir = path.join(yearDir, month);
        try { if (!fs.statSync(monthDir).isDirectory()) continue; } catch { continue; }

        for (const day of fs.readdirSync(monthDir)) {
          const dayDir = path.join(monthDir, day);
          try { if (!fs.statSync(dayDir).isDirectory()) continue; } catch { continue; }

          for (const file of fs.readdirSync(dayDir)) {
            if (!file.endsWith(".jsonl") || !file.startsWith("rollout-")) continue;
            const session = parseCodexSessionFile(path.join(dayDir, file), file);
            if (session) sessions.push(session);
          }
        }
      }
    }
  } catch { /* skip */ }

  return sessions.sort((a, b) => b.lastActive - a.lastActive);
}

/** Aggregate Codex sessions into a single ProjectInfo entry */
function getCodexProjectInfo(): ProjectInfo | null {
  const sessions = listCodexSessions();
  if (sessions.length === 0) return null;

  let lastActive = 0;
  for (const s of sessions) {
    if (s.lastActive > lastActive) lastActive = s.lastActive;
  }

  return {
    path: "__codex__",
    name: "Codex CLI",
    sessionCount: sessions.length,
    lastActive,
  };
}

// ---- Session Detail (full conversation) ----

/** Get Codex session detail by session ID */
export function getCodexSessionDetail(sessionId: string): SessionDetail | null {
  // Find the file by scanning session directories
  if (!fs.existsSync(CODEX_SESSIONS_DIR)) return null;

  let targetFile = "";
  try {
    for (const year of fs.readdirSync(CODEX_SESSIONS_DIR)) {
      const yearDir = path.join(CODEX_SESSIONS_DIR, year);
      try { if (!fs.statSync(yearDir).isDirectory()) continue; } catch { continue; }
      for (const month of fs.readdirSync(yearDir)) {
        const monthDir = path.join(yearDir, month);
        try { if (!fs.statSync(monthDir).isDirectory()) continue; } catch { continue; }
        for (const day of fs.readdirSync(monthDir)) {
          const dayDir = path.join(monthDir, day);
          try { if (!fs.statSync(dayDir).isDirectory()) continue; } catch { continue; }
          for (const file of fs.readdirSync(dayDir)) {
            if (file.includes(sessionId)) {
              targetFile = path.join(dayDir, file);
              break;
            }
          }
          if (targetFile) break;
        }
        if (targetFile) break;
      }
      if (targetFile) break;
    }
  } catch { /* skip */ }

  if (!targetFile) return null;

  let content: string;
  try { content = fs.readFileSync(targetFile, "utf-8"); } catch { return null; }

  const lines = content.split("\n").filter(l => l.trim());
  const messages: SessionMessage[] = [];
  let model = "";
  let cwd = "";
  let startTime = "";
  let endTime = "";
  let totalInput = 0;
  let totalOutput = 0;
  const checkpoints: SessionDetail["checkpoints"] = [];

  for (const line of lines) {
    try {
      const obj = JSON.parse(sanitize(line));
      const ts = obj.timestamp || "";

      if (obj.type === "session_meta") {
        cwd = obj.payload?.cwd || "";
        if (!startTime) startTime = obj.payload?.timestamp || ts;
      } else if (obj.type === "turn_context") {
        if (!model && obj.payload?.model) model = obj.payload.model;
      } else if (obj.type === "event_msg") {
        const evtType = obj.payload?.type;

        if (evtType === "user_message") {
          const text = obj.payload.message || "";
          checkpoints.push({ index: messages.length, content: text.slice(0, 100), timestamp: ts });
          messages.push({
            uuid: obj.payload.turn_id || `user-${messages.length}`,
            parentUuid: null,
            role: "user",
            type: "user",
            content: sanitize(text),
            timestamp: ts,
            isCheckpoint: true,
          });
        } else if (evtType === "agent_message") {
          messages.push({
            uuid: `agent-${messages.length}`,
            parentUuid: null,
            role: "assistant",
            type: "assistant",
            content: sanitize(obj.payload.message || ""),
            timestamp: ts,
            model,
          });
        } else if (evtType === "agent_reasoning") {
          // Attach thinking to a pending assistant message or create one
          const lastMsg = messages[messages.length - 1];
          if (lastMsg && lastMsg.role === "assistant" && !lastMsg.thinkingContent) {
            lastMsg.thinkingContent = sanitize((obj.payload.text || "").slice(0, 800));
          } else {
            messages.push({
              uuid: `think-${messages.length}`,
              parentUuid: null,
              role: "assistant",
              type: "assistant",
              content: "",
              timestamp: ts,
              model,
              thinkingContent: sanitize((obj.payload.text || "").slice(0, 800)),
            });
          }
        } else if (evtType === "token_count" && obj.payload?.info?.total_token_usage) {
          const usage = obj.payload.info.total_token_usage;
          totalInput = usage.input_tokens || 0;
          totalOutput = usage.output_tokens || 0;
        }
      }

      if (ts) endTime = ts;
    } catch { /* skip */ }
  }

  const projectPath = cwd ? `codex:${cwd}` : "codex:unknown";

  return {
    id: sessionId,
    project: projectPath,
    projectName: cwd || "Codex Session",
    messages,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    cacheReadTokens: 0,
    estimatedCost: estimateCost(model, totalInput, totalOutput),
    model,
    startTime,
    endTime,
    checkpoints,
    contextFiles: [],
  };
}

export function getSessionDetail(
  projectPath: string, sessionId: string
): SessionDetail | null {
  // Route Codex sessions to the Codex reader
  if (projectPath === "__codex__") {
    return getCodexSessionDetail(sessionId);
  }

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
  const allSessions: SessionInfo[] = [];

  // Claude sessions from each project
  const projects = listProjects().filter(p => p.path !== "__codex__");
  for (const project of projects) {
    allSessions.push(...listSessions(project.path));
  }

  // Codex sessions
  allSessions.push(...listCodexSessions());

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
  const recentSessions = getRecentSessions(9999);
  return { projects, totalSessions, recentSessions };
}

// ---- Token Summary (from all sessions) ----

export interface TokenSummary {
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  totalCost: number;
  byModel: Record<string, { input: number; output: number; cost: number; sessions: number }>;
  byDate: Record<string, { input: number; output: number; cost: number; sessions: number; byModel?: Record<string, { cost: number }> }>;
  sessionCount: number;
}

export function getTokenSummary(provider?: SessionProvider): TokenSummary {
  const projects = listProjects();
  let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCost = 0;
  const byModel: TokenSummary["byModel"] = {};
  const byDate: TokenSummary["byDate"] = {};
  let sessionCount = 0;
  // Track unique sessions per date for accurate session counts
  const dateSessionSets = new Map<string, Set<string>>();

  for (const project of projects) {
    const projectDir = path.join(PROJECTS_DIR, project.path);
    let files: string[];
    try { files = fs.readdirSync(projectDir); } catch { continue; }

    for (const file of files) {
      if (!file.endsWith(".jsonl") || file === "memory.jsonl") continue;

      const filePath = path.join(projectDir, file);
      let content: string;
      try { content = fs.readFileSync(filePath, "utf-8"); } catch { continue; }

      const lines = content.split("\n").filter((l) => l.trim());
      let sessionModel = "";
      let fileMtimeDate = "";

      // If provider filter is set, first detect the session model to decide whether to skip
      if (provider) {
        for (const line of lines) {
          try {
            const obj = JSON.parse(sanitize(line));
            if (obj.type === "assistant" && obj.message?.model) {
              sessionModel = obj.message.model;
              break;
            }
          } catch { /* skip */ }
        }
        const sessionProvider = detectProvider(sessionModel);
        if (sessionProvider !== provider) continue;
      }

      sessionCount++;

      for (const line of lines) {
        try {
          const obj = JSON.parse(sanitize(line));
          const msg = obj.message;
          if (!msg) continue;

          // Track model for the session
          if (msg.model && !sessionModel) sessionModel = msg.model;

          const usage = msg.usage;
          if (!usage) continue;

          const inp = usage.input_tokens || 0;
          const out = usage.output_tokens || 0;
          const cache = usage.cache_read_input_tokens || 0;
          const m = msg.model || sessionModel || "unknown";
          const msgCost = estimateCost(m, inp, out);

          totalInput += inp;
          totalOutput += out;
          totalCacheRead += cache;
          totalCost += msgCost;

          // byModel accumulation
          if (!byModel[m]) byModel[m] = { input: 0, output: 0, cost: 0, sessions: 0 };
          byModel[m].input += inp;
          byModel[m].output += out;
          byModel[m].cost += msgCost;

          // byDate: use the message's own timestamp for accurate daily attribution
          let date = "unknown";
          if (obj.timestamp) {
            try { date = new Date(obj.timestamp).toISOString().split("T")[0]; } catch { /* skip */ }
          }
          if (date === "unknown") {
            // Lazy-load file mtime as fallback
            if (!fileMtimeDate) {
              try { fileMtimeDate = new Date(fs.statSync(filePath).mtimeMs).toISOString().split("T")[0]; }
              catch { fileMtimeDate = "unknown"; }
            }
            date = fileMtimeDate;
          }

          if (!byDate[date]) byDate[date] = { input: 0, output: 0, cost: 0, sessions: 0, byModel: {} };
          byDate[date].input += inp;
          byDate[date].output += out;
          byDate[date].cost += msgCost;

          if (!byDate[date].byModel) byDate[date].byModel = {};
          if (!byDate[date].byModel![m]) byDate[date].byModel![m] = { cost: 0 };
          byDate[date].byModel![m].cost += msgCost;

          // Track which sessions had messages on each date
          if (!dateSessionSets.has(date)) dateSessionSets.set(date, new Set());
          dateSessionSets.get(date)!.add(file);
        } catch { /* skip */ }
      }

      // Count sessions per model
      if (sessionModel && byModel[sessionModel]) {
        byModel[sessionModel].sessions++;
      }
    }
  }

  // Set accurate session counts per date
  for (const [date, sessSet] of dateSessionSets) {
    if (byDate[date]) byDate[date].sessions = sessSet.size;
  }

  // Include Codex sessions
  const codexSessions = listCodexSessions();
  for (const cs of codexSessions) {
    // Apply provider filter
    if (provider && cs.provider !== provider) continue;

    sessionCount++;
    const m = cs.model || "unknown";
    const inp = cs.totalInputTokens;
    const out = cs.totalOutputTokens;
    const cost = cs.estimatedCost;

    totalInput += inp;
    totalOutput += out;
    totalCost += cost;

    if (!byModel[m]) byModel[m] = { input: 0, output: 0, cost: 0, sessions: 0 };
    byModel[m].input += inp;
    byModel[m].output += out;
    byModel[m].cost += cost;
    byModel[m].sessions++;

    // Date from startTime
    let date = "unknown";
    if (cs.startTime) {
      try { date = new Date(cs.startTime).toISOString().split("T")[0]; } catch { /* skip */ }
    }

    if (!byDate[date]) byDate[date] = { input: 0, output: 0, cost: 0, sessions: 0, byModel: {} };
    byDate[date].input += inp;
    byDate[date].output += out;
    byDate[date].cost += cost;
    byDate[date].sessions++;

    if (!byDate[date].byModel) byDate[date].byModel = {};
    if (!byDate[date].byModel![m]) byDate[date].byModel![m] = { cost: 0 };
    byDate[date].byModel![m].cost += cost;
  }

  return { totalInput, totalOutput, totalCacheRead, totalCost, byModel, byDate, sessionCount };
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
