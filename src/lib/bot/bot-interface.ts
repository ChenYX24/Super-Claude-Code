/**
 * Abstract Bot interface for messaging platform integrations.
 * Each platform (Telegram, Feishu, etc.) implements this interface.
 */

/** Incoming message from a user */
export interface BotMessage {
  /** Platform-specific chat/conversation ID */
  chatId: string;
  /** Platform-specific user ID */
  userId: string;
  /** Display name of the sender */
  userName: string;
  /** Raw text content of the message */
  text: string;
  /** Parsed command name (without leading /) or null if not a command */
  command: string | null;
  /** Arguments after the command, or empty string */
  args: string;
}

/** Outgoing reply to send back */
export interface BotReply {
  /** Text content (may include platform-specific formatting) */
  text: string;
  /** Whether to parse as markdown/HTML (platform-dependent) */
  parseMode?: "markdown" | "html" | "plain";
}

/** Session summary for /sessions command */
export interface SessionSummary {
  id: string;
  project: string;
  lastActive: string;
  messageCount: number;
  status: string;
  cost: string;
}

/** Status info for /status command */
export interface BotStatusInfo {
  totalSessions: number;
  activeSessions: number;
  totalProjects: number;
  uptime: string;
}

/** Abstract bot that platforms must implement */
export interface Bot {
  /** Platform name (e.g., "telegram", "feishu") */
  readonly platform: string;

  /** Initialize the bot (register handlers, etc.) */
  init(): Promise<void>;

  /** Send a text reply to a chat */
  sendMessage(chatId: string, reply: BotReply): Promise<void>;

  /** Handle an incoming webhook request body, return response */
  handleWebhook(body: unknown): Promise<void>;
}

/**
 * Command handler function type.
 * Receives parsed message, returns reply text.
 */
export type CommandHandler = (msg: BotMessage) => Promise<BotReply>;

/** Registry of command handlers shared across bot implementations */
export interface CommandRegistry {
  handlers: Map<string, CommandHandler>;
  register(command: string, handler: CommandHandler): void;
  handle(msg: BotMessage): Promise<BotReply>;
}

/** Create a new command registry */
export function createCommandRegistry(): CommandRegistry {
  const handlers = new Map<string, CommandHandler>();

  return {
    handlers,
    register(command: string, handler: CommandHandler) {
      handlers.set(command.toLowerCase(), handler);
    },
    async handle(msg: BotMessage): Promise<BotReply> {
      if (msg.command) {
        const handler = handlers.get(msg.command.toLowerCase());
        if (handler) {
          return handler(msg);
        }
        return {
          text: `Unknown command: /${msg.command}\n\nType /help to see available commands.`,
          parseMode: "plain",
        };
      }
      // Non-command messages treated as chat
      const chatHandler = handlers.get("chat");
      if (chatHandler) {
        return chatHandler({ ...msg, args: msg.text });
      }
      return {
        text: "Send a /command or type a message to chat.\nType /help to see available commands.",
        parseMode: "plain",
      };
    },
  };
}
