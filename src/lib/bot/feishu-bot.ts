/**
 * Feishu (Lark) Bot implementation.
 * Uses @larksuiteoapi/node-sdk for sending messages and raw event processing
 * for webhook-based message handling.
 *
 * Environment variables:
 * - FEISHU_APP_ID: App ID from Feishu Open Platform (required)
 * - FEISHU_APP_SECRET: App Secret (required)
 * - FEISHU_VERIFICATION_TOKEN: Event verification token (optional)
 * - FEISHU_ENCRYPT_KEY: Event encryption key (optional)
 * - SCC_BASE_URL: Dashboard base URL (default: http://localhost:3000)
 * - FEISHU_ALLOWED_CHATS: Comma-separated chat IDs to allow (empty = allow all)
 */

import * as lark from "@larksuiteoapi/node-sdk";
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

/** Parse Feishu event body into BotMessage */
function parseFeishuMessage(event: Record<string, unknown>): BotMessage | null {
  const message = event.message as Record<string, unknown> | undefined;
  const sender = event.sender as Record<string, unknown> | undefined;

  if (!message || !sender) return null;

  const messageType = message.message_type as string;
  if (messageType !== "text") return null;

  // Feishu wraps text content in JSON
  let text = "";
  try {
    const content = JSON.parse(message.content as string);
    text = (content.text as string) || "";
  } catch {
    text = (message.content as string) || "";
  }

  // Remove @mention prefix (Feishu includes @_user_1 format)
  text = text.replace(/@_user_\d+\s*/g, "").trim();

  const chatId = (message.chat_id as string) || "";
  const senderId = ((sender.sender_id as Record<string, string>)?.open_id) || "";
  const senderType = (sender.sender_type as string) || "";

  // Ignore bot's own messages
  if (senderType === "app") return null;

  let command: string | null = null;
  let args = "";

  if (text.startsWith("/")) {
    const parts = text.slice(1).split(/\s+/);
    command = (parts[0] || "").toLowerCase();
    args = parts.slice(1).join(" ");
  }

  return {
    chatId,
    userId: senderId,
    userName: senderId,
    text,
    command,
    args,
  };
}

/** Convert BotReply to Feishu-compatible plain text.
 * Preserves structure but removes Telegram/Discord-specific markdown syntax.
 */
