/**
 * Background session queue with SQLite persistence.
 * Enables mobile-initiated sessions to run asynchronously.
 *
 * Flow:
 * 1. Bot enqueues a prompt via `enqueueSession()`
 * 2. Worker picks it up and spawns Claude CLI
 * 3. On completion, result is stored and notification sent to the originating chat
 */

import Database from "better-sqlite3";
import { spawn } from "child_process";
import path from "path";
import os from "os";
import { registry } from "@/lib/providers";
import type { BotReply } from "./bot-interface";
import { formatChatResponse, formatError } from "./message-formatter";

// ---- Types ----

export type QueueStatus = "pending" | "running" | "completed" | "failed";

export interface QueuedSession {
  id: number;
  prompt: string;
  provider: string;
  cwd: string | null;
  status: QueueStatus;
  result: string | null;
  model: string | null;
  error: string | null;
  chat_id: string;
  platform: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/** Callback for sending notifications when a session completes */
export type NotifyCallback = (chatId: string, platform: string, reply: BotReply) => Promise<void>;

// ---- Database ----

const DB_PATH = path.join(os.homedir(), ".claude", "scc-dashboard.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.exec(`
      CREATE TABLE IF NOT EXISTS session_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prompt TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'claude',
        cwd TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        result TEXT,
        model TEXT,
        error TEXT,
        chat_id TEXT NOT NULL,
        platform TEXT NOT NULL DEFAULT 'telegram',
        created_at TEXT DEFAULT (datetime('now')),
        started_at TEXT,
        completed_at TEXT
      )
    `);
  }
  return _db;
}

// ---- Queue Operations ----

/** Add a new session to the queue */
export function enqueueSession(params: {
  prompt: string;
  chatId: string;
  platform: string;
  provider?: string;
  cwd?: string;
}): QueuedSession {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO session_queue (prompt, provider, cwd, chat_id, platform)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    params.prompt,
    params.provider || "claude",
    params.cwd || null,
    params.chatId,
    params.platform,
  );
  return getSession(Number(info.lastInsertRowid))!;
}

/** Get a session by ID */
export function getSession(id: number): QueuedSession | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM session_queue WHERE id = ?")
    .get(id) as QueuedSession | undefined;
}

/** List sessions, optionally filtered by status */
export function listSessions(options?: {
  status?: QueueStatus;
  chatId?: string;
  limit?: number;
}): QueuedSession[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (options?.status) {
    clauses.push("status = ?");
    params.push(options.status);
  }
  if (options?.chatId) {
    clauses.push("chat_id = ?");
    params.push(options.chatId);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = options?.limit || 20;

  return db
    .prepare(`SELECT * FROM session_queue ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...params, limit) as QueuedSession[];
}

/** Claim the next pending session for processing */
function claimNextPending(): QueuedSession | undefined {
  const db = getDb();
  const session = db
    .prepare("SELECT * FROM session_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1")
    .get() as QueuedSession | undefined;

  if (session) {
    db.prepare(
      "UPDATE session_queue SET status = 'running', started_at = datetime('now') WHERE id = ? AND status = 'pending'"
    ).run(session.id);
    return { ...session, status: "running" };
  }
  return undefined;
}

/** Mark a session as completed */
function markCompleted(id: number, result: string, model: string | null): void {
  const db = getDb();
  db.prepare(
    "UPDATE session_queue SET status = 'completed', result = ?, model = ?, completed_at = datetime('now') WHERE id = ?"
  ).run(result, model, id);
}

/** Mark a session as failed */
function markFailed(id: number, error: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE session_queue SET status = 'failed', error = ?, completed_at = datetime('now') WHERE id = ?"
  ).run(error, id);
}

/** Cancel a pending session. Returns true if cancelled, false if not cancellable. */
export function cancelSession(id: number): boolean {
  const db = getDb();
  const result = db.prepare(
    "UPDATE session_queue SET status = 'failed', error = 'Cancelled by user', completed_at = datetime('now') WHERE id = ? AND status = 'pending'"
  ).run(id);
  return result.changes > 0;
}

/** Get count of pending sessions */
export function getPendingCount(): number {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) as count FROM session_queue WHERE status = 'pending'")
    .get() as { count: number };
  return row.count;
}

/** Get queue statistics */
export function getQueueStats(): {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  total: number;
} {
  const db = getDb();
  const rows = db
    .prepare("SELECT status, COUNT(*) as count FROM session_queue GROUP BY status")
    .all() as { status: string; count: number }[];

  const stats = { pending: 0, running: 0, completed: 0, failed: 0, total: 0 };
  for (const row of rows) {
    if (row.status in stats) {
      (stats as Record<string, number>)[row.status] = row.count;
    }
    stats.total += row.count;
  }
  return stats;
}

