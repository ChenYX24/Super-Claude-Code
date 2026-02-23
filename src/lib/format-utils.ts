/**
 * Shared formatting utilities for the dashboard
 */

export function fmtCost(n: number): string {
  return "$" + n.toFixed(2);
}

export function fmtTokens(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toString();
}

export function timeAgo(ms: number): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function formatDT(ms: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function shortModel(m?: string): string {
  if (!m) return "";
  // Claude models
  if (m.includes("opus")) return "Opus";
  if (m.includes("sonnet")) return "Sonnet";
  if (m.includes("haiku")) return "Haiku";
  // Codex / OpenAI models
  if (m.includes("gpt-5.2")) return "GPT-5.2";
  if (m.includes("gpt-5.3")) return "GPT-5.3";
  if (m.includes("gpt-4.1")) return "GPT-4.1";
  if (m === "o3-pro") return "o3-Pro";
  if (m === "o3") return "o3";
  if (m === "o4-mini") return "o4-Mini";
  return m;
}
