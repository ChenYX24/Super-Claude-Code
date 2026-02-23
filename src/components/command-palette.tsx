"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  Search,
  LayoutDashboard,
  Users,
  Clock,
  MessageCircle,
  Coins,
  Wrench,
  FileEdit,
  Settings,
  Zap,
  Bot,
  Terminal,
  Hash,
  HelpCircle,
  Trash2,
  Cpu,
  DollarSign,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { BUILTIN_COMMANDS } from "@/lib/chat-commands";
import type { ChatCommand } from "@/lib/chat-commands";

// ---- Types ----

type PaletteCategory = "navigation" | "built-in" | "slash" | "skill" | "agent" | "session";

interface PaletteItem {
  id: string;
  name: string;
  description: string;
  category: PaletteCategory;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

interface ToolboxData {
  skills: { name: string; description: string }[];
  agents: { name: string; description: string }[];
  commands: { name: string; description: string }[];
}

interface SessionData {
  recentSessions: {
    id: string;
    project: string;
    projectName: string;
    firstMessage?: string;
    lastActive: number;
  }[];
}

// ---- Constants ----

const CATEGORY_LABELS: Record<PaletteCategory, string> = {
  navigation: "Navigation",
  "built-in": "Built-in",
  slash: "Slash Commands",
  skill: "Skills",
  agent: "Agents",
  session: "Recent Sessions",
};

const CATEGORY_ORDER: PaletteCategory[] = [
  "navigation",
  "built-in",
  "slash",
  "skill",
  "agent",
  "session",
];

const PAGE_ITEMS: { href: string; label: string; icon: React.ReactNode; shortcut?: string }[] = [
  { href: "/", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" />, shortcut: "1" },
  { href: "/team", label: "Team Board", icon: <Users className="h-4 w-4" />, shortcut: "2" },
  { href: "/sessions", label: "Sessions", icon: <Clock className="h-4 w-4" />, shortcut: "3" },
  { href: "/chat", label: "Chat", icon: <MessageCircle className="h-4 w-4" />, shortcut: "4" },
  { href: "/tokens", label: "Tokens", icon: <Coins className="h-4 w-4" />, shortcut: "5" },
  { href: "/toolbox", label: "Toolbox", icon: <Wrench className="h-4 w-4" />, shortcut: "6" },
  { href: "/editor", label: "Instructions", icon: <FileEdit className="h-4 w-4" />, shortcut: "7" },
  { href: "/settings", label: "Settings", icon: <Settings className="h-4 w-4" />, shortcut: "8" },
];

/** Map built-in command names to icons */
const BUILTIN_ICON_MAP: Record<string, React.ReactNode> = {
  "/help": <HelpCircle className="h-4 w-4" />,
  "/clear": <Trash2 className="h-4 w-4" />,
  "/model": <Cpu className="h-4 w-4" />,
  "/cost": <DollarSign className="h-4 w-4" />,
  "/compact": <Minimize2 className="h-4 w-4" />,
};

// ---- Fuzzy filter ----

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  if (lower.includes(q)) return true;
  // Simple character-by-character fuzzy match
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function filterItems(items: PaletteItem[], query: string): PaletteItem[] {
  if (!query.trim()) return items;
  return items.filter(
    (item) =>
      fuzzyMatch(item.name, query) ||
      fuzzyMatch(item.description, query)
  );
}

function groupByCategory(items: PaletteItem[]): [PaletteCategory, PaletteItem[]][] {
  const groups: [PaletteCategory, PaletteItem[]][] = [];
  for (const cat of CATEGORY_ORDER) {
    const catItems = items.filter((i) => i.category === cat);
    if (catItems.length > 0) groups.push([cat, catItems]);
  }
  return groups;
}

// ---- Helpers ----

/** Convert BUILTIN_COMMANDS from chat-commands.ts into PaletteItems */
function buildBuiltinItems(
  builtins: readonly ChatCommand[],
  router: ReturnType<typeof useRouter>,
  close: () => void,
): PaletteItem[] {
  return builtins.map((cmd) => ({
    id: `builtin-${cmd.name}`,
    name: cmd.name,
    description: cmd.description,
    category: "built-in" as const,
    icon: BUILTIN_ICON_MAP[cmd.name] ?? <Terminal className="h-4 w-4" />,
    shortcut: cmd.shortcut,
    action: () => {
      router.push(`/chat?command=${encodeURIComponent(cmd.name)}`);
      close();
    },
  }));
}

// ---- Component ----

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [items, setItems] = useState<PaletteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  // Build page + built-in items (always available, no API call needed)
  const buildStaticItems = useCallback((): PaletteItem[] => {
    const pageItems: PaletteItem[] = PAGE_ITEMS.map((page) => ({
      id: `page-${page.href}`,
      name: page.label,
      description: `Navigate to ${page.label}`,
      category: "navigation" as const,
      icon: page.icon,
      shortcut: page.shortcut,
      action: () => {
        router.push(page.href);
        close();
      },
    }));

    const builtinItems = buildBuiltinItems(BUILTIN_COMMANDS, router, close);

    return [...pageItems, ...builtinItems];
  }, [router, close]);

  // Fetch toolbox + sessions when palette opens
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);

    const staticItems = buildStaticItems();
    setItems(staticItems);

