"use client";

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConvMessage } from "@/components/sessions/conv-message";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { LiveAssistantMessage } from "@/components/chat/live-assistant-message";
import { ChatStatusBar } from "@/components/chat/chat-status-bar";
import { ChatWorkspaceBar } from "@/components/chat/chat-workspace-bar";
import { SplitView } from "@/components/chat/split-view";
import { MarkdownContent } from "@/components/markdown-content";
import { useToast } from "@/components/toast";
import { useChatStream } from "@/hooks/use-chat-stream";
import type { LiveChatMessage, PermissionMode } from "@/lib/chat-types";
import type { SessionInfo, SessionDetail } from "@/components/sessions/types";
import {
  ArrowDown, MessageCircle, Search, X, ChevronsUp, ChevronsDown,
  Wrench, Download, RefreshCw, DollarSign, Send, User, Loader2,
  Terminal, ExternalLink, FileUp, Copy, Check,
} from "lucide-react";
import { shortModel, fmtTokens, fmtCost } from "@/lib/format-utils";
import { ChatCommandMenu } from "@/components/chat/chat-command-menu";
import {
  mergeAllCommands, getFlatFilteredCommands, LOCAL_COMMAND_NAMES, loadToolboxCommands,
} from "@/lib/chat-commands";
import type { ChatCommand } from "@/lib/chat-commands";

function ChatPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
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

  // Live chat state (via streaming hook)
  const [chatInput, setChatInput] = useState("");
  const [chatMode, setChatMode] = useState<"session" | "chat">("chat");
  const [claudeSessionId, setClaudeSessionId] = useState<string>("");

  // CLI capabilities (captured from system.init)
  const [cliSlashCommands, setCliSlashCommands] = useState<{ name: string; description?: string }[]>([]);
  const [cliModel, setCliModel] = useState<string>("");

  // Workspace settings (cwd + permission mode)
  const DEFAULT_CWD = "E:\\claude-projects";
  const [chatCwd, setChatCwd] = useState<string>(DEFAULT_CWD);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("default");
  const [chatProvider, setChatProvider] = useState<string>("claude");
  const [chatModel, setChatModel] = useState<string>("");
  const [compareMode, setCompareMode] = useState(false);
  const [compareRightProvider, setCompareRightProvider] = useState<string>("codex");

  // Available providers (fetched once to validate provider selection)
  const [availableProviders, setAvailableProviders] = useState<Set<string> | null>(null);

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then((data) => {
        if (data.providers) {
          const avail = new Set<string>(
            data.providers.filter((p: { available: boolean }) => p.available).map((p: { name: string }) => p.name)
          );
          setAvailableProviders(avail);
        }
      })
      .catch(() => {
        setAvailableProviders(new Set(["claude"]));
      });
  }, []);

  // Sync from localStorage after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    const savedCwd = localStorage.getItem("chat-cwd");
    const savedPermission = localStorage.getItem("chat-permission-mode") as PermissionMode | null;
    const savedProvider = localStorage.getItem("chat-provider");
    const savedCompareRight = localStorage.getItem("chat-compare-right");
    const savedModel = localStorage.getItem("chat-model");
    if (savedCwd) setChatCwd(savedCwd);
    if (savedPermission) setPermissionMode(savedPermission);
    if (savedProvider) setChatProvider(savedProvider);
    if (savedModel) setChatModel(savedModel);
    if (savedCompareRight) setCompareRightProvider(savedCompareRight);
  }, []);

  // Once available providers are known, validate current selection
  useEffect(() => {
    if (!availableProviders) return; // still loading
    if (!availableProviders.has(chatProvider)) {
      setChatProvider("claude");
      localStorage.setItem("chat-provider", "claude");
    }
  }, [availableProviders, chatProvider]);

  // Streaming hook
  const {
    messages: chatMessages, setMessages: setChatMessages,
    sending: chatSending, currentPhase, elapsedMs,
    send: chatSend, cancel: chatCancel, clearMessages,
  } = useChatStream({
    onSessionId: setClaudeSessionId,
    onModel: setCliModel,
    onSlashCommands: setCliSlashCommands,
  });

  // Command menu state
  const [cmdMenuIndex, setCmdMenuIndex] = useState(0);
  const [cmdMenuDismissed, setCmdMenuDismissed] = useState(false);

  // Copy ID state
  const [idCopied, setIdCopied] = useState(false);

  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastMessageCountRef = useRef(0);
  const chatInputRef = useRef(chatInput);

  // Toolbox commands (reloaded when provider changes)
  const [toolboxCommands, setToolboxCommands] = useState<ChatCommand[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadToolboxCommands(chatProvider).then((cmds) => {
      if (!cancelled) setToolboxCommands(cmds);
    });
    return () => { cancelled = true; };
  }, [chatProvider]);

  // Derived: merged command list (provider-aware)
  const allCommands = useMemo(
    () => mergeAllCommands({ provider: chatProvider, cliSlashCommands, toolboxCommands }),
    [chatProvider, cliSlashCommands, toolboxCommands],
  );
  const showCommandMenu = chatInput.startsWith("/") && !chatSending && !cmdMenuDismissed;

  // Track whether user manually cleared the session (to avoid URL re-triggering)
  const manualClearRef = useRef(false);

  // URL deep-linking
  useEffect(() => {
    const sessionParam = searchParams.get("session");
    if (sessionParam && !selectedSessionKey && !manualClearRef.current) {
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
    setCompareMode(false); // Exit compare mode when viewing a session
    clearMessages();
    setClaudeSessionId("");

    // Auto-set provider based on session's provider (only if available)
    const isCodexSession = selectedSessionKey.startsWith("__codex__|");
    const sessionProvider = isCodexSession && availableProviders?.has("codex") ? "codex" : "claude";
    setChatProvider(sessionProvider);
    localStorage.setItem("chat-provider", sessionProvider);

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
  }, [selectedSessionKey, clearMessages]);

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

  const handleScroll = useCallback(() => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
  }, []);

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
  const convSearchLower = useMemo(() => convSearch.trim().toLowerCase(), [convSearch]);
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

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [chatInput]);

  // Drag-and-drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const fileRefs = files.map((f) => `[File: ${f.name}]`).join(" ");
    setChatInput((prev) => (prev ? `${prev} ${fileRefs}` : fileRefs));
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Execute built-in commands locally
  const executeBuiltinCommand = useCallback((name: string) => {
    const makeMsg = (content: string): LiveChatMessage => ({
      id: crypto.randomUUID(),
      role: "assistant",
      text: content,
      thinkingContent: "",
      toolCalls: [],
      timestamp: Date.now(),
      phase: "complete",
    });

    switch (name) {
      case "/help": {
        const lines = allCommands.map((c) => `\`${c.name}\` — ${c.description}`).join("\n");
        setChatMessages((prev) => [...prev, makeMsg(`**Available Commands**\n\n${lines}`)]);
        break;
      }
      case "/clear":
        clearMessages();
        toast("Conversation cleared");
        break;
      case "/model": {
        const model = cliModel || "Unknown (send a message first to detect)";
        setChatMessages((prev) => [...prev, makeMsg(`**Current Model:** ${model}`)]);
        break;
      }
      case "/cost": {
        setChatMessages((prev) => {
          const total = prev.filter((m) => m.cost != null).reduce((s, m) => s + (m.cost ?? 0), 0);
          return [...prev, makeMsg(`**Session Cost:** $${total.toFixed(4)}\n**Messages:** ${prev.length}`)];
        });
        break;
      }
    }
  }, [allCommands, cliModel, toast, setChatMessages, clearMessages]);

  // Send chat message via Claude Code CLI (streaming)
  const handleSend = useCallback(async (overrideMessage?: string) => {
    const text = (overrideMessage ?? chatInputRef.current).trim();
    if (!text || chatSending) return;
    setChatInput("");
    await chatSend(text, {
      sessionId: activeSessionId,
      cwd: chatCwd || undefined,
      permissionMode,
      provider: chatProvider,
      model: chatModel || undefined,
    });
  }, [chatSending, activeSessionId, chatSend, chatCwd, permissionMode, chatProvider, chatModel]);

  // Handle ?run= parameter from Toolbox Run buttons
  const runHandledRef = useRef(false);
  useEffect(() => {
    const runParam = searchParams.get("run");
    if (runParam && !runHandledRef.current) {
      runHandledRef.current = true;
      setChatMode("chat");
      setSelectedSessionKey("");
      setSessionDetail(null);
      setTimeout(() => {
        setChatInput(runParam);
        handleSend(runParam);
      }, 200);
      router.replace("/chat", { scroll: false });
    }
  }, [searchParams, router, handleSend]);

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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // ESC during sending → cancel takes priority
    if (e.key === "Escape" && chatSending) {
      e.preventDefault();
      chatCancel();
      return;
    }

    if (showCommandMenu) {
      const flat = getFlatFilteredCommands(allCommands, chatInputRef.current);

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
  }, [chatSending, chatCancel, showCommandMenu, allCommands, cmdMenuIndex, handleCommandSelect, handleSend]);

  const startNewChat = () => {
    manualClearRef.current = true; // Prevent URL effect from re-selecting
    setSelectedSessionKey("");
    setSessionDetail(null);
    clearMessages();
    setChatMode("chat");
    setChatInput("");
    setClaudeSessionId("");
    // Clear URL query params so the session deep-link effect doesn't re-select
    router.replace("/chat", { scroll: false });
    setTimeout(() => {
      inputRef.current?.focus();
      manualClearRef.current = false; // Allow future URL deep-links
    }, 500);
  };

  const isSessionActive = useMemo(() => {
    if (!selectedSessionKey) return false;
    const session = sessions.find((s) => `${s.project}|${s.id}` === selectedSessionKey);
    return session ? Date.now() - session.lastActive < 5 * 60 * 1000 : false;
  }, [selectedSessionKey, sessions]);

  const isViewingSession = chatMode === "session" && sessionDetail;

  // Last tool name for status bar
  const lastToolName = useMemo(() => {
    if (!chatMessages.length) return undefined;
    const last = chatMessages[chatMessages.length - 1];
    if (last?.role === "assistant" && last.toolCalls.length > 0) {
      return last.toolCalls[last.toolCalls.length - 1].name;
    }
    return undefined;
  }, [chatMessages]);

  return (
    <div className="flex -mx-3 sm:-mx-4 lg:-mx-6 -mb-3 sm:-mb-4 lg:-mb-6 -mt-14 sm:-mt-14 lg:-mt-6 h-[calc(100vh)] overflow-hidden">
      {/* Sidebar - hidden on mobile, shown on lg+ */}
      <div className="hidden lg:block">
        <ChatSidebar
          sessions={sessions}
          selectedKey={selectedSessionKey}
          onSelect={setSelectedSessionKey}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((p) => !p)}
          loading={loadingSessions}
          onNewChat={startNewChat}
          isChatMode={chatMode === "chat"}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="border-b bg-card px-3 sm:px-4 py-2.5 flex items-center gap-2 flex-shrink-0">
          {isViewingSession ? (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{sessionDetail.projectName}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span>{sessionDetail.startTime ? new Date(sessionDetail.startTime).toLocaleString("zh-CN") : ""}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(sessionDetail.id);
                      setIdCopied(true);
                      setTimeout(() => setIdCopied(false), 1500);
                    }}
                    className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded border bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    title={`Click to copy: ${sessionDetail.id}`}
                  >
                    {idCopied ? <Check className="h-2.5 w-2.5 text-green-500" /> : <Copy className="h-2.5 w-2.5" />}
                    {sessionDetail.id.slice(0, 8)}...
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                {sessionDetail.model && (
                  <Badge variant="secondary" className="text-xs hidden sm:inline-flex">{shortModel(sessionDetail.model)}</Badge>
                )}
                {isSessionActive && (
                  <Button
                    variant={autoRefresh ? "default" : "outline"} size="sm" className="text-xs h-8 sm:h-7 touch-manipulation"
                    onClick={() => setAutoRefresh(!autoRefresh)}
                  >
                    <RefreshCw className={`h-3 w-3 sm:mr-1 ${autoRefresh ? "animate-spin" : ""}`} /><span className="hidden sm:inline">Live</span>
                  </Button>
                )}
                <Button variant={showTools ? "default" : "outline"} size="sm" className="text-xs h-8 sm:h-7 touch-manipulation" onClick={() => setShowTools(!showTools)}>
                  <Wrench className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Tools</span>
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-8 sm:h-7 hidden sm:inline-flex touch-manipulation" onClick={exportAsMarkdown}>
                  <Download className="h-3 w-3 mr-1" />Export
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-8 sm:h-7 hidden md:inline-flex touch-manipulation"
                  onClick={() => {
                    const [project, id] = selectedSessionKey.split("|");
                    router.push(`/sessions?highlight=${encodeURIComponent(id)}`);
                  }}
                  title="View in Sessions page"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />Sessions
                </Button>
                <Badge variant="outline" className="text-xs font-mono hidden sm:inline-flex">
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
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(claudeSessionId);
                      setIdCopied(true);
                      setTimeout(() => setIdCopied(false), 1500);
                    }}
                    className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded border bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    title={`Click to copy: ${claudeSessionId}`}
                  >
                    {idCopied ? <Check className="h-2.5 w-2.5 text-green-500" /> : <Copy className="h-2.5 w-2.5" />}
                    {claudeSessionId.slice(0, 8)}...
                  </button>
                )}
                {cliModel && (
                  <Badge variant="secondary" className="text-xs">{shortModel(cliModel)}</Badge>
                )}
                <Button variant={showTools ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setShowTools(!showTools)}>
                  <Wrench className="h-3 w-3 mr-1" />Tools
                </Button>
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

        {/* Split view (compare mode) */}
        {compareMode && (
          <SplitView
            leftProvider={chatProvider}
            rightProvider={compareRightProvider}
            cwd={chatCwd || undefined}
            permissionMode={permissionMode}
            showTools={showTools}
          />
        )}

        {/* Chat area */}
        {!compareMode && <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto relative">
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
                    {(chatProvider === "codex" ? [
                      { name: "/help", desc: "Commands" },
                      { name: "/model", desc: "Model" },
                      { name: "/config", desc: "Config" },
                      { name: "/status", desc: "Status" },
                      { name: "/compact", desc: "Compact" },
                    ] : [
                      { name: "/help", desc: "Commands" },
                      { name: "/commit", desc: "Commit" },
                      { name: "/review-pr", desc: "Review PR" },
                      { name: "/model", desc: "Model" },
                      { name: "/cost", desc: "Cost" },
                    ]).map((qa) => (
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
            <div className="divide-y divide-border/30">
              {chatMessages.map((msg) =>
                msg.role === "user" ? (
                  <div key={msg.id} className="flex gap-3 py-3 px-4 bg-blue-50/50 dark:bg-blue-950/20">
                    <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-blue-100 dark:bg-blue-900">
                      <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold">You</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <MarkdownContent content={msg.text} className="text-sm" />
                    </div>
                  </div>
                ) : (
                  <LiveAssistantMessage key={msg.id} message={msg} showTools={showTools} providerLabel={chatProvider === "codex" ? "Codex" : "Claude"} />
                )
              )}
            </div>
          )}
        </div>}

        {/* Streaming status bar */}
        {!compareMode && chatSending && currentPhase && currentPhase !== "complete" && (
          <ChatStatusBar
            phase={currentPhase}
            elapsedMs={elapsedMs}
            toolName={lastToolName}
            onCancel={chatCancel}
            providerLabel={chatProvider === "codex" ? "Codex" : "Claude"}
          />
        )}

        {/* Status bar (session mode) */}
        {isViewingSession && (
          <div className="border-t bg-muted/30 px-4 py-2 flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
            <span>{visible.length} messages</span>
            <span>{fmtTokens(sessionDetail.totalInputTokens)} in / {fmtTokens(sessionDetail.totalOutputTokens)} out</span>
            {sessionDetail.cacheReadTokens > 0 && <span>{fmtTokens(sessionDetail.cacheReadTokens)} cache</span>}
            <span className="ml-auto font-mono">{fmtCost(sessionDetail.estimatedCost)}</span>
          </div>
        )}

        {/* Workspace settings bar (always visible so permission mode can be switched anytime) */}
        <ChatWorkspaceBar
          cwd={chatCwd}
          onCwdChange={(p) => { setChatCwd(p); localStorage.setItem("chat-cwd", p); }}
          permissionMode={permissionMode}
          onPermissionModeChange={(m) => { setPermissionMode(m); localStorage.setItem("chat-permission-mode", m); }}
          provider={chatProvider}
          onProviderChange={(p) => { setChatProvider(p); localStorage.setItem("chat-provider", p); setChatModel(""); }}
          model={chatModel}
          onModelChange={(m) => { setChatModel(m); localStorage.setItem("chat-model", m); }}
          compareMode={compareMode}
          onCompareModeChange={(enabled) => {
            if (enabled) {
              // Force left=claude, right=codex for compare
              setChatProvider("claude");
              setCompareRightProvider("codex");
              localStorage.setItem("chat-provider", "claude");
              setChatMode("chat");
            }
            setCompareMode(enabled);
          }}
          compareDisabled={!availableProviders?.has("codex")}
          disabled={chatSending}
        />

        {/* Chat input — visible when not in compare mode */}
        {!loading && !compareMode && (
          <div
            className="border-t bg-card px-4 py-3 flex-shrink-0 relative"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Drag-and-drop overlay */}
            {isDragging && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary/50 rounded-lg pointer-events-none">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <FileUp className="h-5 w-5" />
                  <span>Drop files here</span>
                </div>
              </div>
            )}
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
                    ? "Continue this session... (Shift+Enter for newline, / for commands)"
                    : "Message Claude Code... (Shift+Enter for newline, / for commands)"}
                  className="flex-1 resize-none bg-muted rounded-xl px-3 sm:px-4 py-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px] max-h-[200px] touch-manipulation"
                  rows={1}
                  disabled={chatSending}
                  role="combobox"
                  aria-expanded={showCommandMenu}
                  aria-controls={showCommandMenu ? "cmd-menu" : undefined}
                  aria-activedescendant={showCommandMenu ? `cmd-item-${cmdMenuIndex}` : undefined}
                />
                <Button
                  onClick={() => chatSending ? chatCancel() : handleSend()}
                  disabled={!chatSending && !chatInput.trim()}
                  className="h-11 w-11 rounded-xl p-0 flex-shrink-0 touch-manipulation"
                  variant={chatSending ? "destructive" : "default"}
                >
                  {chatSending ? <X className="h-4 w-4" /> : <Send className="h-4 w-4" />}
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
