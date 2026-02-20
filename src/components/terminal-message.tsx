"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import { shortModel as shortModelUtil } from "@/lib/format-utils";

// ---- Types ----

interface ToolUse {
  name: string;
  input?: string;
}

interface Message {
  uuid: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  model?: string;
  toolUse?: ToolUse[];
  thinkingContent?: string;
  inputTokens?: number;
  outputTokens?: number;
}

// ---- Helpers ----

function parseToolInput(tool: ToolUse): Record<string, string> {
  if (!tool.input) return {};
  try {
    const parsed = JSON.parse(tool.input);
    // Convert all values to strings for safe rendering
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      result[k] = typeof v === "string" ? v : JSON.stringify(v);
    }
    return result;
  } catch {
    return { raw: tool.input };
  }
}

function fmtTime(ts: string) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function shortModel(m?: string) {
  return shortModelUtil(m || "");
}

// Tool color mapping for terminal
const TOOL_COLORS: Record<string, string> = {
  Read: "text-cyan-400",
  Glob: "text-cyan-400",
  Grep: "text-blue-400",
  Write: "text-purple-400",
  Edit: "text-violet-400",
  Bash: "text-green-400",
  WebFetch: "text-amber-400",
  WebSearch: "text-orange-400",
  Task: "text-pink-400",
  SendMessage: "text-rose-400",
};

// ---- Terminal Message Component ----

