/**
 * API Key Store - Encrypted storage for API keys in SQLite.
 *
 * Keys are obfuscated using a simple XOR-based encoding with a machine-specific
 * seed (hostname + homedir). This is NOT cryptographically secure encryption --
 * it prevents casual exposure in plaintext but does not protect against a
 * determined attacker with database access. For production use, integrate with
 * OS keychain or a secrets manager.
 */

import Database from "better-sqlite3";
import path from "path";
import os from "os";
import crypto from "crypto";

// ---- Types ----

export interface ApiKeyRecord {
  id: string;
  provider: string;
  name: string;
  key_masked: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  usage_count: number;
  monthly_budget: number | null;
  notes: string;
}

export interface ApiKeyInput {
  provider: string;
  name: string;
  key: string;
  monthly_budget?: number | null;
  notes?: string;
}

// ---- Known providers ----

export const PROVIDERS = [
  { id: "anthropic", name: "Anthropic", prefix: "sk-ant-" },
  { id: "openai", name: "OpenAI", prefix: "sk-" },
  { id: "google", name: "Google AI", prefix: "AI" },
  { id: "mistral", name: "Mistral", prefix: "" },
  { id: "cohere", name: "Cohere", prefix: "" },
  { id: "other", name: "Other", prefix: "" },
] as const;

// ---- Obfuscation ----

function deriveKey(): Buffer {
  const seed = `scc-vault:${os.hostname()}:${os.homedir()}`;
  return crypto.createHash("sha256").update(seed).digest();
}

function obfuscate(plaintext: string): string {
  const key = deriveKey();
  const buf = Buffer.from(plaintext, "utf-8");
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    out[i] = buf[i] ^ key[i % key.length];
  }
  return out.toString("base64");
}

function deobfuscate(encoded: string): string {
  const key = deriveKey();
  const buf = Buffer.from(encoded, "base64");
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    out[i] = buf[i] ^ key[i % key.length];
  }
  return out.toString("utf-8");
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "..." + key.slice(-4);
}

// ---- Database ----

const DB_PATH = path.join(os.homedir(), ".claude", "scc-dashboard.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        name TEXT NOT NULL,
        key_encrypted TEXT NOT NULL,
        key_masked TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        last_used_at TEXT,
        usage_count INTEGER DEFAULT 0,
        monthly_budget REAL,
        notes TEXT DEFAULT ''
      )
    `);
  }
  return _db;
}

// ---- CRUD ----

export function listKeys(): ApiKeyRecord[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, provider, name, key_masked, created_at, updated_at,
            last_used_at, usage_count, monthly_budget, notes
     FROM api_keys ORDER BY created_at DESC`
  ).all();
  return rows as ApiKeyRecord[];
}

export function getKey(id: string): ApiKeyRecord | undefined {
  const db = getDb();
  return db.prepare(
    `SELECT id, provider, name, key_masked, created_at, updated_at,
            last_used_at, usage_count, monthly_budget, notes
     FROM api_keys WHERE id = ?`
  ).get(id) as ApiKeyRecord | undefined;
}

export function getDecryptedKey(id: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT key_encrypted FROM api_keys WHERE id = ?").get(id) as
    | { key_encrypted: string }
    | undefined;
  if (!row) return null;
  return deobfuscate(row.key_encrypted);
}

export function addKey(input: ApiKeyInput): ApiKeyRecord {
  const db = getDb();
  const id = crypto.randomUUID();
  const encrypted = obfuscate(input.key);
  const masked = maskKey(input.key);

  db.prepare(
    `INSERT INTO api_keys (id, provider, name, key_encrypted, key_masked, monthly_budget, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.provider,
    input.name,
    encrypted,
    masked,
    input.monthly_budget ?? null,
    input.notes ?? ""
  );

  return getKey(id)!;
}

export function updateKey(
  id: string,
  updates: { name?: string; key?: string; monthly_budget?: number | null; notes?: string }
): ApiKeyRecord | null {
  const db = getDb();
  const existing = getKey(id);
  if (!existing) return null;

  const sets: string[] = ["updated_at = datetime('now')"];
  const params: unknown[] = [];

  if (updates.name !== undefined) {
    sets.push("name = ?");
    params.push(updates.name);
  }
  if (updates.key !== undefined) {
    sets.push("key_encrypted = ?", "key_masked = ?");
    params.push(obfuscate(updates.key), maskKey(updates.key));
  }
  if (updates.monthly_budget !== undefined) {
    sets.push("monthly_budget = ?");
    params.push(updates.monthly_budget);
  }
  if (updates.notes !== undefined) {
    sets.push("notes = ?");
    params.push(updates.notes);
  }

  params.push(id);
  db.prepare(`UPDATE api_keys SET ${sets.join(", ")} WHERE id = ?`).run(...params);

  return getKey(id)!;
}

export function deleteKey(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM api_keys WHERE id = ?").run(id);
  return result.changes > 0;
}

export function recordKeyUsage(id: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE api_keys SET usage_count = usage_count + 1, last_used_at = datetime('now') WHERE id = ?`
  ).run(id);
}
