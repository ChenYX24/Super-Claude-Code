// Shared TypeScript interfaces for Sessions

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
  status?: string;
}

export interface ProjectInfo {
  path: string;
  name: string;
  sessionCount: number;
  lastActive: number;
}

export interface SessionsData {
  projects: ProjectInfo[];
  totalSessions: number;
  recentSessions: SessionInfo[];
}

/** Raw content block from API/JSONL (e.g. text, thinking, tool_use). Pass-through required for last assistant message when calling Anthropic API. */
export type RawContentBlock = { type: string; text?: string; thinking?: string; [k: string]: unknown };

export interface SessionMessage {
  uuid: string;
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
  /** Original content array from JSONL/API. Keep unchanged when sending last assistant message to Anthropic (thinking/redacted_thinking must not be modified). */
  rawContent?: RawContentBlock[];
  isCheckpoint?: boolean;
}

export interface Checkpoint {
  index: number;
  content: string;
  timestamp: string;
}

export interface FilePreview {
  path: string;
  fileName: string;
  ext: string;
  content: string;
  size: number;
  lastModified: number;
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
  checkpoints: Checkpoint[];
  contextFiles: string[];
}

export type SessionStatus = "reading" | "thinking" | "writing" | "waiting" | "completed" | "error" | "idle";
