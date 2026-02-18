"use client";

import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/markdown-content";
import { TOOL_CONFIG, DEFAULT_TOOL_CONFIG } from "@/components/sessions/conv-message";
import type { SessionInfo, SessionDetail, SessionMessage } from "@/components/sessions/types";
import {
  User, Bot, Brain, ChevronDown, ChevronRight, ArrowDown, MessageCircle,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { shortModel, fmtTokens, fmtCost } from "@/lib/format-utils";

export default function ChatPage() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [selectedSessionKey, setSelectedSessionKey] = useState<string>("");
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);

  // Fetch sessions list
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch("/api/sessions");
        const data = await res.json();
        setSessions(data.recentSessions || []);
      } catch (err) {
        console.error("Failed to fetch sessions:", err);
      }
    };
    fetchSessions();
  }, []);

  // Fetch session detail when selection changes
  useEffect(() => {
    if (!selectedSessionKey) return;

    const fetchDetail = async () => {
      setLoading(true);
      try {
        const [project, id] = selectedSessionKey.split("|");
        const res = await fetch(`/api/sessions/${encodeURIComponent(project)}/${id}`);
        if (res.ok) {
          const detail = await res.json();
          setSessionDetail(detail);
          lastMessageCountRef.current = detail.messages.length;
        } else {
          setSessionDetail(null);
        }
      } catch (err) {
        console.error("Failed to fetch session detail:", err);
        setSessionDetail(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [selectedSessionKey]);

  // Auto-refresh for active sessions (lastActive < 5 min)
  useEffect(() => {
    if (!selectedSessionKey || !sessionDetail || !autoRefresh) return;

    const session = sessions.find((s) => `${s.project}|${s.id}` === selectedSessionKey);
    if (!session) return;

    const isActive = Date.now() - session.lastActive < 5 * 60 * 1000;
    if (!isActive) return;

    const interval = setInterval(async () => {
      try {
        const [project, id] = selectedSessionKey.split("|");
        const res = await fetch(`/api/sessions/${encodeURIComponent(project)}/${id}`);
        if (res.ok) {
          const detail = await res.json();
          setSessionDetail(detail);

          // Auto-scroll on new messages
          if (detail.messages.length > lastMessageCountRef.current) {
            lastMessageCountRef.current = detail.messages.length;
            scrollToBottom();
          }
        }
      } catch (err) {
        console.error("Auto-refresh failed:", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedSessionKey, sessionDetail, sessions, autoRefresh]);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  // Scroll to bottom on initial load
  useEffect(() => {
    if (sessionDetail && chatContainerRef.current) {
      scrollToBottom();
    }
  }, [sessionDetail]);

  // Track scroll position for "jump to bottom" button
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="border-b bg-card px-4 py-3 flex items-center gap-4 flex-shrink-0">
        <MessageCircle className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">Chat</h1>

        {/* Session selector */}
        <div className="flex-1 max-w-md">
          <Select value={selectedSessionKey} onValueChange={setSelectedSessionKey}>
            <SelectTrigger>
              <SelectValue placeholder="Select a session..." />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((session) => (
                <SelectItem key={`${session.project}|${session.id}`} value={`${session.project}|${session.id}`}>
                  <div className="flex flex-col items-start">
                    <div className="font-medium">
                      {session.firstMessage?.slice(0, 60) || session.projectName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {session.projectName} • {new Date(session.lastActive).toLocaleDateString()}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Session info */}
        {sessionDetail && (
          <div className="flex items-center gap-2 ml-auto">
            {sessionDetail.model && (
              <Badge variant="secondary">{shortModel(sessionDetail.model)}</Badge>
            )}
            <span className="text-sm text-muted-foreground">
              {fmtCost(sessionDetail.estimatedCost)}
            </span>
          </div>
        )}
      </div>

      {/* Chat area */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Loading session...</div>
          </div>
        )}

        {!loading && !sessionDetail && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageCircle className="h-12 w-12 mb-4 opacity-20" />
            <p>Select a session to view the conversation</p>
          </div>
        )}

        {!loading && sessionDetail && (
          <div className="max-w-4xl mx-auto px-4 py-6">
            {sessionDetail.messages.map((msg) => (
              <ChatMessage key={msg.uuid} msg={msg} />
            ))}
          </div>
        )}
      </div>

      {/* Status bar */}
      {sessionDetail && (
        <div className="border-t bg-muted/30 px-4 py-2 flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
          <span>{sessionDetail.messages.length} messages</span>
          <span>
            {fmtTokens(sessionDetail.totalInputTokens)} in / {fmtTokens(sessionDetail.totalOutputTokens)} out
          </span>
          {sessionDetail.cacheReadTokens > 0 && (
            <span>{fmtTokens(sessionDetail.cacheReadTokens)} cache</span>
          )}
          <span className="ml-auto">{fmtCost(sessionDetail.estimatedCost)}</span>
        </div>
      )}

      {/* Jump to bottom button */}
      {showScrollButton && (
        <Button
          size="sm"
          className="fixed bottom-24 right-8 rounded-full shadow-lg"
          onClick={scrollToBottom}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// Chat Message Component
function ChatMessage({ msg }: { msg: SessionMessage }) {
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());
  const isUser = msg.role === "user";
  const hasContent = msg.content.trim().length > 0;
  const hasTools = msg.toolUse && msg.toolUse.length > 0;
  const hasThinking = !!msg.thinkingContent;

  if (!hasContent && !hasTools && !hasThinking) return null;

  const toggleToolExpanded = (index: number) => {
    const newExpanded = new Set(expandedTools);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedTools(newExpanded);
  };

  const parseToolInput = (tool: { name: string; input?: string }) => {
    if (!tool.input) return {};
    try {
      return JSON.parse(tool.input);
    } catch {
      return { raw: tool.input };
    }
  };

  return (
    <div className="mb-6">
      {/* Thinking block (before message) */}
      {hasThinking && (
        <div className="mb-3 max-w-[80%]">
          <button
            onClick={() => setThinkingExpanded(!thinkingExpanded)}
            className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 hover:underline mb-1"
          >
            <Brain className="h-3.5 w-3.5" />
            <span className="italic">Thinking...</span>
            {thinkingExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
          {thinkingExpanded && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3 text-sm italic text-amber-900 dark:text-amber-100 whitespace-pre-wrap">
              {msg.thinkingContent}
            </div>
          )}
        </div>
      )}

      {/* Message bubble */}
      <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
        <div className={`flex gap-3 max-w-[80%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
          {/* Avatar */}
          <div
            className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              isUser
                ? "bg-blue-100 dark:bg-blue-900"
                : "bg-purple-100 dark:bg-purple-900"
            }`}
          >
            {isUser ? (
              <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            ) : (
              <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            )}
          </div>

          {/* Message content */}
          <div className="flex-1 min-w-0">
            {/* Message header */}
            <div className={`flex items-center gap-2 mb-1 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
              <span className="text-xs font-semibold">
                {isUser ? "You" : "Claude"}
              </span>
              {msg.model && (
                <Badge variant="secondary" className="text-xs h-4">
                  {shortModel(msg.model)}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(msg.timestamp).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            {/* Tool calls (compact cards) */}
            {hasTools && (
              <div className="mb-2 space-y-1.5">
                {msg.toolUse!.map((tool, i) => {
                  const config = TOOL_CONFIG[tool.name] || DEFAULT_TOOL_CONFIG;
                  const Icon = config.icon;
                  const isExpanded = expandedTools.has(i);
                  const parsedInput = parseToolInput(tool);

                  return (
                    <div
                      key={i}
                      className={`text-xs rounded-lg border ${config.bgColor} ${config.borderColor}`}
                    >
                      {/* Tool header */}
                      <button
                        onClick={() => toggleToolExpanded(i)}
                        className="w-full px-3 py-2 flex items-center gap-2 hover:opacity-80 transition-opacity"
                      >
                        <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${config.color}`} />
                        <span className={`font-mono font-semibold ${config.color}`}>
                          {tool.name}
                        </span>

                        {/* Preview */}
                        {!isExpanded && (
                          <span className="text-muted-foreground truncate flex-1 text-left">
                            {tool.name === "Bash" && parsedInput.command ? (
                              <code className="font-mono">{parsedInput.command.slice(0, 50)}</code>
                            ) : tool.name === "Read" && parsedInput.file_path ? (
                              <span className="font-mono">{parsedInput.file_path.split(/[/\\]/).pop()}</span>
                            ) : tool.name === "Edit" && parsedInput.file_path ? (
                              <span className="font-mono">{parsedInput.file_path.split(/[/\\]/).pop()}</span>
                            ) : tool.name === "Write" && parsedInput.file_path ? (
                              <span className="font-mono">{parsedInput.file_path.split(/[/\\]/).pop()}</span>
                            ) : tool.input ? (
                              tool.input.slice(0, 40)
                            ) : null}
                          </span>
                        )}

                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3 ml-auto flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 ml-auto flex-shrink-0" />
                        )}
                      </button>

                      {/* Expanded content */}
                      {isExpanded && tool.input && (
                        <div className="px-3 pb-2 border-t border-current/10">
                          <pre className="mt-2 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                            {tool.input.slice(0, 500)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Message bubble */}
            {hasContent && (
              <div
                className={`rounded-2xl px-4 py-3 ${
                  isUser
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <MarkdownContent content={msg.content} className="text-sm" />
              </div>
            )}

            {/* Token info */}
            {(msg.inputTokens || msg.outputTokens) && (
              <div className={`text-xs text-muted-foreground mt-1 font-mono ${isUser ? "text-right" : "text-left"}`}>
                {fmtTokens(msg.inputTokens || 0)}in / {fmtTokens(msg.outputTokens || 0)}out
                {msg.cacheRead ? ` / ${fmtTokens(msg.cacheRead)}cache` : ""}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
