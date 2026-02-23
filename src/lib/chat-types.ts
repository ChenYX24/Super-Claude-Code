import type { SessionMessage } from "@/components/sessions/types";

// Permission modes for Claude CLI
export type PermissionMode = "default" | "trust" | "acceptEdits" | "readOnly" | "plan";

// Options passed to chat send
export interface ChatSendOptions {
  sessionId?: string;
  cwd?: string;
  permissionMode?: PermissionMode;
  allowedTools?: string[];
  provider?: string;
}

// Stream execution phases
export type StreamPhase =
  | "connecting"
  | "thinking"
  | "tool_use"
  | "responding"
  | "complete"
  | "cancelled"
  | "error";

// Enhanced chat message for live streaming
export interface LiveChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  thinkingContent: string;
  toolCalls: { name: string; input?: string }[];
  timestamp: number;
  phase: StreamPhase;
  cost?: number;
  durationMs?: number;
  model?: string;
  startedAt?: number;
}

// Content block types from CLI stream-json
interface TextBlock {
  type: "text";
  text: string;
}

interface ThinkingBlock {
  type: "thinking";
  thinking: string;
}

interface ToolUseBlock {
  type: "tool_use";
  name: string;
  input?: Record<string, unknown>;
}

type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock;

// Parse assistant event content blocks into structured data
export function parseAssistantEvent(event: {
  message?: { content?: ContentBlock[] };
}): {
  text: string;
  thinkingContent: string;
  toolCalls: { name: string; input?: string }[];
  phase: StreamPhase;
} {
  const content = event.message?.content;
  if (!content || !Array.isArray(content)) {
    return { text: "", thinkingContent: "", toolCalls: [], phase: "responding" };
  }

  let text = "";
  let thinkingContent = "";
  const toolCalls: { name: string; input?: string }[] = [];

  for (const block of content) {
    switch (block.type) {
      case "text":
        text += block.text;
        break;
      case "thinking":
        thinkingContent += block.thinking;
        break;
      case "tool_use":
        toolCalls.push({
          name: block.name,
          input: block.input ? JSON.stringify(block.input) : undefined,
        });
        break;
    }
  }

  // Determine phase from what's present in the latest event
  let phase: StreamPhase = "responding";
  if (toolCalls.length > 0) {
    phase = "tool_use";
  } else if (thinkingContent && !text) {
    phase = "thinking";
  }

  return { text: text.trim(), thinkingContent, toolCalls, phase };
}

// Convert LiveChatMessage → SessionMessage for ConvMessage component
export function toSessionMessage(msg: LiveChatMessage): SessionMessage {
  return {
    uuid: msg.id,
    role: msg.role,
    type: "message",
    content: msg.text,
    timestamp: new Date(msg.timestamp).toISOString(),
    model: msg.model,
    thinkingContent: msg.thinkingContent || undefined,
    toolUse:
      msg.toolCalls.length > 0
        ? msg.toolCalls.map((tc) => ({ name: tc.name, input: tc.input }))
        : undefined,
  };
}

// Phase display labels
export const PHASE_LABELS: Record<StreamPhase, string> = {
  connecting: "Connecting...",
  thinking: "Thinking...",
  tool_use: "Using tools...",
  responding: "Responding...",
  complete: "",
  cancelled: "Cancelled",
  error: "Error",
};
