/**
 * Shared helper functions for bot implementations.
 * Fetches data from the SCC Dashboard API.
 */

import type { SessionSummary, BotStatusInfo } from "./bot-interface";

const startTime = Date.now();

/** Fetch sessions from the dashboard API */
export async function fetchSessions(baseUrl: string): Promise<SessionSummary[]> {
  try {
    const res = await fetch(`${baseUrl}/api/sessions`);
    if (!res.ok) return [];
    const data = await res.json();
    const sessions = data.recentSessions || [];
    return sessions.slice(0, 10).map((s: Record<string, unknown>) => ({
      id: s.id as string,
      project: (s.projectName || s.project || "unknown") as string,
      lastActive: new Date(s.lastActive as number).toLocaleString(),
      messageCount: (s.messageCount || 0) as number,
      status: (s.status || "idle") as string,
      cost: `$${((s.estimatedCost as number) || 0).toFixed(4)}`,
    }));
  } catch {
    return [];
  }
}

/** Fetch dashboard status */
export async function fetchStatus(baseUrl: string): Promise<BotStatusInfo> {
  try {
    const res = await fetch(`${baseUrl}/api/sessions`);
    if (!res.ok) throw new Error("Failed to fetch");
    const data = await res.json();

    const sessions = data.recentSessions || [];
    const activeSessions = sessions.filter(
      (s: Record<string, unknown>) => s.status === "thinking" || s.status === "writing" || s.status === "reading"
    ).length;

    const uptimeMs = Date.now() - startTime;
    const hours = Math.floor(uptimeMs / 3600000);
    const minutes = Math.floor((uptimeMs % 3600000) / 60000);

    return {
      totalSessions: data.totalSessions || sessions.length,
      activeSessions,
      totalProjects: (data.projects || []).length,
      uptime: `${hours}h ${minutes}m`,
    };
  } catch {
    return {
      totalSessions: 0,
      activeSessions: 0,
      totalProjects: 0,
      uptime: "unknown",
    };
  }
}

/** Parse provider prefix from message text. E.g. "codex: question" → { provider: "codex", message: "question" } */
export function parseProviderPrefix(text: string): { provider?: string; message: string } {
  const match = text.match(/^(claude|codex):\s*/i);
  if (match) {
    return { provider: match[1].toLowerCase(), message: text.slice(match[0].length) };
  }
  return { message: text };
}

/** Send a chat message to a provider via dashboard API and collect streamed response */
export async function chatWithProvider(baseUrl: string, message: string, provider?: string, timeoutMs = 30000): Promise<{ content: string; model?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body: Record<string, unknown> = {
      message,
      permissionMode: "plan",
    };
    if (provider) body.provider = provider;

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error((errData as Record<string, string>).error || `HTTP ${res.status}`);
    }

    // Read SSE stream
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let content = "";
    let model: string | undefined;
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const payload = trimmed.slice(6);
        if (payload === "[DONE]") continue;

        try {
          const event = JSON.parse(payload);
          if (event.type === "assistant" && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === "text") {
                content += block.text;
              }
            }
            if (event.message.model) model = event.message.model;
          }
          if (event.type === "content_block_delta" && event.delta?.text) {
            content += event.delta.text;
          }
        } catch {
          // Skip unparseable lines
        }
      }
    }

    return { content, model };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Chat timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw new Error(err instanceof Error ? err.message : "Chat request failed");
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Backward-compatible alias */
export const chatWithClaude = chatWithProvider;