export function TerminalMessage({ msg, showTools, searchHighlight, isSearchMatch }: {
  msg: Message;
  showTools: boolean;
  searchHighlight?: string;
  isSearchMatch?: boolean;
}) {
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const isUser = msg.role === "user";
  const hasContent = msg.content.trim().length > 0;
  const hasTools = msg.toolUse && msg.toolUse.length > 0;
  const hasThinking = !!msg.thinkingContent;

  if (!hasContent && !hasTools && !hasThinking) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const renderContent = (text: string): React.ReactNode => {
    if (!searchHighlight) return text;
    const regex = new RegExp(`(${searchHighlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      part.toLowerCase() === searchHighlight.toLowerCase()
        ? <mark key={i} className="bg-yellow-600/60 text-yellow-100 px-0.5">{part}</mark>
        : part
    );
  };

  return (
    <div
      className={`group relative px-4 py-1.5 font-mono text-[13px] leading-relaxed hover:bg-white/[0.03] transition-colors ${isSearchMatch ? "bg-yellow-900/20 border-l-2 border-yellow-500" : ""}`}
      id={`msg-${msg.uuid}`}
    >
      {/* Copy button on hover */}
      {hasContent && (
        <button
          onClick={handleCopy}
          className="absolute right-2 top-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-zinc-300"
          title="Copy message"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}

      {/* Timestamp */}
      <span className="text-zinc-600 text-[11px] mr-2 select-none">{fmtTime(msg.timestamp)}</span>

      {/* Role prefix */}
      {isUser ? (
        <span className="text-green-400 font-bold select-none">$ </span>
      ) : (
        <span className="text-blue-400 font-bold select-none">&gt; </span>
      )}

      {/* Model tag for assistant */}
      {!isUser && msg.model && (
        <span className="text-zinc-600 text-[11px] mr-1">[{shortModel(msg.model)}]</span>
      )}

      {/* Thinking toggle */}
      {hasThinking && showTools && (
        <div className="ml-4 mt-0.5 mb-1">
          <button
            className="text-[11px] text-amber-600/70 hover:text-amber-500 flex items-center gap-1"
            onClick={() => setThinkingExpanded(!thinkingExpanded)}
          >
            {thinkingExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            thinking...
          </button>
          {thinkingExpanded && (
            <div className="text-[11px] text-zinc-600 italic whitespace-pre-wrap mt-1 pl-2 border-l border-zinc-800 max-h-48 overflow-y-auto">
              {msg.thinkingContent}
            </div>
          )}
        </div>
      )}

      {/* Tool calls */}
      {hasTools && showTools && (
        <div className="ml-4 mt-0.5 mb-1">
          <button
            className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
            onClick={() => setToolsExpanded(!toolsExpanded)}
          >
            {toolsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {msg.toolUse!.length} tool{msg.toolUse!.length > 1 ? "s" : ""}
          </button>

          {!toolsExpanded && (
            <div className="space-y-0.5 mt-0.5">
              {msg.toolUse!.map((tool, i) => {
                const color = TOOL_COLORS[tool.name] || "text-zinc-400";
                const parsed = parseToolInput(tool);
                let summary = "";

                if (tool.name === "Bash" && parsed.command) {
                  summary = String(parsed.command).slice(0, 60);
                } else if (tool.name === "Read" && parsed.file_path) {
                  summary = String(parsed.file_path).split(/[/\\]/).pop() || "";
                } else if ((tool.name === "Edit" || tool.name === "Write") && parsed.file_path) {
                  summary = String(parsed.file_path).split(/[/\\]/).pop() || "";
                } else if ((tool.name === "Glob" || tool.name === "Grep") && parsed.pattern) {
                  summary = String(parsed.pattern);
                }

                return (
                  <div key={i} className="text-[12px]">
                    <span className="text-zinc-600 select-none">  </span>
                    <span className={color}>[{tool.name}]</span>
                    {summary && <span className="text-zinc-500 ml-1">{summary}</span>}
                  </div>
                );
              })}
            </div>
          )}

          {toolsExpanded && (
            <div className="space-y-1 mt-1">
              {msg.toolUse!.map((tool, i) => {
                const color = TOOL_COLORS[tool.name] || "text-zinc-400";
                const parsed = parseToolInput(tool);

                return (
                  <div key={i} className="ml-2 border-l border-zinc-800 pl-2">
                    <div className={`text-[12px] ${color} font-semibold`}>[{tool.name}]</div>
                    {tool.name === "Bash" && parsed.command && (
                      <div className="text-green-400/80 text-[12px] bg-black/40 px-2 py-1 rounded mt-0.5">
                        $ {String(parsed.command)}
                      </div>
                    )}
                    {tool.name === "Edit" && parsed.file_path && (
                      <div className="text-[11px] mt-0.5 space-y-0.5">
                        <div className="text-zinc-500">{parsed.file_path}</div>
                        {parsed.old_string && (
                          <pre className="text-red-400/70 bg-red-950/20 px-2 py-1 rounded font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                            {parsed.old_string.split("\n").map((line, li) => (
                              <div key={li}>- {line}</div>
                            ))}
                          </pre>
                        )}
                        {parsed.new_string && (
                          <pre className="text-green-400/70 bg-green-950/20 px-2 py-1 rounded font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                            {parsed.new_string.split("\n").map((line, li) => (
                              <div key={li}>+ {line}</div>
                            ))}
                          </pre>
                        )}
                      </div>
                    )}
                    {(tool.name === "Read" || tool.name === "Write") && parsed.file_path && (
                      <div className="text-[11px] text-zinc-500 mt-0.5">{String(parsed.file_path)}</div>
                    )}
                    {!["Bash", "Edit", "Read", "Write"].includes(tool.name) && tool.input && (
                      <pre className="text-[11px] text-zinc-600 mt-0.5 whitespace-pre-wrap max-h-24 overflow-hidden">
                        {tool.input.slice(0, 300)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Message content */}
      {hasContent && (
        <span className={`whitespace-pre-wrap break-words ${isUser ? "text-zinc-100" : "text-zinc-300"}`}>
          {renderContent(msg.content)}
        </span>
      )}

      {/* Token info */}
      {(msg.inputTokens || msg.outputTokens) && (
        <span className="text-zinc-700 text-[10px] ml-2">
          [{msg.inputTokens || 0}in/{msg.outputTokens || 0}out]
        </span>
      )}
    </div>
  );
}
