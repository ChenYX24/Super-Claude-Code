"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/markdown-content";
import { TerminalView } from "@/components/terminal-view";
import {
  RefreshCw, ArrowLeft, Wrench, ChevronsUp, ChevronsDown, MapPin,
  FileText, DollarSign, Search, X, Monitor, SquareTerminal, Download, BarChart3,
} from "lucide-react";
import { fmtCost, fmtTokens, shortModel } from "@/lib/format-utils";
import { ConvMessage } from "./conv-message";
import { SessionAnalytics } from "./session-analytics";
import type { SessionDetail, FilePreview } from "./types";
import { useToast } from "@/components/toast";

export function SessionDetailView({ projectPath, sessionId, onBack }: {
  projectPath: string;
  sessionId: string;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTools, setShowTools] = useState(true);
  const [showCheckpoints, setShowCheckpoints] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [previewFile, setPreviewFile] = useState<FilePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [convSearch, setConvSearch] = useState("");
  const [convSearchMatch, setConvSearchMatch] = useState(0);
  const [viewMode, setViewMode] = useState<"card" | "terminal">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("session-view-mode") as "card" | "terminal") || "card";
    }
    return "card";
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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

  const exportAsMarkdown = useCallback(() => {
    if (!detail) return;

    let md = `# Session: ${detail.projectName}\n`;
    md += `**Date:** ${detail.startTime} - ${detail.endTime}\n`;
    md += `**Model:** ${shortModel(detail.model)}\n`;
    md += `**Cost:** ${fmtCost(detail.estimatedCost)}\n`;
    md += `**Tokens:** ${fmtTokens(detail.totalInputTokens)} in / ${fmtTokens(detail.totalOutputTokens)} out\n\n`;
    md += `---\n\n`;

    for (const msg of detail.messages) {
      if (msg.role !== "user" && msg.role !== "assistant") continue;
      if (!msg.content.trim() && (!msg.toolUse || msg.toolUse.length === 0)) continue;

      md += `## ${msg.role === "user" ? "User" : "Claude"}\n`;
      if (msg.timestamp) {
        md += `*${new Date(msg.timestamp).toLocaleTimeString()}*\n\n`;
      }
      if (msg.content.trim()) {
        md += msg.content.trim() + "\n\n";
      }
      if (msg.toolUse && msg.toolUse.length > 0) {
        for (const tool of msg.toolUse) {
          md += `### Tool: ${tool.name}\n`;
          if (tool.input) {
            md += "```json\n" + tool.input.slice(0, 500) + "\n```\n\n";
          }
        }
      }
      md += `---\n\n`;
    }

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${detail.id.slice(0, 8)}-${new Date(detail.startTime).toISOString().split("T")[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast("Session exported as Markdown");
  }, [detail, toast]);

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
          {/* View mode toggle */}
          <div className="flex items-center gap-0.5 border rounded-md p-0.5 mr-1">
            <Button
              variant={viewMode === "card" ? "default" : "ghost"}
              size="sm" className="h-6 w-6 p-0"
              onClick={() => { setViewMode("card"); localStorage.setItem("session-view-mode", "card"); }}
              title="Card View"
            >
              <Monitor className="h-3 w-3" />
            </Button>
            <Button
              variant={viewMode === "terminal" ? "default" : "ghost"}
              size="sm" className="h-6 w-6 p-0"
              onClick={() => { setViewMode("terminal"); localStorage.setItem("session-view-mode", "terminal"); }}
              title="Terminal View"
            >
              <SquareTerminal className="h-3 w-3" />
            </Button>
          </div>
          <Button variant={showTools ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setShowTools(!showTools)}>
            <Wrench className="h-3 w-3 mr-1" />Tools
          </Button>
          <Button variant={showCheckpoints ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => { setShowCheckpoints(!showCheckpoints); setShowFiles(false); setShowAnalytics(false); }}>
            <MapPin className="h-3 w-3 mr-1" />Checkpoints ({detail.checkpoints.length})
          </Button>
          {detail.contextFiles.length > 0 && (
            <Button variant={showFiles ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => { setShowFiles(!showFiles); setShowCheckpoints(false); setShowAnalytics(false); }}>
              <FileText className="h-3 w-3 mr-1" />Files ({detail.contextFiles.length})
            </Button>
          )}
          <Button variant={showAnalytics ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => { setShowAnalytics(!showAnalytics); setShowCheckpoints(false); setShowFiles(false); }}>
            <BarChart3 className="h-3 w-3 mr-1" />Analytics
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={exportAsMarkdown} title="Export as Markdown">
            <Download className="h-3 w-3 mr-1" />Export
          </Button>
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

      {/* Terminal View Mode */}
      {viewMode === "terminal" && detail && (
        <div className="flex-1 overflow-hidden relative">
          <TerminalView detail={detail} />
        </div>
      )}

      {/* Card View Mode */}
      {viewMode === "card" && (<div className="flex flex-1 overflow-hidden">
        {/* Sidebar: checkpoints, files, or analytics */}
        {(showCheckpoints || showFiles || showAnalytics) && (
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
            {showAnalytics && <SessionAnalytics detail={detail} />}
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
      </div>)}
    </div>
  );
}
