/**
 * Message formatter for mobile-friendly bot output.
 * Formats session data, status info, and chat responses
 * for display on messaging platforms.
 */

import type { SessionSummary, BotStatusInfo, BotReply } from "./bot-interface";

const STATUS_EMOJI: Record<string, string> = {
  reading: "📖",
  thinking: "🧠",
  writing: "✏️",
  waiting: "⏳",
  completed: "✅",
  error: "❌",
  idle: "💤",
};

/** Format a list of sessions for mobile display */
export function formatSessionList(sessions: SessionSummary[]): BotReply {
  if (sessions.length === 0) {
    return { text: "No sessions found.", parseMode: "plain" };
  }

  const lines = sessions.map((s, i) => {
    const emoji = STATUS_EMOJI[s.status] || "📋";
    const project = s.project.length > 25
      ? "..." + s.project.slice(-22)
      : s.project;
    return [
      `${i + 1}. ${emoji} *${escapeMarkdown(project)}*`,
      `   Status: ${s.status} | Msgs: ${s.messageCount}`,
      `   Cost: ${s.cost} | ${s.lastActive}`,
    ].join("\n");
  });

  const header = `📋 *Recent Sessions* (${sessions.length})\n`;
  return {
    text: header + "\n" + lines.join("\n\n"),
    parseMode: "markdown",
  };
}

/** Format system status for mobile display */
export function formatStatus(info: BotStatusInfo): BotReply {
  const lines = [
    "📊 *SCC Dashboard Status*",
    "",
    `Sessions: ${info.totalSessions} total, ${info.activeSessions} active`,
    `Projects: ${info.totalProjects}`,
    `Uptime: ${info.uptime}`,
  ];

  return {
    text: lines.join("\n"),
    parseMode: "markdown",
  };
}

/** Format help text */
export function formatHelp(): BotReply {
  const lines = [
    "🤖 *Super Claude Code Bot*",
    "",
    "Available commands:",
    "",
    "/sessions - List recent sessions",
    "/chat <message> - Send a message to Claude",
    "/bg <message> - Queue a background session",
    "/queue - Show background queue status",
    "/status - Show dashboard status",
    "/help - Show this help message",
    "",
    "You can also send a message directly without a command to chat with Claude.",
    "Use /bg for long tasks — results are sent when complete.",
  ];

  return {
    text: lines.join("\n"),
    parseMode: "markdown",
  };
}

/** Format a streaming chat response (final result) */
export function formatChatResponse(content: string, model?: string): BotReply {
  const trimmed = content.trim();
  if (!trimmed) {
    return { text: "_(empty response)_", parseMode: "markdown" };
  }

  // Truncate very long responses for mobile
  const MAX_LENGTH = 4000;
  const truncated = trimmed.length > MAX_LENGTH
    ? trimmed.slice(0, MAX_LENGTH) + "\n\n_(truncated)_"
    : trimmed;

  const footer = model ? `\n\n_Model: ${model}_` : "";
  return {
    text: truncated + footer,
    parseMode: "markdown",
  };
}

/** Format an error message */
export function formatError(error: string): BotReply {
  return {
    text: `❌ *Error*\n\n${escapeMarkdown(error)}`,
    parseMode: "markdown",
  };
}

/** Escape special Markdown characters for Telegram MarkdownV1 */
function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}