// ---- Worker ----

/** Run a single queued session by spawning the CLI */
async function processSession(session: QueuedSession): Promise<{ content: string; model: string | null }> {
  const provider = registry.get(session.provider) || registry.getDefault();
  if (!provider) {
    throw new Error(`Provider "${session.provider}" not available`);
  }

  const { binary, args, env } = provider.buildCommand(session.prompt, {
    cwd: session.cwd || undefined,
    permissionMode: "plan",
  });

  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: session.cwd || undefined,
      env: env as NodeJS.ProcessEnv,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.end();

    let content = "";
    let model: string | null = null;
    let stderr = "";
    let buffer = "";

    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf-8");
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const event = provider.parseEvent(trimmed);
        if (!event) continue;

        const raw = event.raw;
        if (raw.type === "assistant" && raw.message) {
          const msg = raw.message as Record<string, unknown>;
          if (Array.isArray(msg.content)) {
            for (const block of msg.content) {
              if ((block as Record<string, unknown>).type === "text") {
                content += (block as Record<string, string>).text;
              }
            }
          }
          if (msg.model) model = msg.model as string;
        }
        if (raw.type === "content_block_delta") {
          const delta = raw.delta as Record<string, unknown> | undefined;
          if (delta?.text) content += delta.text as string;
        }
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });

    // Timeout: 5 minutes max
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* */ } }, 3000);
      reject(new Error("Session timed out (5 min limit)"));
    }, 5 * 60 * 1000);

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Spawn error: ${err.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      // Flush remaining buffer
      if (buffer.trim()) {
        const event = provider.parseEvent(buffer.trim());
        if (event?.raw.type === "assistant") {
          const msg = event.raw.message as Record<string, unknown> | undefined;
          if (msg && Array.isArray(msg.content)) {
            for (const block of msg.content) {
              if ((block as Record<string, unknown>).type === "text") {
                content += (block as Record<string, string>).text;
              }
            }
          }
        }
      }

      if (content) {
        resolve({ content, model });
      } else if (code !== 0) {
        reject(new Error(stderr.trim() || `CLI exited with code ${code}`));
      } else {
        resolve({ content: "(no output)", model });
      }
    });
  });
}

// ---- Queue Worker (Singleton) ----

let workerRunning = false;
let workerInterval: ReturnType<typeof setInterval> | null = null;
let notifyCallback: NotifyCallback | null = null;

/** Register the notification callback (called by bot on init) */
export function setNotifyCallback(cb: NotifyCallback): void {
  notifyCallback = cb;
}

/** Process one pending session from the queue */
async function processNext(): Promise<boolean> {
  const session = claimNextPending();
  if (!session) return false;

  console.log(`[SessionQueue] Processing #${session.id}: "${session.prompt.slice(0, 50)}..."`);

  try {
    const { content, model } = await processSession(session);
    markCompleted(session.id, content, model);
    console.log(`[SessionQueue] Completed #${session.id}`);

    // Send notification
    if (notifyCallback) {
      const reply = formatChatResponse(content, model || undefined);
      const notifyText: BotReply = {
        text: `*Queue #${session.id} completed*\n\n${reply.text}`,
        parseMode: "markdown",
      };
      try {
        await notifyCallback(session.chat_id, session.platform, notifyText);
      } catch (err) {
        console.error(`[SessionQueue] Failed to notify chat ${session.chat_id}:`, err);
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    markFailed(session.id, errMsg);
    console.error(`[SessionQueue] Failed #${session.id}:`, errMsg);

    // Notify about failure
    if (notifyCallback) {
      const reply = formatError(`Queue #${session.id} failed: ${errMsg}`);
      try {
        await notifyCallback(session.chat_id, session.platform, reply);
      } catch {
        // Ignore notification failure
      }
    }
  }

  return true;
}

/** Start the background worker (polls every 3 seconds) */
export function startWorker(): void {
  if (workerRunning) return;
  workerRunning = true;
  console.log("[SessionQueue] Worker started");

  workerInterval = setInterval(async () => {
    try {
      // Process up to 1 session per tick (sequential to avoid overload)
      await processNext();
    } catch (err) {
      console.error("[SessionQueue] Worker error:", err);
    }
  }, 3000);
}

/** Stop the background worker */
export function stopWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
  workerRunning = false;
  console.log("[SessionQueue] Worker stopped");
}

/** Check if worker is running */
export function isWorkerRunning(): boolean {
  return workerRunning;
}
