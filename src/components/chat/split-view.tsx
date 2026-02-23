"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Send, X, User, Loader2, Bot, ArrowDown,
} from "lucide-react";
import { useChatStream } from "@/hooks/use-chat-stream";
import { LiveAssistantMessage } from "./live-assistant-message";
import { MarkdownContent } from "@/components/markdown-content";
import { ChatStatusBar } from "./chat-status-bar";
import { fmtCost } from "@/lib/format-utils";
import type { PermissionMode, LiveChatMessage } from "@/lib/chat-types";

interface SplitViewProps {
  leftProvider: string;
  rightProvider: string;
  cwd?: string;
  permissionMode: PermissionMode;
  showTools: boolean;
}

function ProviderPanel({
  provider,
  messages,
  sending,
  currentPhase,
  elapsedMs,
  showTools,
  onCancel,
}: {
  provider: string;
  messages: LiveChatMessage[];
  sending: boolean;
  currentPhase: string | null;
  elapsedMs: number;
  showTools: boolean;
  onCancel: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const totalCost = messages
    .filter((m) => m.cost != null)
    .reduce((s, m) => s + (m.cost ?? 0), 0);
  const lastMsg = messages[messages.length - 1];
  const lastDuration = lastMsg?.durationMs;

  const lastToolName = (() => {
    if (!messages.length) return undefined;
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && last.toolCalls.length > 0) {
      return last.toolCalls[last.toolCalls.length - 1].name;
    }
    return undefined;
  })();

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Panel header */}
      <div className="border-b bg-card px-3 py-2 flex items-center gap-2 flex-shrink-0">
        <Bot className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold capitalize">{provider}</span>
        {messages.length > 0 && (
          <Badge variant="outline" className="text-[10px] ml-auto">
            {messages.length} msgs
          </Badge>
        )}
        {totalCost > 0 && (
          <Badge variant="outline" className="text-[10px] font-mono">
            {fmtCost(totalCost)}
          </Badge>
        )}
        {lastDuration != null && lastDuration > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {(lastDuration / 1000).toFixed(1)}s
          </Badge>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 && !sending && (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Waiting for prompt...
          </div>
        )}
        <div className="divide-y divide-border/30">
          {messages.map((msg) =>
            msg.role === "user" ? (
              <div key={msg.id} className="flex gap-3 py-3 px-4 bg-blue-50/50 dark:bg-blue-950/20">
                <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-blue-100 dark:bg-blue-900">
                  <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold">You</span>
                  </div>
                  <MarkdownContent content={msg.text} className="text-sm" />
                </div>
              </div>
            ) : (
              <LiveAssistantMessage key={msg.id} message={msg} showTools={showTools} />
            )
          )}
        </div>
      </div>

      {/* Status bar */}
      {sending && currentPhase && currentPhase !== "complete" && (
        <ChatStatusBar
          phase={currentPhase as "connecting" | "thinking" | "tool_use" | "responding"}
          elapsedMs={elapsedMs}
          toolName={lastToolName}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}

export function SplitView({
  leftProvider,
  rightProvider,
  cwd,
  permissionMode,
  showTools,
}: SplitViewProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const leftStream = useChatStream({});
  const rightStream = useChatStream({});

  const anySending = leftStream.sending || rightStream.sending;

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || anySending) return;
    setInput("");

    // Send to both providers in parallel
    const options = { cwd, permissionMode };
    await Promise.all([
      leftStream.send(text, { ...options, provider: leftProvider }),
      rightStream.send(text, { ...options, provider: rightProvider }),
    ]);
  }, [input, anySending, cwd, permissionMode, leftProvider, rightProvider, leftStream, rightStream]);

  const handleCancel = useCallback(() => {
    leftStream.cancel();
    rightStream.cancel();
  }, [leftStream, rightStream]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && anySending) {
      e.preventDefault();
      handleCancel();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Comparison summary: show after both have completed at least one response
  const leftComplete = leftStream.messages.filter((m) => m.role === "assistant" && m.phase === "complete");
  const rightComplete = rightStream.messages.filter((m) => m.role === "assistant" && m.phase === "complete");
  const showComparison = leftComplete.length > 0 && rightComplete.length > 0 && !anySending;

  const leftLastComplete = leftComplete[leftComplete.length - 1];
  const rightLastComplete = rightComplete[rightComplete.length - 1];

  return (
    <div className="flex flex-col h-full">
      {/* Split panels */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 border-r flex flex-col min-w-0">
          <ProviderPanel
            provider={leftProvider}
            messages={leftStream.messages}
            sending={leftStream.sending}
            currentPhase={leftStream.currentPhase}
            elapsedMs={leftStream.elapsedMs}
            showTools={showTools}
            onCancel={leftStream.cancel}
          />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <ProviderPanel
            provider={rightProvider}
            messages={rightStream.messages}
            sending={rightStream.sending}
            currentPhase={rightStream.currentPhase}
            elapsedMs={rightStream.elapsedMs}
            showTools={showTools}
            onCancel={rightStream.cancel}
          />
        </div>
      </div>

      {/* Comparison summary */}
      {showComparison && leftLastComplete && rightLastComplete && (
        <div className="border-t bg-muted/30 px-4 py-2 flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
          <span className="font-medium text-foreground">Comparison:</span>
          <span>
            Cost: {fmtCost(leftLastComplete.cost ?? 0)} vs {fmtCost(rightLastComplete.cost ?? 0)}
          </span>
          {leftLastComplete.durationMs != null && rightLastComplete.durationMs != null && (
            <span>
              Time: {(leftLastComplete.durationMs / 1000).toFixed(1)}s vs {(rightLastComplete.durationMs / 1000).toFixed(1)}s
            </span>
          )}
          <span>
            Length: {leftLastComplete.text.length} vs {rightLastComplete.text.length} chars
          </span>
        </div>
      )}

      {/* Shared input */}
      <div className="border-t bg-card px-4 py-3 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send to both providers... (Enter to send)"
              className="flex-1 resize-none bg-muted rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px] max-h-[120px]"
              rows={1}
              disabled={anySending}
            />
            <Button
              onClick={() => (anySending ? handleCancel() : handleSend())}
              disabled={!anySending && !input.trim()}
              className="h-11 w-11 rounded-xl p-0 flex-shrink-0"
              variant={anySending ? "destructive" : "default"}
            >
              {anySending ? <X className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
