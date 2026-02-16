"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkdownContent } from "@/components/markdown-content";
import {
  Clock, FolderOpen, Hash, RefreshCw, ArrowLeft, User, Bot,
  Wrench, Brain, ChevronDown, ChevronRight, Coins, MessageSquare,
  ChevronsUp, ChevronsDown, MapPin, FileText, DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ---- Types ----

interface SessionInfo {
  id: string; project: string; projectName: string;
  startTime: number; lastActive: number; messageCount: number;
  firstMessage?: string; model?: string;
  totalInputTokens: number; totalOutputTokens: number;
  cacheReadTokens: number; estimatedCost: number;
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

// ---- Session List ----

function SessionList({ data, onSelect }: { data: SessionsData; onSelect: (p: string, id: string) => void }) {
  const [filter, setFilter] = useState("");
  const sessions = filter ? data.recentSessions.filter(s => s.project === filter) : data.recentSessions;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Sessions</h1>
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

      <div className="flex flex-wrap gap-2">
        <Badge variant={filter === "" ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilter("")}>All</Badge>
        {data.projects.map(p => (
          <Badge key={p.path} variant={filter === p.path ? "default" : "outline"} className="cursor-pointer"
            onClick={() => setFilter(filter === p.path ? "" : p.path)}>
            {p.name.length > 20 ? "..." + p.name.slice(-18) : p.name} ({p.sessionCount})
          </Badge>
        ))}
      </div>

      <div className="space-y-1.5">
        {sessions.map(s => (
          <Card key={`${s.project}-${s.id}`} className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all"
            onClick={() => onSelect(s.project, s.id)}>
            <CardContent className="py-2.5 flex items-center gap-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{s.firstMessage || s.id.slice(0, 12)}</div>
                <div className="text-xs text-muted-foreground">{formatDT(s.startTime)} · {timeAgo(s.lastActive)} · {s.projectName}</div>
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
        ))}
      </div>
    </div>
  );
}

// ---- Conversation Message ----

function ConvMessage({ msg, showTools }: { msg: SessionMessage; showTools: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const isUser = msg.role === "user";
  const hasContent = msg.content.trim().length > 0;
  const hasTools = msg.toolUse && msg.toolUse.length > 0;
  const hasThinking = !!msg.thinkingContent;

  if (!hasContent && !hasTools && !hasThinking) return null;

  return (
    <div className={`flex gap-3 py-3 px-4 ${isUser ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
      id={msg.isCheckpoint ? `cp-${msg.uuid}` : undefined}>
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
            <button className="text-xs text-amber-600 flex items-center gap-1 hover:underline" onClick={() => setExpanded(!expanded)}>
              <Brain className="h-3 w-3" />Thinking {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
            {expanded && <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded p-2 mt-1 whitespace-pre-wrap">{msg.thinkingContent}</div>}
          </div>
        )}

        {hasTools && showTools && (
          <div className="mb-2 space-y-1">
            {msg.toolUse!.map((tool, i) => (
              <div key={i} className="text-xs bg-muted/40 rounded px-2 py-1.5 flex items-start gap-1.5">
                <Wrench className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span className="font-mono font-medium">{tool.name}</span>
                {tool.input && <span className="text-muted-foreground truncate">{tool.input.slice(0, 120)}</span>}
              </div>
            ))}
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
    const el = document.getElementById(`cp-${msg.uuid}`);
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

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!detail) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground">Session not found</p>
      <Button variant="outline" className="mt-4" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
    </div>
  );

  const visible = detail.messages.filter(m =>
    (m.role === "user" || m.role === "assistant") && (m.content.trim() || (m.toolUse && m.toolUse.length > 0) || m.thinkingContent)
  );

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
            {visible.map(msg => <ConvMessage key={msg.uuid} msg={msg} showTools={showTools} />)}
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

export default function SessionsPage() {
  const [data, setData] = useState<SessionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<{ project: string; id: string } | null>(null);

  useEffect(() => {
    fetch("/api/sessions").then(r => r.json()).then((d: SessionsData) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (active) return <SessionDetailView projectPath={active.project} sessionId={active.id} onBack={() => setActive(null)} />;
  if (!data) return <div className="text-center py-16"><Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><h2 className="text-lg">No data</h2></div>;
  return <SessionList data={data} onSelect={(p, id) => setActive({ project: p, id })} />;
}
