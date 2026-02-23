import Database from "better-sqlite3";
import path from "path";
import os from "os";

const DB_PATH = path.join(os.homedir(), ".claude", "scc-dashboard.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.exec(`
      CREATE TABLE IF NOT EXISTS session_metadata (
        session_id TEXT PRIMARY KEY,
        display_name TEXT,
        pinned INTEGER DEFAULT 0,
        tags TEXT DEFAULT '[]',
        deleted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
  }
  return _db;
}

export interface SessionMeta {
  session_id: string;
  display_name: string | null;
  pinned: number;
  tags: string; // JSON array
  deleted: number;
  created_at: string;
  updated_at: string;
}

export function getSessionMeta(sessionId: string): SessionMeta | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM session_metadata WHERE session_id = ?")
    .get(sessionId) as SessionMeta | undefined;
}

export function getAllSessionMeta(): SessionMeta[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM session_metadata")
    .all() as SessionMeta[];
}

export function updateSessionMeta(
  sessionId: string,
  updates: {
    displayName?: string | null;
    pinned?: boolean;
    tags?: string[];
    deleted?: boolean;
  }
): SessionMeta {
  const db = getDb();
  const existing = getSessionMeta(sessionId);

  if (!existing) {
    db.prepare(
      `INSERT INTO session_metadata (session_id, display_name, pinned, tags, deleted, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      sessionId,
      updates.displayName ?? null,
      updates.pinned ? 1 : 0,
      JSON.stringify(updates.tags ?? []),
      updates.deleted ? 1 : 0
    );
  } else {
    const sets: string[] = ["updated_at = datetime('now')"];
    const params: unknown[] = [];

    if (updates.displayName !== undefined) {
      sets.push("display_name = ?");
      params.push(updates.displayName);
    }
    if (updates.pinned !== undefined) {
      sets.push("pinned = ?");
      params.push(updates.pinned ? 1 : 0);
    }
    if (updates.tags !== undefined) {
      sets.push("tags = ?");
      params.push(JSON.stringify(updates.tags));
    }
    if (updates.deleted !== undefined) {
      sets.push("deleted = ?");
      params.push(updates.deleted ? 1 : 0);
    }

    params.push(sessionId);
    db.prepare(
      `UPDATE session_metadata SET ${sets.join(", ")} WHERE session_id = ?`
    ).run(...params);
  }

  return getSessionMeta(sessionId)!;
}

export function deleteSessionMeta(sessionId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM session_metadata WHERE session_id = ?").run(sessionId);
}