    Promise.all([
      fetch("/api/toolbox").then((r) => r.json()).catch(() => null),
      fetch("/api/sessions").then((r) => r.json()).catch(() => null),
    ]).then(([toolbox, sessions]: [ToolboxData | null, SessionData | null]) => {
      if (cancelled) return;

      const allItems: PaletteItem[] = [...staticItems];

      // Slash Commands (from toolbox API, excluding built-ins already added)
      if (toolbox?.commands) {
        const builtinNames = new Set(BUILTIN_COMMANDS.map((b) => b.name));
        for (const cmd of toolbox.commands) {
          const cmdName = cmd.name.startsWith("/") ? cmd.name : `/${cmd.name}`;
          if (builtinNames.has(cmdName)) continue;
          allItems.push({
            id: `cmd-${cmd.name}`,
            name: cmdName,
            description: cmd.description || "Slash command",
            category: "slash",
            icon: <Terminal className="h-4 w-4" />,
            action: () => {
              router.push(`/chat?command=${encodeURIComponent(cmdName)}`);
              close();
            },
          });
        }
      }

      // Skills
      if (toolbox?.skills) {
        for (const skill of toolbox.skills) {
          allItems.push({
            id: `skill-${skill.name}`,
            name: skill.name,
            description: skill.description || "Skill",
            category: "skill",
            icon: <Zap className="h-4 w-4" />,
            action: () => {
              router.push(`/chat?skill=${encodeURIComponent(skill.name)}`);
              close();
            },
          });
        }
      }

      // Agents
      if (toolbox?.agents) {
        for (const agent of toolbox.agents) {
          allItems.push({
            id: `agent-${agent.name}`,
            name: agent.name,
            description: agent.description || "Agent",
            category: "agent",
            icon: <Bot className="h-4 w-4" />,
            action: () => {
              router.push(`/chat?agent=${encodeURIComponent(agent.name)}`);
              close();
            },
          });
        }
      }

      // Recent sessions (limit 5)
      if (sessions?.recentSessions) {
        const recent = sessions.recentSessions.slice(0, 5);
        for (const session of recent) {
          const label = session.firstMessage
            ? session.firstMessage.slice(0, 60)
            : session.id.slice(0, 12);
          allItems.push({
            id: `session-${session.id}`,
            name: label,
            description: session.projectName,
            category: "session",
            icon: <Hash className="h-4 w-4" />,
            action: () => {
              router.push(
                `/sessions/${encodeURIComponent(session.project)}/${session.id}`
              );
              close();
            },
          });
        }
      }

      setItems(allItems);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, buildStaticItems, close, router]);

  // Ctrl+K / Cmd+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Filtered + grouped items (memoized to avoid recalculating on every render)
  const filtered = useMemo(() => filterItems(items, query), [items, query]);
  const grouped = useMemo(() => groupByCategory(filtered), [filtered]);
  const flatFiltered = useMemo(
    () => grouped.flatMap(([, catItems]) => catItems),
    [grouped]
  );

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  // Keyboard navigation inside the palette
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, flatFiltered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (flatFiltered[activeIndex]) {
          flatFiltered[activeIndex].action();
        }
      }
    },
    [flatFiltered, activeIndex]
  );

  // Compute cumulative indices for data-index attributes
  const categoryStartIndices = useMemo(() => {
    const indices: number[] = [];
    let cumulative = 0;
    for (const [, catItems] of grouped) {
      indices.push(cumulative);
      cumulative += catItems.length;
    }
    return indices;
  }, [grouped]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => { if (!v) close(); else setOpen(true); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-150" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[20%] z-50 w-full max-w-[calc(100%-2rem)] sm:max-w-[600px] -translate-x-1/2 rounded-xl border bg-background shadow-2xl animate-in fade-in-0 slide-in-from-top-2 duration-150 outline-none"
          onKeyDown={handleKeyDown}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          {/* Search Input */}
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search pages, commands, skills, agents..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              Esc
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[340px] overflow-y-auto p-2">
            {loading && flatFiltered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : flatFiltered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No results found
              </div>
            ) : (
              grouped.map(([category, catItems], groupIdx) => {
                const startIdx = categoryStartIndices[groupIdx];
                return (
                  <div key={category} className="mb-2">
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {CATEGORY_LABELS[category]}
                    </div>
                    {catItems.map((item, i) => {
                      const itemIndex = startIdx + i;
                      const isActive = itemIndex === activeIndex;
                      return (
                        <button
                          key={item.id}
                          data-index={itemIndex}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                            isActive
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-accent/50"
                          )}
                          onClick={() => item.action()}
                          onMouseEnter={() => setActiveIndex(itemIndex)}
                        >
                          <span className="text-muted-foreground shrink-0">
                            {item.icon}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block truncate font-medium">
                              {item.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {item.description}
                            </span>
                          </span>
                          {item.shortcut && (
                            <kbd className="hidden sm:inline-flex shrink-0 items-center rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                              {item.shortcut}
                            </kbd>
                          )}
                          <Badge
                            variant="secondary"
                            className="hidden sm:inline-flex shrink-0 text-[10px] px-1.5 py-0"
                          >
                            {CATEGORY_LABELS[item.category]}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer hint */}
          <div className="border-t px-4 py-2 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border bg-muted font-mono text-[10px]">
                &uarr;&darr;
              </kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border bg-muted font-mono text-[10px]">
                Enter
              </kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border bg-muted font-mono text-[10px]">
                Esc
              </kbd>
              Close
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
