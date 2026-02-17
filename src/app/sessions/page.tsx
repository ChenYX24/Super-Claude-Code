"use client";

import { Suspense, useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkdownContent } from "@/components/markdown-content";
import {
  Clock, FolderOpen, Hash, RefreshCw, ArrowLeft, User, Bot,
  Wrench, Brain, ChevronDown, ChevronRight, Coins, MessageSquare,
  ChevronsUp, ChevronsDown, MapPin, FileText, DollarSign,
  LayoutGrid, List, Zap, Moon, Archive, AlertCircle,
  Terminal, Globe, Users, Edit3, Eye, Search, ArrowUpDown, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---- Types ----

interface SessionInfo {
  id: string; project: string; projectName: string;
  startTime: number; lastActive: number; messageCount: number;
  firstMessage?: string; model?: string;
  totalInputTokens: number; totalOutputTokens: number;
  cacheReadTokens: number; estimatedCost: number;
  status?: string;
}

interface ProjectInfo { path: string; name: string; sessionCount: number; lastActive: number; }
interface SessionsData { projects: ProjectInfo[]; totalSessions: number; recentSessions: SessionInfo[]; }

interface SessionMessage {
  uuid: string; role: "user" | "assistant" | "system"; type: string;
  content: string; timestamp: string; model?: string;
  toolUse?: { name: string; input?: string }[];
  inputTokens?: number; outputTokens?: number; cacheRead?: number;
  thinkingContent?: string; isCheckpoint?: boolean;
}

interface Checkpoint { index: number; content: string; timestamp: string; }

interface SessionDetail {
  id: string; project: string; projectName: string;
  messages: SessionMessage[];
  totalInputTokens: number; totalOutputTokens: number;
  cacheReadTokens: number; estimatedCost: number;
  model?: string; startTime: string; endTime: string;
  checkpoints: Checkpoint[]; contextFiles: string[];
}

// ---- Helpers ----

function timeAgo(ms: number) {
  if (!ms) return "";
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDT(ms: number) {
  if (!ms) return "";
  return new Date(ms).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function fmtTokens(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toString();
}

function fmtCost(n: number): string { return "$" + n.toFixed(2); }

function shortModel(m?: string) {
  if (!m) return "";
  if (m.includes("opus")) return "Opus";
  if (m.includes("sonnet")) return "Sonnet";
  if (m.includes("haiku")) return "Haiku";
  return m;
}

// Helper to highlight search matches
function highlightText(text: string, search: string): React.ReactNode {
  if (!search.trim()) return text;
  const parts = text.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === search.toLowerCase() ?
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-800/60 px-0.5">{part}</mark> : part
  );
}

// ---- Session Status (ClaudeGlance-inspired colors) ----

type SessionStatus = "reading" | "thinking" | "writing" | "waiting" | "completed" | "error" | "idle";

const STATUS_CONFIG: Record<SessionStatus, {
  dot: string; bg: string; border: string; glow: string;
  label: string; icon: typeof Zap; animation?: string;
}> = {
  reading:   { dot: "bg-cyan-400",    bg: "bg-cyan-500/15",    border: "border-cyan-500/50",    glow: "shadow-cyan-500/20 shadow-lg",    label: "Reading",   icon: Zap,     animation: "animate-pulse" },
  thinking:  { dot: "bg-orange-400",  bg: "bg-orange-500/15",  border: "border-orange-500/50",  glow: "shadow-orange-500/20 shadow-lg",  label: "Thinking",  icon: Zap,     animation: "animate-ping" },
  writing:   { dot: "bg-purple-400",  bg: "bg-purple-500/15",  border: "border-purple-500/50",  glow: "shadow-purple-500/20 shadow-lg",  label: "Writing",   icon: Zap,     animation: "animate-pulse" },
  waiting:   { dot: "bg-yellow-400",  bg: "bg-yellow-500/12",  border: "border-yellow-500/40",  glow: "shadow-yellow-500/15 shadow-md",  label: "Waiting",   icon: Moon,    animation: "animate-[pulse_2s_ease-in-out_infinite]" },
  completed: { dot: "bg-green-400",   bg: "bg-green-500/12",   border: "border-green-500/35",   glow: "",                                label: "Completed", icon: Clock },
  error:     { dot: "bg-red-500",     bg: "bg-red-500/15",     border: "border-red-500/50",     glow: "shadow-red-500/20 shadow-md",     label: "Error",     icon: Archive, animation: "animate-pulse" },
  idle:      { dot: "bg-zinc-500",    bg: "bg-zinc-500/8",     border: "border-zinc-500/20",    glow: "",                                label: "Idle",      icon: Archive },
};

const MODEL_COLORS: Record<string, string> = {
  Opus: "bg-purple-500",
  Sonnet: "bg-blue-500",
  Haiku: "bg-teal-500",
};

// ---- Session Grid Block ----

function SessionBlock({ session, onClick, searchQuery }: { session: SessionInfo; onClick: () => void; searchQuery?: string }) {
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

      {/* Model color bar */}
      <div className={`h-1 w-8 rounded-full ${modelColor} mb-2 opacity-70`} />

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

// ---- Status Legend ----

function StatusLegend({ sessions }: { sessions: SessionInfo[] }) {
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

// ---- Session List (supports list + grid view) ----

const PAGE_SIZE = 24;

function SessionList({ data, onSelect, onRefresh, refreshing }: { data: SessionsData; onSelect: (p: string, id: string) => void; onRefresh?: () => void; refreshing?: boolean }) {
  const [filter, setFilter] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "cost" | "messages">("date");
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter and sort sessions
  const sessions = useMemo(() => {
    let filtered = filter ? data.recentSessions.filter(s => s.project === filter) : data.recentSessions;

    // Apply search filter
    if (debouncedSearch.trim()) {
      const search = debouncedSearch.toLowerCase();
      filtered = filtered.filter(s =>
        (s.firstMessage?.toLowerCase().includes(search)) ||
        (s.projectName.toLowerCase().includes(search)) ||
        (s.model?.toLowerCase().includes(search)) ||
        (s.id.toLowerCase().includes(search))
      );
    }

    // Apply sorting
    const sorted = [...filtered];
    if (sortBy === "date") {
      sorted.sort((a, b) => b.lastActive - a.lastActive);
    } else if (sortBy === "cost") {
      sorted.sort((a, b) => b.estimatedCost - a.estimatedCost);
    } else if (sortBy === "messages") {
      sorted.sort((a, b) => b.messageCount - a.messageCount);
    }

    return sorted;
  }, [data.recentSessions, filter, debouncedSearch, sortBy]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedSessions = sessions.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);

  // Reset page when filter/search changes
  useEffect(() => { setCurrentPage(1); }, [filter, debouncedSearch, sortBy]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Sessions</h1>
          {onRefresh && (
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Auto-refresh
          </div>
        </div>
        <div className="flex items-center gap-1 border rounded-lg p-0.5">
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm" className="h-7 w-7 p-0"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm" className="h-7 w-7 p-0"
            onClick={() => setViewMode("list")}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { icon: FolderOpen, label: "Projects", value: data.projects.length },
          { icon: Hash, label: "Sessions", value: data.totalSessions },
          { icon: DollarSign, label: "Est. Cost", value: fmtCost(data.recentSessions.reduce((s, x) => s + x.estimatedCost, 0)) },
          { icon: Clock, label: "Showing", value: sessions.length },
        ].map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Icon className="h-4 w-4" />{label}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Sort Controls */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search sessions (message, project, model, ID)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-[180px]">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Sort by Date</SelectItem>
            <SelectItem value="cost">Sort by Cost</SelectItem>
            <SelectItem value="messages">Sort by Messages</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-wrap gap-2">
          <Badge variant={filter === "" ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilter("")}>All</Badge>
          {data.projects.map(p => (
            <Badge key={p.path} variant={filter === p.path ? "default" : "outline"} className="cursor-pointer"
              onClick={() => setFilter(filter === p.path ? "" : p.path)}>
              {p.name.length > 20 ? "..." + p.name.slice(-18) : p.name} ({p.sessionCount})
            </Badge>
          ))}
        </div>
        {viewMode === "grid" && <StatusLegend sessions={sessions} />}
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {paginatedSessions.map(s => (
            <SessionBlock
              key={`${s.project}-${s.id}`}
              session={s}
              onClick={() => onSelect(s.project, s.id)}
              searchQuery={debouncedSearch}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {paginatedSessions.map(s => {
            const status = (s.status || "idle") as SessionStatus;
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
            return (
              <Card key={`${s.project}-${s.id}`} className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all"
                onClick={() => onSelect(s.project, s.id)}>
                <CardContent className="py-2.5 flex items-center gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${cfg.dot} ${cfg.animation || ""}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {debouncedSearch ? highlightText(s.firstMessage || s.id.slice(0, 12), debouncedSearch) :
                       (s.firstMessage || s.id.slice(0, 12))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDT(s.startTime)} · {timeAgo(s.lastActive)} · {debouncedSearch ? highlightText(s.projectName, debouncedSearch) : s.projectName}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {s.model && <Badge variant="secondary" className="text-xs">{shortModel(s.model)}</Badge>}
                    <Badge variant="outline" className="text-xs font-mono">
                      <DollarSign className="h-3 w-3 mr-0.5" />{fmtCost(s.estimatedCost)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{s.messageCount} lines</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline" size="sm" className="text-xs h-8"
            disabled={safeCurrentPage <= 1}
            onClick={() => setCurrentPage(safeCurrentPage - 1)}
          >
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (safeCurrentPage <= 4) {
                pageNum = i + 1;
              } else if (safeCurrentPage >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = safeCurrentPage - 3 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === safeCurrentPage ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0 text-xs"
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          <Button
            variant="outline" size="sm" className="text-xs h-8"
            disabled={safeCurrentPage >= totalPages}
            onClick={() => setCurrentPage(safeCurrentPage + 1)}
          >
            Next
          </Button>
          <span className="text-xs text-muted-foreground ml-2">
            {sessions.length} sessions
          </span>
        </div>
      )}
    </div>
  );
}

// ---- Tool Configuration ----

const TOOL_CONFIG: Record<string, {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof Terminal;
  category: string;
}> = {
  // Read operations (cyan/blue)
  Read: { color: "text-cyan-600 dark:text-cyan-400", bgColor: "bg-cyan-50 dark:bg-cyan-950/30", borderColor: "border-cyan-200 dark:border-cyan-800", icon: Eye, category: "read" },
  Glob: { color: "text-cyan-600 dark:text-cyan-400", bgColor: "bg-cyan-50 dark:bg-cyan-950/30", borderColor: "border-cyan-200 dark:border-cyan-800", icon: Search, category: "read" },
  Grep: { color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950/30", borderColor: "border-blue-200 dark:border-blue-800", icon: Search, category: "read" },

  // Write operations (purple/violet)
  Write: { color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-50 dark:bg-purple-950/30", borderColor: "border-purple-200 dark:border-purple-800", icon: FileText, category: "write" },
  Edit: { color: "text-violet-600 dark:text-violet-400", bgColor: "bg-violet-50 dark:bg-violet-950/30", borderColor: "border-violet-200 dark:border-violet-800", icon: Edit3, category: "write" },
  NotebookEdit: { color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-50 dark:bg-purple-950/30", borderColor: "border-purple-200 dark:border-purple-800", icon: Edit3, category: "write" },

  // Terminal operations (green)
  Bash: { color: "text-green-600 dark:text-green-400", bgColor: "bg-green-50 dark:bg-green-950/30", borderColor: "border-green-200 dark:border-green-800", icon: Terminal, category: "bash" },

  // Web operations (amber)
  WebFetch: { color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-950/30", borderColor: "border-amber-200 dark:border-amber-800", icon: Globe, category: "web" },
  WebSearch: { color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-50 dark:bg-orange-950/30", borderColor: "border-orange-200 dark:border-orange-800", icon: Globe, category: "web" },

  // Agent operations (pink)
  Task: { color: "text-pink-600 dark:text-pink-400", bgColor: "bg-pink-50 dark:bg-pink-950/30", borderColor: "border-pink-200 dark:border-pink-800", icon: Users, category: "agent" },
  SendMessage: { color: "text-rose-600 dark:text-rose-400", bgColor: "bg-rose-50 dark:bg-rose-950/30", borderColor: "border-rose-200 dark:border-rose-800", icon: MessageSquare, category: "agent" },
};

const DEFAULT_TOOL_CONFIG = {
  color: "text-zinc-600 dark:text-zinc-400",
  bgColor: "bg-zinc-50 dark:bg-zinc-950/30",
  borderColor: "border-zinc-200 dark:border-zinc-800",
  icon: Wrench,
  category: "other",
};

// ---- Conversation Message ----

function ConvMessage({ msg, showTools, searchHighlight, isSearchMatch }: { msg: SessionMessage; showTools: boolean; searchHighlight?: string; isSearchMatch?: boolean }) {
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
    <div className={`flex gap-3 py-3 px-4 ${isUser ? "bg-blue-50/50 dark:bg-blue-950/20" : ""} ${isSearchMatch ? "ring-2 ring-yellow-400 dark:ring-yellow-600" : ""}`}
      id={`msg-${msg.uuid}`}>
      <div className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isUser ? "bg-blue-100 dark:bg-blue-900" : "bg-purple-100 dark:bg-purple-900"
      }`}>
        {isUser ? <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> : <Bot className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold">{isUser ? "You" : "Claude"}</span>
          {msg.model && <Badge variant="secondary" className="text-xs h-4">{shortModel(msg.model)}</Badge>}
          <span className="text-xs text-muted-foreground">
            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}
          </span>
          {hasTools && showTools && (
            <Badge variant="outline" className="text-xs h-4 ml-2">
              {msg.toolUse!.length} tool{msg.toolUse!.length > 1 ? "s" : ""}
            </Badge>
          )}
          {(msg.inputTokens || msg.outputTokens) && (
            <span className="text-xs text-muted-foreground font-mono ml-auto">
              {fmtTokens(msg.inputTokens || 0)}in/{fmtTokens(msg.outputTokens || 0)}out
              {msg.cacheRead ? `/${fmtTokens(msg.cacheRead)}cache` : ""}
              {msg.inputTokens && msg.outputTokens ? ` ≈ ${fmtCost(
                ((msg.inputTokens || 0) * 15 + (msg.outputTokens || 0) * 75) / 1e6
              )}` : ""}
            </span>
          )}
        </div>

        {hasThinking && showTools && (
          <div className="mb-2">
            <button className="text-xs text-amber-600 flex items-center gap-1 hover:underline" onClick={() => setThinkingExpanded(!thinkingExpanded)}>
              <Brain className="h-3 w-3" />Thinking {thinkingExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
            {thinkingExpanded && <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded p-2 mt-1 whitespace-pre-wrap">{msg.thinkingContent}</div>}
          </div>
        )}

        {hasTools && showTools && (
          <div className="mb-2 space-y-1.5">
            {msg.toolUse!.map((tool, i) => {
              const config = TOOL_CONFIG[tool.name] || DEFAULT_TOOL_CONFIG;
              const Icon = config.icon;
              const isExpanded = expandedTools.has(i);
              const parsedInput = parseToolInput(tool);

              return (
                <div key={i} className={`text-xs rounded border ${config.bgColor} ${config.borderColor}`}>
                  {/* Tool header - clickable to expand/collapse */}
                  <button
                    onClick={() => toggleToolExpanded(i)}
                    className="w-full px-2.5 py-1.5 flex items-start gap-2 hover:opacity-80 transition-opacity"
                  >
                    <Icon className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${config.color}`} />
                    <span className={`font-mono font-semibold ${config.color}`}>{tool.name}</span>

                    {/* Tool-specific preview */}
                    {!isExpanded && (
                      <span className="text-muted-foreground truncate flex-1 text-left">
                        {tool.name === "Bash" && parsedInput.command ? (
                          <code className="font-mono">{parsedInput.command.slice(0, 60)}</code>
                        ) : tool.name === "Read" && parsedInput.file_path ? (
                          <span className="font-mono">{parsedInput.file_path.split(/[/\\]/).pop()}</span>
                        ) : tool.name === "Edit" && parsedInput.file_path ? (
                          <span className="font-mono">{parsedInput.file_path.split(/[/\\]/).pop()}</span>
                        ) : tool.name === "Write" && parsedInput.file_path ? (
                          <span className="font-mono">{parsedInput.file_path.split(/[/\\]/).pop()}</span>
                        ) : tool.input ? (
                          tool.input.slice(0, 50)
                        ) : null}
                      </span>
                    )}

                    {isExpanded ? <ChevronDown className="h-3 w-3 ml-auto flex-shrink-0" /> : <ChevronRight className="h-3 w-3 ml-auto flex-shrink-0" />}
                  </button>

                  {/* Expanded content */}
                  {isExpanded && tool.input && (
                    <div className="px-2.5 pb-2 pt-0 border-t border-current/10">
                      {/* Special handling for specific tool types */}
                      {tool.name === "Bash" && parsedInput.command ? (
                        <div className="mt-1.5">
                          <div className="text-[10px] text-muted-foreground mb-1">Command:</div>
                          <div className="bg-black/90 dark:bg-black/60 text-green-400 px-2 py-1.5 rounded font-mono text-xs">
                            $ {parsedInput.command}
                          </div>
                        </div>
                      ) : tool.name === "Edit" && parsedInput.old_string && parsedInput.new_string ? (
                        <div className="mt-1.5 space-y-1.5">
                          {parsedInput.file_path && (
                            <div>
                              <div className="text-[10px] text-muted-foreground">File:</div>
                              <div className="font-mono text-xs">{parsedInput.file_path}</div>
                            </div>
                          )}
                          <div>
                            <div className="text-[10px] text-muted-foreground mb-0.5">Changes:</div>
                            <div className="bg-red-50 dark:bg-red-950/30 border-l-2 border-red-400 px-2 py-1 font-mono text-xs text-red-700 dark:text-red-400">
                              - {parsedInput.old_string.slice(0, 150)}
                            </div>
                            <div className="bg-green-50 dark:bg-green-950/30 border-l-2 border-green-400 px-2 py-1 font-mono text-xs text-green-700 dark:text-green-400 mt-0.5">
                              + {parsedInput.new_string.slice(0, 150)}
                            </div>
                          </div>
                        </div>
                      ) : tool.name === "Read" && parsedInput.file_path ? (
                        <div className="mt-1.5">
                          <div className="text-[10px] text-muted-foreground mb-1">File path:</div>
                          <div className="font-mono text-xs">{parsedInput.file_path}</div>
                          {(parsedInput.offset || parsedInput.limit) && (
                            <div className="text-[10px] text-muted-foreground mt-1">
                              Lines: {parsedInput.offset || 0} - {(parsedInput.offset || 0) + (parsedInput.limit || "all")}
                            </div>
                          )}
                        </div>
                      ) : tool.name === "Write" && parsedInput.file_path ? (
                        <div className="mt-1.5">
                          <div className="text-[10px] text-muted-foreground mb-1">File path:</div>
                          <div className="font-mono text-xs">{parsedInput.file_path}</div>
                          {parsedInput.content && (
                            <div className="mt-1">
                              <div className="text-[10px] text-muted-foreground mb-0.5">Content preview:</div>
                              <div className="bg-muted/40 px-2 py-1 font-mono text-xs max-h-20 overflow-hidden">
                                {parsedInput.content.slice(0, 200)}...
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        // Generic JSON display
                        <pre className="mt-1.5 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                          {tool.input.slice(0, 500)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {hasContent && <MarkdownContent content={msg.content} className="text-sm" />}
      </div>
    </div>
  );
}

// ---- Session Detail ----

interface FilePreview {
  path: string;
  fileName: string;
  ext: string;
  content: string;
  size: number;
  lastModified: number;
}

function SessionDetailView({ projectPath, sessionId, onBack }: {
  projectPath: string; sessionId: string; onBack: () => void;
}) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTools, setShowTools] = useState(true);
  const [showCheckpoints, setShowCheckpoints] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [previewFile, setPreviewFile] = useState<FilePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [convSearch, setConvSearch] = useState("");
  const [convSearchMatch, setConvSearchMatch] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/sessions/${projectPath}/${sessionId}`)
      .then(r => r.json()).then(d => { if (!d.error) setDetail(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectPath, sessionId]);

  const scrollToTop = useCallback(() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }), []);
  const scrollToBottom = useCallback(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), []);
  const scrollToCheckpoint = useCallback((idx: number) => {
    if (!detail) return;
    const msg = detail.messages[idx];
    if (!msg) return;
    const el = document.getElementById(`msg-${msg.uuid}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [detail]);

  const loadFilePreview = useCallback((filePath: string) => {
    setPreviewLoading(true);
    fetch(`/api/file-preview?path=${encodeURIComponent(filePath)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setPreviewFile({ path: filePath, fileName: filePath.split(/[/\\]/).pop() || "", ext: "", content: `Error: ${d.error}`, size: 0, lastModified: 0 });
        } else {
          setPreviewFile(d);
        }
        setPreviewLoading(false);
      })
      .catch(() => {
        setPreviewFile({ path: filePath, fileName: filePath.split(/[/\\]/).pop() || "", ext: "", content: "Failed to load file", size: 0, lastModified: 0 });
        setPreviewLoading(false);
      });
  }, []);

  // Compute search matches (must be before early returns to keep hook order stable)
  const allVisible = useMemo(() => {
    if (!detail) return [];
    return detail.messages.filter(m =>
      (m.role === "user" || m.role === "assistant") && (m.content.trim() || (m.toolUse && m.toolUse.length > 0) || m.thinkingContent)
    );
  }, [detail]);

  const convSearchLower = convSearch.trim().toLowerCase();
  const matchedIndices = useMemo(() => {
    if (!convSearchLower) return [];
    return allVisible
      .map((m, i) => (m.content.toLowerCase().includes(convSearchLower) ? i : -1))
      .filter((i) => i !== -1);
  }, [allVisible, convSearchLower]);

  // Jump to matched message
  useEffect(() => {
    if (matchedIndices.length > 0 && convSearchMatch >= 0 && convSearchMatch < matchedIndices.length) {
      const msgIdx = matchedIndices[convSearchMatch];
      const msg = allVisible[msgIdx];
      if (msg) {
        const el = document.getElementById(`msg-${msg.uuid}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [convSearchMatch, convSearch, matchedIndices, allVisible]);

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!detail) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground">Session not found</p>
      <Button variant="outline" className="mt-4" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
    </div>
  );

  const visible = allVisible;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="border-b px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate">{detail.projectName}</div>
          <div className="text-xs text-muted-foreground">
            {detail.startTime ? new Date(detail.startTime).toLocaleString("zh-CN") : ""} · {shortModel(detail.model)}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant={showTools ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setShowTools(!showTools)}>
            <Wrench className="h-3 w-3 mr-1" />Tools
          </Button>
          <Button variant={showCheckpoints ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => { setShowCheckpoints(!showCheckpoints); setShowFiles(false); }}>
            <MapPin className="h-3 w-3 mr-1" />Checkpoints ({detail.checkpoints.length})
          </Button>
          {detail.contextFiles.length > 0 && (
            <Button variant={showFiles ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => { setShowFiles(!showFiles); setShowCheckpoints(false); }}>
              <FileText className="h-3 w-3 mr-1" />Files ({detail.contextFiles.length})
            </Button>
          )}
          <Badge variant="outline" className="text-xs">{visible.length} msgs</Badge>
          <Badge variant="outline" className="text-xs font-mono">
            <DollarSign className="h-3 w-3" />{fmtCost(detail.estimatedCost)}
          </Badge>
          <Badge variant="outline" className="text-xs font-mono">
            {fmtTokens(detail.totalInputTokens)}in / {fmtTokens(detail.totalOutputTokens)}out
          </Badge>
        </div>
      </div>

      {/* Conversation search bar */}
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
            <Button
              variant="ghost" size="sm" className="h-6 w-6 p-0"
              disabled={matchedIndices.length === 0}
              onClick={() => setConvSearchMatch((convSearchMatch - 1 + matchedIndices.length) % matchedIndices.length)}
            >
              <ChevronsUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost" size="sm" className="h-6 w-6 p-0"
              disabled={matchedIndices.length === 0}
              onClick={() => setConvSearchMatch((convSearchMatch + 1) % matchedIndices.length)}
            >
              <ChevronsDown className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setConvSearch(""); setConvSearchMatch(0); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: checkpoints or files */}
        {(showCheckpoints || showFiles) && (
          <div className="w-64 border-r overflow-auto bg-muted/5 flex-shrink-0">
            {showCheckpoints && (
              <div className="p-2 space-y-1">
                <div className="text-xs font-medium text-muted-foreground px-2 py-1">User Messages (Checkpoints)</div>
                {detail.checkpoints.map((cp, i) => (
                  <button key={i} className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors"
                    onClick={() => scrollToCheckpoint(cp.index)}>
                    <div className="font-medium truncate">{cp.content}</div>
                    <div className="text-muted-foreground">{cp.timestamp ? new Date(cp.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : ""}</div>
                  </button>
                ))}
              </div>
            )}
            {showFiles && (
              <div className="p-2 space-y-1">
                <div className="text-xs font-medium text-muted-foreground px-2 py-1">Referenced Files</div>
                {detail.contextFiles.map((f, i) => (
                  <button
                    key={i}
                    className={`w-full text-left px-2 py-1.5 text-xs font-mono truncate rounded transition-colors ${
                      previewFile?.path === f
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                    title={f}
                    onClick={() => loadFilePreview(f)}
                  >
                    <FileText className="h-3 w-3 inline mr-1" />{f.split(/[/\\]/).pop()}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Conversation */}
        <div className={`${previewFile ? "w-1/2" : "flex-1"} overflow-auto relative`} ref={scrollRef}>
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

          {/* Floating nav buttons - right side of conversation */}
          <div className="sticky bottom-4 float-right mr-4 flex flex-col gap-2">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 shadow-md bg-background" onClick={scrollToTop}>
              <ChevronsUp className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 shadow-md bg-background" onClick={scrollToBottom}>
              <ChevronsDown className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* File Preview Panel */}
        {previewFile && (
          <div className="w-1/2 border-l flex flex-col bg-muted/5">
            <div className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium truncate flex-1" title={previewFile.path}>
                {previewFile.fileName}
              </span>
              {previewFile.size > 0 && (
                <span className="text-xs text-muted-foreground">
                  {(previewFile.size / 1024).toFixed(1)}KB
                </span>
              )}
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setPreviewFile(null)}>
                ×
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-3">
              {previewLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : previewFile.ext === ".md" ? (
                <MarkdownContent content={previewFile.content} className="text-sm" />
              ) : (
                <pre className="text-xs font-mono whitespace-pre-wrap break-words text-muted-foreground">
                  {previewFile.content}
                </pre>
              )}
            </div>
            <div className="px-3 py-1.5 border-t text-xs text-muted-foreground truncate">
              {previewFile.path}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Main Page ----

function SessionsPageInner() {
  const [data, setData] = useState<SessionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [active, setActive] = useState<{ project: string; id: string } | null>(null);
  const searchParams = useSearchParams();
  const deepLinked = useRef(false);

  const loadData = useCallback((isManual = false) => {
    if (isManual) setRefreshing(true);
    fetch("/api/sessions").then(r => r.json()).then((d: SessionsData) => {
      setData(d);
      setLoading(false);
      setRefreshing(false);

      // Deep-link: ?session=UUID auto-opens that session
      if (!deepLinked.current) {
        const sessionId = searchParams.get("session");
        if (sessionId && d.recentSessions) {
          const match = d.recentSessions.find(s => s.id === sessionId);
          if (match) {
            setActive({ project: match.project, id: match.id });
            deepLinked.current = true;
          }
        }
      }
    }).catch(() => { setLoading(false); setRefreshing(false); });
  }, [searchParams]);

  // Initial load
  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 10s when on list view
  useEffect(() => {
    if (active) return;
    const iv = setInterval(() => loadData(), 10000);
    return () => clearInterval(iv);
  }, [active, loadData]);

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (active) return <SessionDetailView projectPath={active.project} sessionId={active.id} onBack={() => setActive(null)} />;
  if (!data) return <div className="text-center py-16"><Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><h2 className="text-lg">No data</h2></div>;
  return <SessionList data={data} onRefresh={() => loadData(true)} refreshing={refreshing} onSelect={(p, id) => setActive({ project: p, id })} />;
}

export default function SessionsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <SessionsPageInner />
    </Suspense>
  );
}
