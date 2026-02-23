/**
 * Notification Queue
 *
 * Server-side notification storage using a JSON file as a lightweight
 * persistent queue. Notifications are stored in ~/.claude/scc-notifications.json.
 *
 * Supports:
 * - Adding notifications
 * - Marking as read
 * - Listing with pagination
 * - Auto-pruning old notifications (max 200)
 */

import fs from "fs";
import path from "path";
import os from "os";

const QUEUE_FILE = path.join(os.homedir(), ".claude", "scc-notifications.json");
const MAX_NOTIFICATIONS = 200;

export interface StoredNotification {
  id: string;
  type: "cost" | "session" | "system" | "plugin" | "bot";
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  source?: string;
  meta?: Record<string, unknown>;
}

interface QueueData {
  notifications: StoredNotification[];
  lastUpdated: number;
}

function readQueue(): QueueData {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const raw = fs.readFileSync(QUEUE_FILE, "utf-8");
      const data = JSON.parse(raw);
      if (Array.isArray(data.notifications)) return data;
    }
  } catch {
    /* ignore corrupt file */
  }
  return { notifications: [], lastUpdated: Date.now() };
}

function writeQueue(data: QueueData): void {
  try {
    const dir = path.dirname(QUEUE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("[NotificationQueue] Failed to write:", err);
  }
}

/** Add a notification to the queue. */
export function addNotification(
  type: StoredNotification["type"],
  title: string,
  message: string,
  opts?: { source?: string; meta?: Record<string, unknown> }
): StoredNotification {
  const data = readQueue();
  const notification: StoredNotification = {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    message,
    timestamp: Date.now(),
    read: false,
    source: opts?.source,
    meta: opts?.meta,
  };

  data.notifications.unshift(notification);

  // Prune old notifications
  if (data.notifications.length > MAX_NOTIFICATIONS) {
    data.notifications = data.notifications.slice(0, MAX_NOTIFICATIONS);
  }

  data.lastUpdated = Date.now();
  writeQueue(data);
  return notification;
}

/** Get notifications, optionally filtered. */
export function getNotifications(opts?: {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
  since?: number;
}): { notifications: StoredNotification[]; total: number; unread: number } {
  const data = readQueue();
  let filtered = data.notifications;

  if (opts?.since) {
    filtered = filtered.filter((n) => n.timestamp > opts.since!);
  }

  if (opts?.unreadOnly) {
    filtered = filtered.filter((n) => !n.read);
  }

  const total = filtered.length;
  const unread = data.notifications.filter((n) => !n.read).length;

  const offset = opts?.offset ?? 0;
  const limit = opts?.limit ?? 50;
  filtered = filtered.slice(offset, offset + limit);

  return { notifications: filtered, total, unread };
}

/** Mark a notification as read. */
export function markRead(id: string): boolean {
  const data = readQueue();
  const notification = data.notifications.find((n) => n.id === id);
  if (!notification) return false;
  notification.read = true;
  data.lastUpdated = Date.now();
  writeQueue(data);
  return true;
}

/** Mark all notifications as read. */
export function markAllRead(): number {
  const data = readQueue();
  let count = 0;
  for (const n of data.notifications) {
    if (!n.read) {
      n.read = true;
      count++;
    }
  }
  if (count > 0) {
    data.lastUpdated = Date.now();
    writeQueue(data);
  }
  return count;
}

/** Clear all notifications. */
export function clearAll(): number {
  const data = readQueue();
  const count = data.notifications.length;
  data.notifications = [];
  data.lastUpdated = Date.now();
  writeQueue(data);
  return count;
}

/** Get the timestamp of the last update (for SSE polling). */
export function getLastUpdated(): number {
  const data = readQueue();
  return data.lastUpdated;
}
