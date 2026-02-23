/**
 * Telegram Bot implementation using telegraf.
 * Supports both webhook and polling modes, plus permission approval via inline keyboards.
 */

import { readFileSync } from "fs";
import { join } from "path";
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
  /** Primary chat ID for notifications/approvals */
  chatId?: string;
}

/** Pending approval entry */
interface PendingApproval {
  resolve: (decision: "allow" | "deny") => void;
  timer: ReturnType<typeof setTimeout>;
}

export class TelegramBot implements Bot {
  readonly platform = "telegram";
  private bot: Telegraf;
  private registry: CommandRegistry;
  private config: TelegramBotConfig;
  private pollingActive = false;
  private pollingStartedAt: number | null = null;
  private pendingApprovals = new Map<string, PendingApproval>();

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
          text: `*Queued #${session.id}*\n\nYour session is queued and will run in the background.\nYou'll receive the result when it completes.\n\nPrompt: _${msg.args.trim().slice(0, 100)}${msg.args.trim().length > 100 ? "..." : ""}_`,
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
        "*Background Queue*",
        "",
        `Pending: ${stats.pending} | Running: ${stats.running}`,
        `Completed: ${stats.completed} | Failed: ${stats.failed}`,
        `Total: ${stats.total}`,
      ];
      if (recent.length > 0) {
        lines.push("", "*Your recent sessions:*");
        for (const s of recent) {
          const statusIcon = s.status === "completed" ? "done" : s.status === "failed" ? "fail" : s.status === "running" ? "run" : "queue";
          const prompt = s.prompt.length > 40 ? s.prompt.slice(0, 40) + "..." : s.prompt;
          lines.push(`[${statusIcon}] #${s.id} ${s.status} - _${prompt}_`);
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

    // Register callback_query handler for approval inline keyboards
    this.bot.on("callback_query", (ctx) => this.handleCallback(ctx));
  }

  // ─── Polling Mode ───────────────────────────────────────────────────────────

  async startPolling(): Promise<void> {
    if (this.pollingActive) return;

    // Delete any existing webhook so polling works
    await this.bot.telegram.deleteWebhook();

    // Launch with long polling (telegraf built-in)
    this.bot.launch();
    this.pollingActive = true;
    this.pollingStartedAt = Date.now();

    // Send startup message to primary chat
    const chatId = this.config.chatId || this.config.allowedChatIds?.[0];
    if (chatId) {
      await this.sendMessage(chatId, {
        text: "*SCC Dashboard Bot* - Polling mode started\n\nBot is now listening for commands.",
        parseMode: "markdown",
      });
    }

    console.log("[TelegramBot] Polling started");
  }

  async stopPolling(): Promise<void> {
    if (!this.pollingActive) return;

    this.bot.stop("stopPolling");
    this.pollingActive = false;
    this.pollingStartedAt = null;

    console.log("[TelegramBot] Polling stopped");
  }

  isPolling(): boolean {
    return this.pollingActive;
  }

  getPollingUptime(): number | null {
    if (!this.pollingStartedAt) return null;
    return Date.now() - this.pollingStartedAt;
  }

  // ─── Approval System ────────────────────────────────────────────────────────

  /**
   * Handle a permission approval request from Claude Code hook.
   * Sends an inline keyboard to Telegram and waits for user response.
   * Returns "allow" or "deny".
   */
  async handleApproval(
    reqId: string,
    toolName: string,
    toolInput: Record<string, unknown>,
  ): Promise<"allow" | "deny"> {
    const chatId = this.config.chatId || this.config.allowedChatIds?.[0];
    if (!chatId) {
      throw new Error("No chat ID configured for approvals");
    }

    // Build approval message text
    const lines = ["*[Claude Code] Permission Request*", "", `Tool: \`${toolName}\``];

    if (toolInput.description) {
      lines.push(`Desc: ${String(toolInput.description).slice(0, 300)}`);
    }
    if (toolInput.command) {
      const cmd = String(toolInput.command);
      lines.push(`Command:\n\`${cmd.length > 400 ? cmd.slice(0, 400) + "..." : cmd}\``);
    }
    if (toolInput.file_path) {
      lines.push(`File: \`${String(toolInput.file_path)}\``);
    }

    const text = lines.join("\n");

    // Send message with inline keyboard
    await this.bot.telegram.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Approve", callback_data: `yes_${reqId}` },
            { text: "Deny", callback_data: `no_${reqId}` },
          ],
        ],
      },
    });

    // Return a promise that resolves when user clicks a button
    return new Promise<"allow" | "deny">((resolve) => {
      const timer = setTimeout(() => {
        this.pendingApprovals.delete(reqId);
        resolve("deny");
      }, 240_000); // 4 minute timeout

      this.pendingApprovals.set(reqId, { resolve, timer });
    });
  }

  /** Handle callback_query from inline keyboard buttons */
  private async handleCallback(ctx: {
    callbackQuery: { id: string; data?: string; message?: { message_id: number; chat: { id: number }; text?: string } };
    answerCbQuery: (text?: string) => Promise<unknown>;
    editMessageText?: (text: string, extra?: Record<string, unknown>) => Promise<unknown>;
  }): Promise<void> {
    const data = ctx.callbackQuery.data;
    if (!data) return;

    // Parse callback: "yes_{reqId}" or "no_{reqId}"
    const match = data.match(/^(yes|no)_(.+)$/);
    if (!match) return;

    const [, action, reqId] = match;
    const decision: "allow" | "deny" = action === "yes" ? "allow" : "deny";

    const pending = this.pendingApprovals.get(reqId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingApprovals.delete(reqId);
      pending.resolve(decision);
    }

    // Acknowledge the button press
    const ackText = decision === "allow" ? "Approved!" : "Denied!";
    try {
      await ctx.answerCbQuery(ackText);
    } catch {
      // Ignore ack failures
    }

    // Edit the original message to mark the decision
    const tag = decision === "allow" ? "[APPROVED]" : "[DENIED]";
    const originalText = ctx.callbackQuery.message?.text || "";
    try {
      if (ctx.editMessageText) {
        await ctx.editMessageText(`${tag}\n${originalText}`);
      }
    } catch {
      // Ignore edit failures
    }
  }

  // ─── Command Handling ───────────────────────────────────────────────────────

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

  /** Get the configured primary chat ID */
  getChatId(): string | undefined {
    return this.config.chatId || this.config.allowedChatIds?.[0];
  }
}

