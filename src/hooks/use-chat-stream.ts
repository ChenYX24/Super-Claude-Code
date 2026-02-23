import { useState, useRef, useCallback, useEffect } from "react";
import type { LiveChatMessage, StreamPhase, ChatSendOptions } from "@/lib/chat-types";
import { parseAssistantEvent } from "@/lib/chat-types";

interface UseChatStreamCallbacks {
  onSessionId?: (id: string) => void;
  onModel?: (model: string) => void;
  onSlashCommands?: (cmds: { name: string; description?: string }[]) => void;
}

export interface UseChatStreamReturn {
  messages: LiveChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<LiveChatMessage[]>>;
  sending: boolean;
  currentPhase: StreamPhase | null;
  elapsedMs: number;
  send: (text: string, options?: ChatSendOptions) => Promise<void>;
  cancel: () => void;
  clearMessages: () => void;
}

export function useChatStream(callbacks: UseChatStreamCallbacks = {}): UseChatStreamReturn {
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<StreamPhase | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Elapsed time ticker
  useEffect(() => {
    if (sending) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 500);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sending]);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setCurrentPhase("cancelled");
    setSending(false);
    // Mark the last assistant message as cancelled
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === "assistant" && last.phase !== "complete") {
        return [...prev.slice(0, -1), { ...last, phase: "cancelled" as StreamPhase }];
      }
      return prev;
    });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentPhase(null);
    setElapsedMs(0);
  }, []);

  const send = useCallback(async (text: string, options?: ChatSendOptions) => {
    if (sending) return;

    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: LiveChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      thinkingContent: "",
      toolCalls: [],
      timestamp: Date.now(),
      phase: "complete",
    };

    const assistantId = crypto.randomUUID();
    const assistantMsg: LiveChatMessage = {
      id: assistantId,
      role: "assistant",
      text: "",
      thinkingContent: "",
      toolCalls: [],
      timestamp: Date.now(),
      phase: "connecting",
      startedAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setSending(true);
    setCurrentPhase("connecting");
    setElapsedMs(0);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId: options?.sessionId || undefined,
          cwd: options?.cwd || undefined,
          permissionMode: options?.permissionMode || undefined,
          allowedTools: options?.allowedTools || undefined,
          provider: options?.provider || undefined,
          model: options?.model || undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, text: `Error: ${err.error || "Failed to get response"}`, phase: "error" as StreamPhase }
              : m
          )
        );
        setSending(false);
        setCurrentPhase("error");
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);

          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;

          try {
            const event = JSON.parse(payload);

            if (event.type === "system" && event.session_id) {
              callbacksRef.current.onSessionId?.(event.session_id);
              if (event.model) callbacksRef.current.onModel?.(event.model);
              if (event.slash_commands) {
                // CLI returns string[] but we need {name, description}[]
                const cmds = Array.isArray(event.slash_commands)
                  ? event.slash_commands.map((c: string | { name: string; description?: string }) =>
                      typeof c === "string" ? { name: c } : c
                    )
                  : [];
                callbacksRef.current.onSlashCommands?.(cmds);
              }
            } else if (event.type === "assistant" && event.message?.content) {
              const parsed = parseAssistantEvent(event);
              setCurrentPhase(parsed.phase);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        text: parsed.text,
                        thinkingContent: parsed.thinkingContent,
                        toolCalls: parsed.toolCalls,
                        phase: parsed.phase,
                      }
                    : m
                )
              );
            } else if (event.type === "result") {
              if (event.session_id) callbacksRef.current.onSessionId?.(event.session_id);
              const finalText = event.result
                ? typeof event.result === "string"
                  ? event.result.trim()
                  : ""
                : "";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        text: m.text || finalText || "(Session completed with no text output)",
                        phase: "complete" as StreamPhase,
                        cost: event.cost_usd,
                        durationMs: event.duration_ms,
                      }
                    : m
                )
              );
              setCurrentPhase("complete");
            } else if (event.type === "error") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, text: `Error: ${event.error}`, phase: "error" as StreamPhase }
                    : m
                )
              );
              setCurrentPhase("error");
            }
          } catch (parseErr) {
            console.warn("[ChatStream] Malformed JSON event:", payload, parseErr);
          }
        }
      }

      // Ensure loading state is cleared and message has displayable text
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m;
          if (m.phase === "cancelled") return m;
          const needsPhase = m.phase !== "complete" && m.phase !== "error";
          const needsText = !m.text.trim();
          if (!needsPhase && !needsText) return m;
          return {
            ...m,
            phase: needsPhase ? ("complete" as StreamPhase) : m.phase,
            text: needsText ? "No response received." : m.text,
          };
        })
      );
      setCurrentPhase((prev) => (prev === "cancelled" ? prev : "complete"));
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // Already handled by cancel()
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                text: "Error: Failed to connect to Claude Code. Make sure the CLI is installed and on your PATH.",
                phase: "error" as StreamPhase,
              }
            : m
        )
      );
      setCurrentPhase("error");
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }, [sending]);

  return { messages, setMessages, sending, currentPhase, elapsedMs, send, cancel, clearMessages };
}
