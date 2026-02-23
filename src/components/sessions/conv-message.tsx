"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { MarkdownContent } from "@/components/markdown-content";
import {
  User, Bot, Brain, ChevronDown, ChevronRight, Terminal, Globe,
  Users, Edit3, Eye, Search, FileText, MessageSquare, Wrench,
} from "lucide-react";
import { fmtCost, fmtTokens, shortModel } from "@/lib/format-utils";
import type { SessionMessage } from "./types";

// Tool Configuration
export const TOOL_CONFIG: Record<string, {
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

export const DEFAULT_TOOL_CONFIG = {
  color: "text-zinc-600 dark:text-zinc-400",
  bgColor: "bg-zinc-50 dark:bg-zinc-950/30",
  borderColor: "border-zinc-200 dark:border-zinc-800",
  icon: Wrench,
  category: "other",
};

// Conversation Message Component
export function ConvMessage({ msg, showTools, searchHighlight, isSearchMatch, isLive, phaseBadge }: {
  msg: SessionMessage;
  showTools: boolean;
  searchHighlight?: string;
  isSearchMatch?: boolean;
  isLive?: boolean;
  phaseBadge?: string;
}) {
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
          {phaseBadge && (
            <span className="text-xs text-amber-600 dark:text-amber-400 animate-pulse">{phaseBadge}</span>
          )}
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
                            <pre className="bg-red-50 dark:bg-red-950/30 border-l-2 border-red-400 px-2 py-1 font-mono text-xs text-red-700 dark:text-red-400 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                              {parsedInput.old_string.split("\n").map((line: string, li: number) => (
                                <div key={li}>- {line}</div>
                              ))}
                            </pre>
                            <pre className="bg-green-50 dark:bg-green-950/30 border-l-2 border-green-400 px-2 py-1 font-mono text-xs text-green-700 dark:text-green-400 mt-0.5 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                              {parsedInput.new_string.split("\n").map((line: string, li: number) => (
                                <div key={li}>+ {line}</div>
                              ))}
                            </pre>
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

        {hasContent && (
          <div className="relative">
            <MarkdownContent content={msg.content} className="text-sm" />
            {isLive && <span className="inline-block w-2 h-4 bg-foreground/80 animate-pulse ml-0.5 align-text-bottom" />}
          </div>
        )}
        {!hasContent && isLive && (
          <span className="inline-block w-2 h-4 bg-foreground/80 animate-pulse" />
        )}
      </div>
    </div>
  );
}
