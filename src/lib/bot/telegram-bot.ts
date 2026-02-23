/**
 * Telegram Bot implementation using telegraf.
 * Handles webhook-based message processing for the SCC Dashboard.
 */

import { Telegraf } from "telegraf";
import type { Bot, BotMessage, BotReply, CommandRegistry } from "./bot-interface";
import { createCommandRegistry } from "./bot-interface";
import {
  formatSessionList,
  formatStatus,
  formatHelp,
  formatChatResponse,
  formatError,
} from "./message-formatter";
import { fetchSessions, fetchStatus, chatWithProvider, parseProviderPrefix } from "./bot-helpers";
import {
  enqueueSession,
  getQueueStats,
  getPendingCount,
  listSessions,
  startWorker,
  setNotifyCallback,
  isWorkerRunning,
} from "./session-queue";

/** Parse Telegraf context into our BotMessage */
function parseMessage(text: string, chatId: number, userId: number, userName: string): BotMessage {
  const trimmed = text.trim();
  let command: string | null = null;
  let args = "";

  if (trimmed.startsWith("/")) {
    const parts = trimmed.slice(1).split(/\s+/);
    // Remove @botname suffix from command (e.g., /help@mybot)
    command = (parts[0] || "").split("@")[0].toLowerCase();
    args = parts.slice(1).join(" ");
  }

  return {
    chatId: String(chatId),
    userId: String(userId),
    userName,
    text: trimmed,
    command,
    args,
  };
}

export interface TelegramBotConfig {
  /** Telegram Bot API token */
  token: string;
  /** Base URL of the SCC Dashboard (e.g., http://localhost:3000) */
  baseUrl: string;
  /** Optional: allowed chat IDs (empty = allow all) */
  allowedChatIds?: string[];
}

export class TelegramBot implements Bot {
  readonly platform = "telegram";
  private bot: Telegraf;
  private registry: CommandRegistry;
  private config: TelegramBotConfig;

  constructor(config: TelegramBotConfig) {
    this.config = config;
    this.bot = new Telegraf(config.token);
    this.registry = createCommandRegistry();
  }

  async init(): Promise<void> {
    const { baseUrl, allowedChatIds } = this.config;

    // Access control middleware
    if (allowedChatIds && allowedChatIds.length > 0) {
      this.bot.use((ctx, next) => {
        const chatId = String(ctx.chat?.id);
        if (!allowedChatIds.includes(chatId)) {
          return ctx.reply("Unauthorized. Your chat ID is not allowed.");
        }
        return next();
      });
    }

    // Register command handlers
    this.registry.register("help", async () => formatHelp());

    this.registry.register("sessions", async () => {
      const sessions = await fetchSessions(baseUrl);
      return formatSessionList(sessions);
    });

    this.registry.register("status", async () => {
      const status = await fetchStatus(baseUrl);
      return formatStatus(status);
    });

    this.registry.register("chat", async (msg) => {
      if (!msg.args.trim()) {
        return { text: "Usage: /chat [provider:] <your message>\n\nExamples:\n/chat explain this code\n/chat codex: refactor this function", parseMode: "plain" as const };
      }
      try {
        const { provider, message } = parseProviderPrefix(msg.args.trim());
        const result = await chatWithProvider(baseUrl, message, provider);
        return formatChatResponse(result.content, result.model);
      } catch (err) {
        return formatError(err instanceof Error ? err.message : "Chat failed");
      }
    });

    this.registry.register("bg", async (msg) => {
      if (!msg.args.trim()) {
        return { text: "Usage: /bg [provider:] <your message>\n\nQueues a background session. Results are sent when complete.", parseMode: "plain" as const };
      }
      try {
        const { provider, message } = parseProviderPrefix(msg.args.trim());
        const session = enqueueSession({
          prompt: message,
          chatId: msg.chatId,
          platform: "telegram",
          provider,
        });
        if (!isWorkerRunning()) startWorker();
        return {
          text: `📋 *Queued #${session.id}*\n\nYour session is queued and will run in the background.\nYou'll receive the result when it completes.\n\nPrompt: _${msg.args.trim().slice(0, 100)}${msg.args.trim().length > 100 ? "..." : ""}_`,
          parseMode: "markdown" as const,
        };
      } catch (err) {
        return formatError(err instanceof Error ? err.message : "Failed to queue session");
      }
    });

    this.registry.register("queue", async (msg) => {
      const stats = getQueueStats();
      const recent = listSessions({ chatId: msg.chatId, limit: 5 });
      const lines = [
        "📋 *Background Queue*",
        "",
        `Pending: ${stats.pending} | Running: ${stats.running}`,
        `Completed: ${stats.completed} | Failed: ${stats.failed}`,
        `Total: ${stats.total}`,
      ];
      if (recent.length > 0) {
        lines.push("", "*Your recent sessions:*");
        for (const s of recent) {
          const statusIcon = s.status === "completed" ? "✅" : s.status === "failed" ? "❌" : s.status === "running" ? "⏳" : "📋";
          const prompt = s.prompt.length > 40 ? s.prompt.slice(0, 40) + "..." : s.prompt;
          lines.push(`${statusIcon} #${s.id} ${s.status} — _${prompt}_`);
        }
      }
      return { text: lines.join("\n"), parseMode: "markdown" as const };
    });

    // Wire up notification callback for queue completion
    setNotifyCallback(async (chatId: string, platform: string, reply) => {
      if (platform === "telegram") {
        await this.sendMessage(chatId, reply);
      }
    });

    // Start queue worker if there are pending sessions
    if (getPendingCount() > 0 && !isWorkerRunning()) {
      startWorker();
    }

    // Register telegraf handlers
    this.bot.command("help", (ctx) => this.handleCommand(ctx));
    this.bot.command("start", (ctx) => this.handleCommand(ctx, "help"));
    this.bot.command("sessions", (ctx) => this.handleCommand(ctx));
    this.bot.command("status", (ctx) => this.handleCommand(ctx));
    this.bot.command("chat", (ctx) => this.handleCommand(ctx));
    this.bot.command("bg", (ctx) => this.handleCommand(ctx));
    this.bot.command("queue", (ctx) => this.handleCommand(ctx));
    this.bot.on("text", (ctx) => this.handleText(ctx));
  }

