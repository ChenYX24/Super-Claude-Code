"use client";

import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConvMessage } from "@/components/sessions/conv-message";
import { toSessionMessage, PHASE_LABELS } from "@/lib/chat-types";
import type { LiveChatMessage } from "@/lib/chat-types";
import { fmtCost } from "@/lib/format-utils";

interface Props {
  message: LiveChatMessage;
  showTools: boolean;
}

export function LiveAssistantMessage({ message, showTools }: Props) {
  const { phase } = message;

  // Connecting state — spinner only
  if (phase === "connecting") {
    return (
      <div className="flex gap-3 py-3 px-4">
        <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-purple-100 dark:bg-purple-900">
          <Loader2 className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 animate-spin" />
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2 text-sm text-muted-foreground py-1">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Claude Code is working...</span>
        </div>
      </div>
    );
  }

  const isLive = phase !== "complete" && phase !== "error" && phase !== "cancelled";
  const phaseBadge = isLive ? PHASE_LABELS[phase] : undefined;
  const sessionMsg = toSessionMessage(message);

  return (
    <div>
      <ConvMessage
        msg={sessionMsg}
        showTools={showTools}
        isLive={isLive}
        phaseBadge={phaseBadge}
      />
      {/* Cancelled badge */}
      {phase === "cancelled" && (
        <div className="pl-12 pb-2">
          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 dark:border-amber-700">
            Cancelled
          </Badge>
        </div>
      )}
      {/* Cost/duration metadata */}
      {phase === "complete" && (message.cost != null && message.cost > 0) && (
        <div className="pl-12 pb-2 text-[10px] text-muted-foreground font-mono flex items-center gap-2">
          <span>{fmtCost(message.cost)}</span>
          {message.durationMs != null && <span>{(message.durationMs / 1000).toFixed(1)}s</span>}
        </div>
      )}
    </div>
  );
}