function replyToFeishuContent(reply: BotReply): string {
  if (reply.parseMode === "markdown") {
    return reply.text
      // Bold: *text* -> text (Feishu uses ** for bold in rich text, but plain text has no bold)
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      // Italic: _text_ -> text
      .replace(/_([^_]+)_/g, "$1")
      // Unescape escaped characters
      .replace(/\\([_*\[\]()~`>#+\-=|{}.!])/g, "$1");
  }
  return reply.text;
}

export interface FeishuBotConfig {
  appId: string;
  appSecret: string;
  verificationToken?: string;
  encryptKey?: string;
  baseUrl: string;
  allowedChatIds?: string[];
}

export class FeishuBot implements Bot {
  readonly platform = "feishu";
  private client: lark.Client;
  private registry: CommandRegistry;
  private config: FeishuBotConfig;

  constructor(config: FeishuBotConfig) {
    this.config = config;
    this.client = new lark.Client({
      appId: config.appId,
      appSecret: config.appSecret,
    });
    this.registry = createCommandRegistry();
  }

  async init(): Promise<void> {
    const { baseUrl } = this.config;

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
          platform: "feishu",
          provider,
        });
        if (!isWorkerRunning()) startWorker();
        const truncPrompt = msg.args.trim().slice(0, 100) + (msg.args.trim().length > 100 ? "..." : "");
        return {
          text: `Queued #${session.id}\n\nYour session is queued and will run in the background.\nYou'll receive the result when it completes.\n\nPrompt: ${truncPrompt}`,
          parseMode: "plain" as const,
        };
      } catch (err) {
        return formatError(err instanceof Error ? err.message : "Failed to queue session");
      }
    });

    this.registry.register("queue", async (msg) => {
      const stats = getQueueStats();
      const recent = listSessions({ chatId: msg.chatId, limit: 5 });
      const lines = [
        "Background Queue",
        "",
        `Pending: ${stats.pending} | Running: ${stats.running}`,
        `Completed: ${stats.completed} | Failed: ${stats.failed}`,
        `Total: ${stats.total}`,
      ];
      if (recent.length > 0) {
        lines.push("", "Your recent sessions:");
        for (const s of recent) {
          const statusIcon = s.status === "completed" ? "[OK]" : s.status === "failed" ? "[FAIL]" : s.status === "running" ? "[RUN]" : "[WAIT]";
          const prompt = s.prompt.length > 40 ? s.prompt.slice(0, 40) + "..." : s.prompt;
          lines.push(`${statusIcon} #${s.id} ${s.status} - ${prompt}`);
        }
      }
      return { text: lines.join("\n"), parseMode: "plain" as const };
    });

    // Wire up notification callback for queue completion
    setNotifyCallback(async (chatId: string, platform: string, reply) => {
      if (platform === "feishu") {
        await this.sendMessage(chatId, reply);
      }
    });

    if (getPendingCount() > 0 && !isWorkerRunning()) {
      startWorker();
    }
  }

  async sendMessage(chatId: string, reply: BotReply): Promise<void> {
    const content = replyToFeishuContent(reply);

    try {
      await this.client.im.message.create({
        params: { receive_id_type: "chat_id" },
        data: {
          receive_id: chatId,
          msg_type: "text",
          content: JSON.stringify({ text: content }),
        },
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[FeishuBot] Failed to send message:", errMsg);
      // Try to send an error message back to the user
      try {
        await this.client.im.message.create({
          params: { receive_id_type: "chat_id" },
          data: {
            receive_id: chatId,
            msg_type: "text",
            content: JSON.stringify({ text: `[Error] Failed to send response: ${errMsg}` }),
          },
        });
      } catch {
        // Truly cannot reach the chat — log and move on
        console.error("[FeishuBot] Could not send error notification to chat:", chatId);
      }
    }
  }

  /** Check if body is a URL verification challenge */
  isChallenge(body: unknown): body is { type: "url_verification"; challenge: string } {
    const data = body as Record<string, unknown>;
    return data.type === "url_verification" && typeof data.challenge === "string";
  }

  async handleWebhook(body: unknown): Promise<void> {
    const data = body as Record<string, unknown>;

    // Skip URL verification challenges (handled by route)
    if (data.type === "url_verification") return;

    // Handle event callback (v2 schema)
    const header = data.header as Record<string, unknown> | undefined;
    const event = data.event as Record<string, unknown> | undefined;

    if (!header || !event) return;

    const eventType = header.event_type as string;
    if (eventType !== "im.message.receive_v1") return;

    // Verify token if configured
    if (this.config.verificationToken) {
      const token = header.token as string;
      if (token !== this.config.verificationToken) {
        console.warn("[FeishuBot] Invalid verification token");
        return;
      }
    }

    const msg = parseFeishuMessage(event);
    if (!msg) return;

    // Access control
    if (this.config.allowedChatIds && this.config.allowedChatIds.length > 0) {
      if (!this.config.allowedChatIds.includes(msg.chatId)) {
        console.warn(`[FeishuBot] Unauthorized chat: ${msg.chatId}`);
        return;
      }
    }

    const reply = await this.registry.handle(msg);
    await this.sendMessage(msg.chatId, reply);
  }

  /** Get the underlying Lark Client instance */
  getClient(): lark.Client {
    return this.client;
  }
}

/** Singleton bot instance */
let botInstance: FeishuBot | null = null;

/** Get or create the Feishu bot singleton */
export function getFeishuBot(): FeishuBot | null {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  if (!appId || !appSecret) return null;

  if (!botInstance) {
    const baseUrl = process.env.SCC_BASE_URL || "http://localhost:3000";
    const verificationToken = process.env.FEISHU_VERIFICATION_TOKEN || undefined;
    const encryptKey = process.env.FEISHU_ENCRYPT_KEY || undefined;
    const allowedChatIds = process.env.FEISHU_ALLOWED_CHATS
      ? process.env.FEISHU_ALLOWED_CHATS.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    botInstance = new FeishuBot({
      appId,
      appSecret,
      verificationToken,
      encryptKey,
      baseUrl,
      allowedChatIds,
    });

    botInstance.init().catch((err) => {
      console.error("[FeishuBot] Init failed:", err);
    });
  }

  return botInstance;
}