  private async handleCommand(ctx: { message: { text: string; chat: { id: number }; from: { id: number; first_name: string } }; reply: (text: string, extra?: Record<string, unknown>) => Promise<unknown> }, overrideCmd?: string) {
    const { text, chat, from } = ctx.message;
    const msg = parseMessage(text, chat.id, from.id, from.first_name);
    if (overrideCmd) {
      msg.command = overrideCmd;
    }
    const reply = await this.registry.handle(msg);
    await this.sendReply(ctx, reply);
  }

  private async handleText(ctx: { message: { text: string; chat: { id: number }; from: { id: number; first_name: string } }; reply: (text: string, extra?: Record<string, unknown>) => Promise<unknown> }) {
    const { text, chat, from } = ctx.message;
    const msg = parseMessage(text, chat.id, from.id, from.first_name);
    // Non-command text -> route through registry as "chat" command
    msg.command = "chat";
    msg.args = msg.text;
    const reply = await this.registry.handle(msg);
    await this.sendReply(ctx, reply);
  }

  private async sendReply(ctx: { reply: (text: string, extra?: Record<string, unknown>) => Promise<unknown> }, reply: BotReply) {
    const parseMode = reply.parseMode === "markdown" ? "Markdown" : undefined;
    try {
      await ctx.reply(reply.text, parseMode ? { parse_mode: parseMode } : {});
    } catch {
      // If markdown parsing fails, retry as plain text
      await ctx.reply(reply.text.replace(/[*_`\[\]]/g, ""));
    }
  }

  async sendMessage(chatId: string, reply: BotReply): Promise<void> {
    const parseMode = reply.parseMode === "markdown" ? "Markdown" : undefined;
    try {
      await this.bot.telegram.sendMessage(
        chatId,
        reply.text,
        parseMode ? { parse_mode: parseMode } : {},
      );
    } catch {
      // Retry as plain text
      await this.bot.telegram.sendMessage(
        chatId,
        reply.text.replace(/[*_`\[\]]/g, ""),
      );
    }
  }

  async handleWebhook(body: unknown): Promise<void> {
    await this.bot.handleUpdate(body as Parameters<typeof this.bot.handleUpdate>[0]);
  }

  /** Get the underlying Telegraf instance (for setting webhooks, etc.) */
  getTelegraf(): Telegraf {
    return this.bot;
  }
}

/** Singleton bot instance, lazily initialized */
let botInstance: TelegramBot | null = null;

/** Get or create the Telegram bot singleton */
export function getTelegramBot(): TelegramBot | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  if (!botInstance) {
    const baseUrl = process.env.SCC_BASE_URL || "http://localhost:3000";
    const allowedChatIds = process.env.TELEGRAM_CHAT_IDS
      ? process.env.TELEGRAM_CHAT_IDS.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    botInstance = new TelegramBot({ token, baseUrl, allowedChatIds });
    // Initialize asynchronously (fire-and-forget for module load)
    botInstance.init().catch((err) => {
      console.error("[TelegramBot] Init failed:", err);
    });
  }

  return botInstance;
}
