"use client";

import { Badge } from "@/components/ui/badge";
import { Zap, Moon, Clock, Archive, Star } from "lucide-react";
import { fmtCost, fmtTokens, timeAgo, formatDT, shortModel } from "@/lib/format-utils";
import type { SessionInfo, SessionStatus } from "./types";

// Session status configuration
export const STATUS_CONFIG: Record<SessionStatus, {
  dot: string;
  bg: string;
  border: string;
  glow: string;
  label: string;
  icon: typeof Zap;
  animation?: string;
}> = {
  reading:   { dot: "bg-cyan-400",    bg: "bg-cyan-500/15",    border: "border-cyan-500/50",    glow: "shadow-cyan-500/20 shadow-lg",    label: "Reading",   icon: Zap,     animation: "animate-pulse" },
  thinking:  { dot: "bg-orange-400",  bg: "bg-orange-500/15",  border: "border-orange-500/50",  glow: "shadow-orange-500/20 shadow-lg",  label: "Thinking",  icon: Zap,     animation: "animate-ping" },
  writing:   { dot: "bg-purple-400",  bg: "bg-purple-500/15",  border: "border-purple-500/50",  glow: "shadow-purple-500/20 shadow-lg",  label: "Writing",   icon: Zap,     animation: "animate-pulse" },
  waiting:   { dot: "bg-yellow-400",  bg: "bg-yellow-500/12",  border: "border-yellow-500/40",  glow: "shadow-yellow-500/15 shadow-md",  label: "Waiting",   icon: Moon,    animation: "animate-[pulse_2s_ease-in-out_infinite]" },
  completed: { dot: "bg-green-400",   bg: "bg-green-500/12",   border: "border-green-500/35",   glow: "",                                label: "Completed", icon: Clock },
  error:     { dot: "bg-red-500",     bg: "bg-red-500/15",     border: "border-red-500/50",     glow: "shadow-red-500/20 shadow-md",     label: "Error",     icon: Archive, animation: "animate-pulse" },
  idle:      { dot: "bg-zinc-500",    bg: "bg-zinc-500/8",     border: "border-zinc-500/20",    glow: "",                                label: "Idle",      icon: Archive },
};

export const MODEL_COLORS: Record<string, string> = {
  Opus: "bg-purple-500",
  Sonnet: "bg-blue-500",
  Haiku: "bg-teal-500",
};

// Helper to highlight search matches
export function highlightText(text: string, search: string): React.ReactNode {
  if (!search.trim()) return text;
  const parts = text.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === search.toLowerCase() ?
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-800/60 px-0.5">{part}</mark> : part
  );
}

// Session Grid Block Component
export function SessionBlock({ session, onClick, searchQuery, isFavorite, onToggleFavorite }: {
  session: SessionInfo;
  onClick: () => void;
  searchQuery?: string;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
}) {
  const status = (session.status || "idle") as SessionStatus;
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const model = shortModel(session.model);
  const modelColor = MODEL_COLORS[model] || "bg-zinc-500";

  return (
    <button
      onClick={onClick}
      className={`
        relative group rounded-lg border p-3 text-left transition-all duration-200
        hover:scale-[1.03] hover:shadow-md cursor-pointer
        ${cfg.bg} ${cfg.border} ${cfg.glow}
      `}
      title={`${session.firstMessage || session.id.slice(0, 12)}\n${session.projectName}\n${timeAgo(session.lastActive)}`}
    >
      {/* Status indicator dot with animation */}
      <div className={`absolute top-2 right-2 h-2.5 w-2.5 rounded-full ${cfg.dot} ${cfg.animation || ""}`} />

      {/* Star + Model color bar row */}
      <div className="flex items-center gap-1.5 mb-2">
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(session.id);
            }}
            className={`flex-shrink-0 z-10 transition-colors ${
              isFavorite
                ? "text-yellow-400"
                : "text-muted-foreground/40 hover:text-yellow-400"
            }`}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star className="h-3.5 w-3.5" fill={isFavorite ? "currentColor" : "none"} />
          </button>
        )}
        <div className={`h-1 w-8 rounded-full ${modelColor} opacity-70`} />
      </div>

      {/* Content */}
      <div className="text-xs font-medium truncate leading-tight mb-1 text-foreground/90">
        {searchQuery ? highlightText(session.firstMessage ? session.firstMessage.slice(0, 40) : session.id.slice(0, 10), searchQuery) :
         (session.firstMessage ? session.firstMessage.slice(0, 40) : session.id.slice(0, 10))}
      </div>
      <div className="text-[10px] text-muted-foreground truncate">
        {searchQuery ? highlightText(session.projectName.length > 18 ? "..." + session.projectName.slice(-16) : session.projectName, searchQuery) :
         (session.projectName.length > 18 ? "..." + session.projectName.slice(-16) : session.projectName)}
      </div>

      {/* Footer: time + cost */}
      <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
        <span>{timeAgo(session.lastActive)}</span>
        <span className="font-mono">{fmtCost(session.estimatedCost)}</span>
      </div>

      {/* Hover overlay with more detail */}
      <div className="absolute inset-0 rounded-lg bg-background/95 opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-3 flex flex-col justify-between pointer-events-none">
        <div>
          <div className="text-xs font-semibold truncate mb-1">{session.firstMessage || session.id.slice(0, 16)}</div>
          <div className="text-[10px] text-muted-foreground">{session.projectName}</div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px]">
            {model && <Badge variant="secondary" className="text-[9px] h-4 px-1">{model}</Badge>}
            <Badge variant="outline" className="text-[9px] h-4 px-1">{session.messageCount} msgs</Badge>
            <Badge variant="outline" className={`text-[9px] h-4 px-1 ${cfg.dot.replace("bg-", "text-").replace("-400", "-500").replace("-500", "-600")}`}>
              {cfg.label}
            </Badge>
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{formatDT(session.startTime)}</span>
            <span className="font-mono font-medium">{fmtCost(session.estimatedCost)}</span>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">
            {fmtTokens(session.totalInputTokens)}in / {fmtTokens(session.totalOutputTokens)}out
          </div>
        </div>
      </div>
    </button>
  );
}

// Status Legend Component
export function StatusLegend({ sessions }: { sessions: SessionInfo[] }) {
  const counts: Record<SessionStatus, number> = { reading: 0, thinking: 0, writing: 0, waiting: 0, completed: 0, error: 0, idle: 0 };
  for (const s of sessions) {
    const st = (s.status || "idle") as SessionStatus;
    counts[st] = (counts[st] || 0) + 1;
  }

  const statusOrder: SessionStatus[] = ["reading", "thinking", "writing", "waiting", "completed", "error", "idle"];

  return (
    <div className="flex items-center gap-2.5 text-xs text-muted-foreground flex-wrap">
      {statusOrder.map(status => {
        if (counts[status] === 0) return null;
        const cfg = STATUS_CONFIG[status];
        return (
          <div key={status} className="flex items-center gap-1">
            <div className={`h-2.5 w-2.5 rounded-full ${cfg.dot} ${cfg.animation || ""}`} />
            <span>{cfg.label}</span>
            <span className="font-mono">({counts[status]})</span>
          </div>
        );
      })}
    </div>
  );
}