// ─── Config Loading ─────────────────────────────────────────────────────────

interface TelegramFileConfig {
  bot_token?: string;
  chat_id?: string;
  port?: number;
}

/** Try to load config from ~/.claude/hooks/telegram_config.json */
function loadFileConfig(): TelegramFileConfig | null {
  try {
    const home = process.env.USERPROFILE || process.env.HOME || "";
    const configPath = join(home, ".claude", "hooks", "telegram_config.json");
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as TelegramFileConfig;
  } catch {
    return null;
  }
}

/** Singleton bot instance, lazily initialized */
let botInstance: TelegramBot | null = null;

/** Get or create the Telegram bot singleton */
export function getTelegramBot(): TelegramBot | null {
  // Priority: env vars > telegram_config.json
  let token = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_CHAT_IDS?.split(",").map((s) => s.trim()).filter(Boolean)[0];

  if (!token) {
    const fileConfig = loadFileConfig();
    if (fileConfig?.bot_token) {
      token = fileConfig.bot_token;
    }
    if (!chatId && fileConfig?.chat_id) {
      chatId = fileConfig.chat_id;
    }
  }

  if (!token) return null;

  if (!botInstance) {
    const baseUrl = process.env.SCC_BASE_URL || "http://localhost:3000";
    const allowedChatIds = process.env.TELEGRAM_CHAT_IDS
      ? process.env.TELEGRAM_CHAT_IDS.split(",").map((s) => s.trim()).filter(Boolean)
      : chatId
        ? [chatId]
        : [];

    botInstance = new TelegramBot({ token, baseUrl, allowedChatIds, chatId });
    // Initialize asynchronously (fire-and-forget for module load)
    botInstance.init().catch((err) => {
      console.error("[TelegramBot] Init failed:", err);
    });
  }

  return botInstance;
}
