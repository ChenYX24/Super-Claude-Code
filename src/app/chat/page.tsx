"use client";

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConvMessage } from "@/components/sessions/conv-message";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { MarkdownContent } from "@/components/markdown-content";
import { useToast } from "@/components/toast";
import type { SessionInfo, SessionDetail, SessionMessage } from "@/components/sessions/types";
import {
  ArrowDown, MessageCircle, Search, X, ChevronsUp, ChevronsDown,
  Wrench, Download, RefreshCw, DollarSign, Send, Bot, User, Loader2,
  Terminal,
} from "lucide-react";
import { shortModel, fmtTokens, fmtCost } from "@/lib/format-utils";
import { ChatCommandMenu } from "@/components/chat/chat-command-menu";
import {
  BUILTIN_COMMANDS, mergeCliCommands, getFlatFilteredCommands, LOCAL_COMMAND_NAMES,
} from "@/lib/chat-commands";
import type { ChatCommand } from "@/lib/chat-commands";

// Chat message for live conversation (not from session)
interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  loading?: boolean;
  cost?: number;
  durationMs?: number;
}

function ChatPageContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Session viewer state
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [selectedSessionKey, setSelectedSessionKey] = useState<string>("");
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showTools, setShowTools] = useState(true);
  const [convSearch, setConvSearch] = useState("");
  const [convSearchMatch, setConvSearchMatch] = useState(0);

  // Live chat state
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatMode, setChatMode] = useState<"session" | "chat">("session");
  const [claudeSessionId, setClaudeSessionId] = useState<string>("");

  // CLI capabilities (captured from system.init)
  const [cliSlashCommands, setCliSlashCommands] = useState<{ name: string; description?: string }[]>([]);
  const [cliModel, setCliModel] = useState<string>("");

  // Command menu state
  const [cmdMenuIndex, setCmdMenuIndex] = useState(0);
  const [cmdMenuDismissed, setCmdMenuDismissed] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastMessageCountRef = useRef(0);
  const chatInputRef = useRef(chatInput);

  // Derived: merged command list
  const allCommands = useMemo(() => mergeCliCommands(cliSlashCommands), [cliSlashCommands]);
  const showCommandMenu = chatInput.startsWith("/") && !chatSending && !cmdMenuDismissed;

  // URL deep-linking
  useEffect(() => {
    const sessionParam = searchParams.get("session");
    if (sessionParam && !selectedSessionKey) {
      setSelectedSessionKey(sessionParam);
      setChatMode("session");
    }
  }, [searchParams, selectedSessionKey]);

  // Fetch sessions list
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch("/api/sessions");
        const data = await res.json();
        setSessions(data.recentSessions || []);
      } catch (err) {
        console.error("Failed to fetch sessions:", err);
      } finally {
        setLoadingSessions(false);
      }
    };
    fetchSessions();
  }, []);

  // Fetch session detail when selection changes
  useEffect(() => {
    if (!selectedSessionKey) return;
    setChatMode("session");
    setChatMessages([]); // clear continuation messages from previous session
    setClaudeSessionId(""); // reset live session tracking

    const fetchDetail = async () => {
      setLoading(true);
      setConvSearch("");
      setConvSearchMatch(0);
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

  // Auto-refresh for active sessions
  useEffect(() => {
    if (!selectedSessionKey || !sessionDetail || !autoRefresh || chatMode !== "session") return;

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
  }, [selectedSessionKey, sessionDetail, sessions, autoRefresh, chatMode]);

  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    if ((sessionDetail || chatMessages.length > 0) && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [sessionDetail, chatMessages]);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
  };

  // Visible messages (filter empty)
  const visible = useMemo(() => {
    if (!sessionDetail) return [];
    return sessionDetail.messages.filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        (m.content.trim() || (m.toolUse && m.toolUse.length > 0) || m.thinkingContent)
    );
  }, [sessionDetail]);

  // Search logic
  const convSearchLower = convSearch.trim().toLowerCase();
  const matchedIndices = useMemo(() => {
    if (!convSearchLower) return [];
    return visible
      .map((m, i) => (m.content.toLowerCase().includes(convSearchLower) ? i : -1))
      .filter((i) => i !== -1);
  }, [visible, convSearchLower]);

  useEffect(() => {
    if (matchedIndices.length > 0 && convSearchMatch >= 0 && convSearchMatch < matchedIndices.length) {
      const msgIdx = matchedIndices[convSearchMatch];
      const msg = visible[msgIdx];
      if (msg) {
        document.getElementById(`msg-${msg.uuid}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [convSearchMatch, convSearch, matchedIndices, visible]);

  // Export
  const exportAsMarkdown = useCallback(() => {
    if (!sessionDetail) return;
    let md = `# Session: ${sessionDetail.projectName}\n`;
    md += `**Date:** ${sessionDetail.startTime} - ${sessionDetail.endTime}\n`;
    md += `**Model:** ${shortModel(sessionDetail.model)}\n`;
    md += `**Cost:** ${fmtCost(sessionDetail.estimatedCost)}\n`;
    md += `**Tokens:** ${fmtTokens(sessionDetail.totalInputTokens)} in / ${fmtTokens(sessionDetail.totalOutputTokens)} out\n\n---\n\n`;
    for (const msg of sessionDetail.messages) {
      if (msg.role !== "user" && msg.role !== "assistant") continue;
      if (!msg.content.trim() && (!msg.toolUse || msg.toolUse.length === 0)) continue;
      md += `## ${msg.role === "user" ? "User" : "Claude"}\n`;
      if (msg.timestamp) md += `*${new Date(msg.timestamp).toLocaleTimeString()}*\n\n`;
      if (msg.content.trim()) md += msg.content.trim() + "\n\n";
      if (msg.toolUse && msg.toolUse.length > 0) {
        for (const tool of msg.toolUse) {
          md += `### Tool: ${tool.name}\n\`\`\`json\n${tool.input?.slice(0, 500)}\n\`\`\`\n\n`;
        }
      }
      md += `---\n\n`;
    }
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${sessionDetail.id.slice(0, 8)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("Exported as Markdown");
  }, [sessionDetail, toast]);

  // Determine which session ID to resume: historical session ID or live chat session ID
  const activeSessionId = useMemo(() => {
    if (claudeSessionId) return claudeSessionId;
    if (selectedSessionKey) {
      const parts = selectedSessionKey.split("|");
      return parts.length > 1 ? parts[1] : undefined;
    }
    return undefined;
  }, [claudeSessionId, selectedSessionKey]);

  // Keep chatInput ref in sync for stable callbacks
  useEffect(() => { chatInputRef.current = chatInput; }, [chatInput]);

  // Reset command menu index and dismissed state when input changes
  useEffect(() => { setCmdMenuIndex(0); setCmdMenuDismissed(false); }, [chatInput]);

  // Execute built-in commands locally
  const executeBuiltinCommand = useCallback((name: string) => {
    switch (name) {
      case "/help": {
        const lines = allCommands.map((c) => `\`${c.name}\` — ${c.description}`).join("\n");
        setChatMessages((prev) => [...prev, {
          id: crypto.randomUUID(), role: "assistant",
          content: `**Available Commands**\n\n${lines}`, timestamp: Date.now(),
        }]);
        break;
      }
      case "/clear":
        setChatMessages([]);
        toast("Conversation cleared");
        break;
      case "/model": {
        const model = cliModel || "Unknown (send a message first to detect)";
        setChatMessages((prev) => [...prev, {
          id: crypto.randomUUID(), role: "assistant",
          content: `**Current Model:** ${model}`, timestamp: Date.now(),
        }]);
        break;
      }
      case "/cost": {
        setChatMessages((prev) => {
          const total = prev.filter((m) => m.cost != null).reduce((s, m) => s + (m.cost ?? 0), 0);
          return [...prev, {
            id: crypto.randomUUID(), role: "assistant",
            content: `**Session Cost:** $${total.toFixed(4)}\n**Messages:** ${prev.length}`,
            timestamp: Date.now(),
          }];
        });
        break;
      }
    }
  }, [allCommands, cliModel, toast]);

  // Send chat message via Claude Code CLI (streaming)
  const handleSend = useCallback(async (overrideMessage?: string) => {
    const text = (overrideMessage ?? chatInputRef.current).trim();
    if (!text || chatSending) return;

    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: text, timestamp: Date.now() };
    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: ChatMsg = { id: assistantMsgId, role: "assistant", content: "", timestamp: Date.now(), loading: true };

    setChatMessages((prev) => [...prev, userMsg, assistantMsg]);
    setChatInput("");
    setChatSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId: activeSessionId || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: `Error: ${err.error || "Failed to get response"}`, loading: false }
              : m
          )
        );
        return;
      }

      // Read SSE stream from Claude Code CLI
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
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
              // Capture session ID + CLI capabilities from init event
              setClaudeSessionId(event.session_id);
              if (event.model) setCliModel(event.model);
              if (event.slash_commands) setCliSlashCommands(event.slash_commands);
            } else if (event.type === "assistant" && event.message?.content) {
              // CLI sends complete assistant message (not token deltas)
              const textParts = event.message.content
                .filter((c: { type: string }) => c.type === "text")
                .map((c: { text: string }) => c.text);
              accumulated = textParts.join("").trim();
              setChatMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: accumulated, loading: false } : m
                )
              );
            } else if (event.type === "result") {
              // Final result with cost/duration metadata
              if (event.session_id) setClaudeSessionId(event.session_id);
              setChatMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: accumulated || (event.result || "").trim(),
                        loading: false,
                        cost: event.cost_usd,
                        durationMs: event.duration_ms,
                      }
                    : m
                )
              );
            } else if (event.type === "error") {
              setChatMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: `Error: ${event.error}`, loading: false }
                    : m
                )
              );
            }
          } catch { /* skip malformed JSON */ }
        }
      }

      // Ensure loading state is cleared
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId && m.loading
            ? { ...m, loading: false, content: accumulated || "No response received." }
            : m
        )
      );
    } catch {
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: "Error: Failed to connect to Claude Code. Make sure the CLI is installed and on your PATH.", loading: false }
            : m
        )
      );
    } finally {
      setChatSending(false);
    }
  }, [chatSending, activeSessionId]);

  // Handle command selection (from menu click or keyboard)
  const handleCommandSelect = useCallback((cmd: ChatCommand) => {
    setChatInput("");
    setCmdMenuIndex(0);
    if (LOCAL_COMMAND_NAMES.includes(cmd.name)) {
      executeBuiltinCommand(cmd.name);
    } else {
      handleSend(cmd.name);
    }
  }, [executeBuiltinCommand, handleSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showCommandMenu) {
      const flat = getFlatFilteredCommands(allCommands, chatInput);

      if (e.key === "ArrowUp" && flat.length > 0) {
        e.preventDefault();
        setCmdMenuIndex((prev) => (prev <= 0 ? flat.length - 1 : prev - 1));
        return;
      }
      if (e.key === "ArrowDown" && flat.length > 0) {
        e.preventDefault();
        setCmdMenuIndex((prev) => (prev >= flat.length - 1 ? 0 : prev + 1));
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (flat.length > 0 && cmdMenuIndex >= 0 && cmdMenuIndex < flat.length) {
          handleCommandSelect(flat[cmdMenuIndex]);
        }
        return;
      }
      if (e.key === "Escape") {
        setCmdMenuDismissed(true);
        return;
      }
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startNewChat = () => {
    setSelectedSessionKey("");
    setSessionDetail(null);
    setChatMessages([]);
    setChatMode("chat");
    setChatInput("");
    setClaudeSessionId("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const isSessionActive = useMemo(() => {
    if (!selectedSessionKey) return false;
    const session = sessions.find((s) => `${s.project}|${s.id}` === selectedSessionKey);
    return session ? Date.now() - session.lastActive < 5 * 60 * 1000 : false;
  }, [selectedSessionKey, sessions]);

  const isViewingSession = chatMode === "session" && sessionDetail;

  return (
    <div className="flex -mx-6 -mb-6 -mt-16 lg:-mt-6 h-[calc(100vh)] overflow-hidden">
      {/* Sidebar */}
      <ChatSidebar
        sessions={sessions}
        selectedKey={selectedSessionKey}
        onSelect={setSelectedSessionKey}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        loading={loadingSessions}
        onNewChat={startNewChat}
        isChatMode={chatMode === "chat"}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="border-b bg-card px-4 py-2.5 flex items-center gap-2 flex-shrink-0">
          {isViewingSession ? (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{sessionDetail.projectName}</div>
                <div className="text-xs text-muted-foreground">
                  {sessionDetail.startTime ? new Date(sessionDetail.startTime).toLocaleString("zh-CN") : ""}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {sessionDetail.model && (
                  <Badge variant="secondary" className="text-xs">{shortModel(sessionDetail.model)}</Badge>
                )}
                {isSessionActive && (
                  <Button
                    variant={autoRefresh ? "default" : "outline"} size="sm" className="text-xs h-7"
                    onClick={() => setAutoRefresh(!autoRefresh)}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${autoRefresh ? "animate-spin" : ""}`} />Live
                  </Button>
                )}
                <Button variant={showTools ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setShowTools(!showTools)}>
                  <Wrench className="h-3 w-3 mr-1" />Tools
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={exportAsMarkdown}>
                  <Download className="h-3 w-3 mr-1" />Export
                </Button>
                <Badge variant="outline" className="text-xs font-mono">
                  <DollarSign className="h-3 w-3" />{fmtCost(sessionDetail.estimatedCost)}
                </Badge>
              </div>
            </>
          ) : (
            <>
              <MessageCircle className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">{chatMode === "chat" ? "New Chat" : "Chat"}</h1>
              <div className="flex items-center gap-1.5 ml-auto">
                {claudeSessionId && (
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {claudeSessionId.slice(0, 8)}
                  </Badge>
                )}
                {chatMessages.length > 0 && (
                  <Badge variant="outline" className="text-xs">{chatMessages.length} messages</Badge>
                )}
              </div>
            </>
          )}
        </div>

        {/* Search bar (session mode only) */}
        {isViewingSession && (
          <div className="border-b px-4 py-1.5 flex items-center gap-2 flex-shrink-0 bg-muted/10">
            <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              placeholder="Search in conversation..."
              value={convSearch}
              onChange={(e) => { setConvSearch(e.target.value); setConvSearchMatch(0); }}
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/60"
            />
            {convSearchLower && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-xs text-muted-foreground font-mono">
                  {matchedIndices.length > 0 ? `${convSearchMatch + 1}/${matchedIndices.length}` : "0/0"}
                </span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={matchedIndices.length === 0}
                  onClick={() => setConvSearchMatch((convSearchMatch - 1 + matchedIndices.length) % matchedIndices.length)}>
                  <ChevronsUp className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={matchedIndices.length === 0}
                  onClick={() => setConvSearchMatch((convSearchMatch + 1) % matchedIndices.length)}>
                  <ChevronsDown className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setConvSearch(""); setConvSearchMatch(0); }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Chat area */}
        <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto relative">
          {/* Session loading */}
          {loading && (
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3 py-3 px-4">
                  <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-20 w-full rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && !isViewingSession && chatMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageCircle className="h-16 w-16 mb-6 opacity-15" />
              {chatMode === "chat" ? (
                <>
                  <p className="text-xl mb-2 font-semibold text-foreground">Start a conversation</p>
                  <p className="text-sm max-w-md text-center">
                    Type a message below to chat with Claude Code CLI.
                    {claudeSessionId && <span className="block mt-1 font-mono text-xs opacity-60">Session: {claudeSessionId.slice(0, 8)}...</span>}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mt-5">
                    {[
                      { name: "/help", desc: "Commands" },
                      { name: "/commit", desc: "Commit" },
                      { name: "/review-pr", desc: "Review PR" },
                      { name: "/model", desc: "Model" },
                      { name: "/cost", desc: "Cost" },
                    ].map((qa) => (
                      <Button
                        key={qa.name}
                        variant="outline"
                        size="sm"
                        className="text-xs rounded-full gap-1.5"
                        onClick={() => {
                          const cmd = allCommands.find((c) => c.name === qa.name);
                          if (cmd) handleCommandSelect(cmd);
                          else handleSend(qa.name);
                        }}
                      >
                        <Terminal className="h-3 w-3" />
                        {qa.name}
                      </Button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xl mb-2 font-semibold text-foreground">Welcome to Chat</p>
                  <p className="text-sm max-w-md text-center mb-4">
                    Select a session from the sidebar to review, or start a new conversation.
                  </p>
                  <Button onClick={startNewChat} size="sm">
                    <MessageCircle className="h-4 w-4 mr-2" />New Chat
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Session messages */}
          {!loading && isViewingSession && (
            <div className="divide-y divide-border/30">
              {visible.map((msg, i) => (
                <ConvMessage
                  key={msg.uuid}
                  msg={msg}
                  showTools={showTools}
                  searchHighlight={convSearchLower}
                  isSearchMatch={convSearchLower ? matchedIndices[convSearchMatch] === i : false}
                />
              ))}
            </div>
          )}

          {/* Live chat messages (new chat or continuation of session) */}
          {chatMessages.length > 0 && (
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === "user" ? "bg-blue-100 dark:bg-blue-900" : "bg-purple-100 dark:bg-purple-900"
                    }`}>
                      {msg.role === "user"
                        ? <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        : <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`flex items-center gap-2 mb-1 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                        <span className="text-xs font-semibold">{msg.role === "user" ? "You" : "Claude"}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className={`rounded-2xl px-4 py-3 ${
                        msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}>
                        {msg.loading ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Claude Code is working...</span>
                          </div>
                        ) : (
                          <MarkdownContent content={msg.content} className="text-sm" />
                        )}
                      </div>
                      {msg.role === "assistant" && !msg.loading && (msg.cost != null && msg.cost > 0) && (
                        <div className="text-[10px] text-muted-foreground mt-1 font-mono flex items-center gap-2">
                          <span>${msg.cost.toFixed(4)}</span>
                          {msg.durationMs != null && <span>{(msg.durationMs / 1000).toFixed(1)}s</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status bar (session mode) */}
        {isViewingSession && (
          <div className="border-t bg-muted/30 px-4 py-2 flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
            <span>{visible.length} messages</span>
            <span>{fmtTokens(sessionDetail.totalInputTokens)} in / {fmtTokens(sessionDetail.totalOutputTokens)} out</span>
            {sessionDetail.cacheReadTokens > 0 && <span>{fmtTokens(sessionDetail.cacheReadTokens)} cache</span>}
            <span className="ml-auto font-mono">{fmtCost(sessionDetail.estimatedCost)}</span>
          </div>
        )}

        {/* Chat input — always visible */}
        {!loading && (
          <div className="border-t bg-card px-4 py-3 flex-shrink-0">
            <div className="max-w-4xl mx-auto relative">
              {/* Slash command menu */}
              {showCommandMenu && (
                <ChatCommandMenu
                  input={chatInput}
                  commands={allCommands}
                  selectedIndex={cmdMenuIndex}
                  onSelect={handleCommandSelect}
                />
              )}
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isViewingSession
                    ? "Continue this session... (/ for commands)"
                    : "Message Claude Code... (/ for commands)"}
                  className="flex-1 resize-none bg-muted rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px] max-h-[120px]"
                  rows={1}
                  disabled={chatSending}
                  role="combobox"
                  aria-expanded={showCommandMenu}
                  aria-controls={showCommandMenu ? "cmd-menu" : undefined}
                  aria-activedescendant={showCommandMenu ? `cmd-item-${cmdMenuIndex}` : undefined}
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!chatInput.trim() || chatSending}
                  className="h-11 w-11 rounded-xl p-0 flex-shrink-0"
                >
                  {chatSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Jump to bottom */}
        {showScrollButton && (
          <div className="absolute bottom-20 right-8 z-10">
            <Button size="sm" className="rounded-full shadow-lg" onClick={scrollToBottom}>
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}
