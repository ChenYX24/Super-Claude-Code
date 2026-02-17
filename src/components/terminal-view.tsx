"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { TerminalMessage } from "@/components/terminal-message";
import {
  ChevronsUp, ChevronsDown, Search, X, Wrench, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ---- Types ----

interface SessionMessage {
  uuid: string;
  role: "user" | "assistant" | "system";
  type: string;
  content: string;
  timestamp: string;
  model?: string;
  toolUse?: { name: string; input?: string }[];
  inputTokens?: number;
  outputTokens?: number;
  cacheRead?: number;
  thinkingContent?: string;
  isCheckpoint?: boolean;
}

interface Checkpoint {
  index: number;
  content: string;
  timestamp: string;
}

interface SessionDetail {
  id: string;
  project: string;
  projectName: string;
  messages: SessionMessage[];
  totalInputTokens: number;
  totalOutputTokens: number;
  cacheReadTokens: number;
  estimatedCost: number;
  model?: string;
  startTime: string;
  endTime: string;
  checkpoints?: Checkpoint[];
}

// ---- Terminal View ----

export function TerminalView({ detail }: { detail: SessionDetail }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTools, setShowTools] = useState(true);
  const [showCheckpoints, setShowCheckpoints] = useState(false);
  const [search, setSearch] = useState("");
  const [searchMatch, setSearchMatch] = useState(0);

  const checkpoints = detail.checkpoints || [];

  // Map original message index → visible index for checkpoint jumping
  const origToVisible = useMemo(() => {
    const map = new Map<number, number>();
    let vi = 0;
    for (let i = 0; i < detail.messages.length; i++) {
      const m = detail.messages[i];
      if ((m.role === "user" || m.role === "assistant") &&
          (m.content.trim() || (m.toolUse && m.toolUse.length > 0) || m.thinkingContent)) {
        map.set(i, vi);
        vi++;
      }
    }
    return map;
  }, [detail.messages]);

  const scrollToCheckpoint = useCallback((origIdx: number) => {
    const vi = origToVisible.get(origIdx);
    if (vi === undefined) return;
    const msgs = scrollRef.current?.querySelectorAll("[data-msg-idx]");
    if (msgs && msgs[vi]) {
      msgs[vi].scrollIntoView({ behavior: "smooth", block: "center" });
      // Flash highlight
      msgs[vi].classList.add("ring-1", "ring-green-500/50");
      setTimeout(() => msgs[vi].classList.remove("ring-1", "ring-green-500/50"), 2000);
    }
    setShowCheckpoints(false);
  }, [origToVisible]);

  const visible = useMemo(() =>
    detail.messages.filter(m =>
      (m.role === "user" || m.role === "assistant") &&
      (m.content.trim() || (m.toolUse && m.toolUse.length > 0) || m.thinkingContent)
    ),
    [detail.messages]
  );

  const searchLower = search.trim().toLowerCase();
  const matchedIndices = useMemo(() => {
    if (!searchLower) return [];
    return visible
      .map((m, i) => (m.content.toLowerCase().includes(searchLower) ? i : -1))
      .filter((i) => i !== -1);
  }, [visible, searchLower]);

  // Jump to match
  useEffect(() => {
    if (matchedIndices.length > 0 && searchMatch >= 0 && searchMatch < matchedIndices.length) {
      const msg = visible[matchedIndices[searchMatch]];
      if (msg) {
        const el = document.getElementById(`msg-${msg.uuid}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [searchMatch, matchedIndices, visible]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "j") {
        scrollRef.current?.scrollBy({ top: 100, behavior: "smooth" });
      } else if (e.key === "k") {
        scrollRef.current?.scrollBy({ top: -100, behavior: "smooth" });
      } else if (e.key === "/") {
        e.preventDefault();
        const input = document.getElementById("terminal-search");
        input?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const scrollToTop = useCallback(() =>
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }),
    []
  );
  const scrollToBottom = useCallback(() =>
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
    []
  );

  const fmtTokens = (n: number) => {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n.toString();
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 text-zinc-300 rounded-lg overflow-hidden border border-zinc-800">
      {/* Terminal header bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-950 border-b border-zinc-800 flex-shrink-0">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500/80" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
          <div className="h-3 w-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-xs text-zinc-500 font-mono ml-2 flex-1 truncate">
          {detail.projectName} - {detail.id.slice(0, 8)}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 px-2 text-[10px] ${showTools ? "text-green-400" : "text-zinc-600"} hover:text-zinc-200 hover:bg-zinc-800`}
            onClick={() => setShowTools(!showTools)}
          >
            <Wrench className="h-3 w-3 mr-1" /> tools
          </Button>
          {checkpoints.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-2 text-[10px] ${showCheckpoints ? "text-yellow-400" : "text-zinc-600"} hover:text-zinc-200 hover:bg-zinc-800`}
              onClick={() => setShowCheckpoints(!showCheckpoints)}
            >
              <MapPin className="h-3 w-3 mr-1" /> {checkpoints.length}
            </Button>
          )}
          <Badge variant="outline" className="text-[10px] h-5 border-zinc-700 text-zinc-500">
            {visible.length} msgs
          </Badge>
          <Badge variant="outline" className="text-[10px] h-5 border-zinc-700 text-zinc-500 font-mono">
            {fmtTokens(detail.totalInputTokens)}in/{fmtTokens(detail.totalOutputTokens)}out
          </Badge>
          <Badge variant="outline" className="text-[10px] h-5 border-zinc-700 text-zinc-500 font-mono">
            ${detail.estimatedCost.toFixed(2)}
          </Badge>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-zinc-950/50 border-b border-zinc-800/50 flex-shrink-0">
        <Search className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
        <input
          id="terminal-search"
          type="text"
          placeholder="Search... (press / to focus)"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSearchMatch(0); }}
          className="flex-1 bg-transparent text-xs text-zinc-400 focus:text-zinc-200 focus:outline-none placeholder:text-zinc-700 font-mono"
        />
        {searchLower && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-[10px] text-zinc-600 font-mono">
              {matchedIndices.length > 0 ? `${searchMatch + 1}/${matchedIndices.length}` : "0/0"}
            </span>
            <Button
              variant="ghost" size="sm" className="h-5 w-5 p-0 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800"
              disabled={matchedIndices.length === 0}
              onClick={() => setSearchMatch((searchMatch - 1 + matchedIndices.length) % matchedIndices.length)}
            >
              <ChevronsUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost" size="sm" className="h-5 w-5 p-0 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800"
              disabled={matchedIndices.length === 0}
              onClick={() => setSearchMatch((searchMatch + 1) % matchedIndices.length)}
            >
              <ChevronsDown className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost" size="sm" className="h-5 w-5 p-0 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800"
              onClick={() => { setSearch(""); setSearchMatch(0); }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Checkpoints panel */}
      {showCheckpoints && checkpoints.length > 0 && (
        <div className="max-h-48 overflow-auto border-b border-zinc-800/50 bg-zinc-950/50">
          <div className="px-4 py-1.5 text-[10px] text-zinc-600 font-mono uppercase tracking-wider">
            Checkpoints ({checkpoints.length})
          </div>
          {checkpoints.map((cp, i) => (
            <button
              key={i}
              className="w-full text-left px-4 py-1.5 text-xs font-mono hover:bg-zinc-800/50 transition-colors flex items-start gap-2"
              onClick={() => scrollToCheckpoint(cp.index)}
            >
              <MapPin className="h-3 w-3 text-yellow-500/70 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-zinc-400 truncate block">{cp.content}</span>
                <span className="text-zinc-600 text-[10px]">
                  {cp.timestamp ? new Date(cp.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Terminal content */}
      <div ref={scrollRef} className="flex-1 overflow-auto py-2">
        {/* Startup message */}
        <div className="px-4 py-1 text-[11px] text-zinc-700 font-mono select-none">
          --- Session started: {detail.startTime ? new Date(detail.startTime).toLocaleString("zh-CN") : "unknown"} ---
        </div>

        {visible.map((msg, i) => (
          <div key={msg.uuid} data-msg-idx={i}>
            <TerminalMessage
              msg={msg}
              showTools={showTools}
              searchHighlight={searchLower}
              isSearchMatch={searchLower ? matchedIndices[searchMatch] === i : false}
            />
          </div>
        ))}

        {detail.endTime && (
          <div className="px-4 py-1 text-[11px] text-zinc-700 font-mono select-none">
            --- Session ended: {new Date(detail.endTime).toLocaleString("zh-CN")} ---
          </div>
        )}
      </div>

      {/* Floating scroll buttons */}
      <div className="absolute bottom-16 right-6 flex flex-col gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0 bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
          onClick={scrollToTop}
        >
          <ChevronsUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0 bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
          onClick={scrollToBottom}
        >
          <ChevronsDown className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
