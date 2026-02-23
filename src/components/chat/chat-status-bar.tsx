"use client";

import { Brain, Bot, Loader2 } from "lucide-react";
import { TOOL_CONFIG, DEFAULT_TOOL_CONFIG } from "@/components/sessions/conv-message";
import type { StreamPhase } from "@/lib/chat-types";

interface ChatStatusBarProps {
  phase: StreamPhase;
  elapsedMs: number;
  toolName?: string;
  onCancel: () => void;
}

const PHASE_ICON: Record<string, typeof Loader2> = {
  connecting: Loader2,
  thinking: Brain,
  responding: Bot,
};

export function ChatStatusBar({ phase, elapsedMs, toolName, onCancel }: ChatStatusBarProps) {
  const seconds = (elapsedMs / 1000).toFixed(1);

  // Choose icon based on phase
  let Icon: typeof Loader2;
  let label: string;
  let iconColor: string;

  if (phase === "tool_use" && toolName) {
    const config = TOOL_CONFIG[toolName] || DEFAULT_TOOL_CONFIG;
    Icon = config.icon;
    iconColor = config.color;
    label = toolName;
  } else {
    Icon = PHASE_ICON[phase] || Loader2;
    iconColor = phase === "thinking"
      ? "text-amber-500"
      : phase === "responding"
        ? "text-purple-500"
        : "text-muted-foreground";
    label = phase === "thinking"
      ? "Thinking..."
      : phase === "responding"
        ? "Responding..."
        : "Connecting...";
  }

  return (
    <div className="border-t bg-muted/30 px-4 py-2 flex items-center gap-3 text-xs flex-shrink-0 animate-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${iconColor} ${phase === "connecting" ? "animate-spin" : "animate-pulse"}`} />
        <span className="text-muted-foreground truncate">{label}</span>
      </div>
      <span className="text-muted-foreground font-mono tabular-nums flex-shrink-0">{seconds}s</span>
      <button
        onClick={onCancel}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
      >
        <kbd className="px-1.5 py-0.5 rounded border bg-background text-[10px] font-mono">ESC</kbd>
        <span>Cancel</span>
      </button>
    </div>
  );
}
