"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownContent } from "@/components/markdown-content";
import {
  Wrench, Plug, Sparkles, Command, Shield, Bot, BookOpen,
  RefreshCw, ChevronDown, ChevronRight, Info, AlertCircle,
  CheckCircle, Clock, Circle, HelpCircle, X, FolderOpen,
  ExternalLink, Zap, Hash,
} from "lucide-react";

// ---- Types ----

interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

interface MCPServersData {
  global: Record<string, MCPServerConfig>;
  projects: { project: string; servers: Record<string, MCPServerConfig> }[];
}

interface SkillInfo {
  name: string;
  description: string;
  allowedTools?: string[];
  content: string;
  path: string;
}

interface CommandInfo {
  name: string;
  description: string;
  content: string;
  path: string;
}

interface AgentInfo {
  name: string;
  description: string;
  content: string;
  path: string;
}

interface RuleInfo {
  name: string;
  group: string;
  preview: string;
  content: string;
  path: string;
}

interface HookEntry {
  type: string;
  matcher?: string;
  command: string;
  timeout?: number;
  description?: string;
}

interface ToolboxData {
  skills: SkillInfo[];
  commands: CommandInfo[];
  agents: AgentInfo[];
  rules: RuleInfo[];
  hooks: HookEntry[];
  mcp: MCPServersData;
}

type HealthStatus = "healthy" | "warning" | "timeout" | "error" | "checking" | "unknown";

const HEALTH_CONFIG: Record<HealthStatus, { color: string; icon: typeof CheckCircle; label: string }> = {
  healthy: { color: "text-green-500", icon: CheckCircle, label: "Healthy" },
  warning: { color: "text-yellow-500", icon: AlertCircle, label: "Warning" },
  timeout: { color: "text-orange-500", icon: Clock, label: "Timeout" },
  error: { color: "text-red-500", icon: AlertCircle, label: "Error" },
  checking: { color: "text-muted-foreground animate-spin", icon: RefreshCw, label: "Checking" },
  unknown: { color: "text-muted-foreground", icon: Circle, label: "Unknown" },
};

// ---- Help Dialog ----

function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background border rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-background z-10">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Toolbox Guide
          </h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="px-6 py-4">
          <MarkdownContent content={HELP_CONTENT} className="text-sm" />
        </div>
      </div>
    </div>
  );
}

const HELP_CONTENT = `
## What is Toolbox?

Toolbox is the **unified configuration center** for Claude Code. It gives you a read-only overview of all the extensions, rules, and integrations that shape how Claude Code works in your environment.

---

### MCP Servers
**Model Context Protocol** servers extend Claude's capabilities with external tools. Each server provides specialized functions (filesystem access, database queries, web scraping, etc.).

- **Global servers**: Configured in \`~/.claude/settings.json\` — available in all projects
- **Project servers**: Configured in \`.mcp.json\` files — scoped to specific projects
- **Health check**: Click the refresh icon to verify a server's executable is reachable

**Popular MCP servers**: filesystem, brave-search, github, postgres, puppeteer, memory

---

### Skills & Commands
**Skills** (\`~/.claude/skills/\`) are reusable prompt templates that Claude can invoke with the Skill tool. They define specialized behaviors with optional tool restrictions.

**Commands** (\`~/.claude/commands/\`) are user-invocable slash commands (e.g., \`/commit\`, \`/review-pr\`). They expand into full prompts when triggered.

---

### Hooks
Hooks are **shell commands** that run automatically at specific lifecycle events:

| Hook Type | When it runs |
|-----------|-------------|
| **PreToolUse** | Before a tool executes (can block/modify) |
| **PostToolUse** | After a tool completes |
| **SessionStart** | When a new session begins |
| **SessionEnd** | When a session ends |
| **Stop** | When Claude stops generating |
| **PreCompact** | Before context compaction |
| **PermissionRequest** | When permission is needed |

---

### Agents
Custom agent definitions (\`~/.claude/agents/\`) provide specialized personas with their own system prompts, model preferences, and tool restrictions. They can be used as subagents via the Task tool.

---

### Rules
Rules (\`~/.claude/rules/\`) are instruction files that Claude follows automatically. They're organized by category (e.g., \`common/\`, \`python/\`, \`typescript/\`) and loaded based on context.

---

### Configuration Paths
| Item | Location |
|------|----------|
| Settings | \`~/.claude/settings.json\` |
| MCP (global) | \`~/.claude/settings.json\` > \`mcpServers\` |
| MCP (project) | \`<project>/.mcp.json\` |
| Skills | \`~/.claude/skills/<name>/SKILL.md\` |
| Commands | \`~/.claude/commands/<name>.md\` |
| Agents | \`~/.claude/agents/<name>.md\` |
| Rules | \`~/.claude/rules/**/*.md\` |
| Hooks | \`~/.claude/settings.json\` > \`hooks\` |
`;

// ---- Expandable Card ----

function ExpandableCard({ title, subtitle, icon, badge, children }: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={expanded ? "ring-1 ring-primary/20" : ""}>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            {expanded ? <ChevronDown className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />}
            {icon}
            <div className="min-w-0">
              <CardTitle className="text-sm font-mono truncate">{title}</CardTitle>
              {subtitle && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{subtitle}</p>}
            </div>
          </div>
          <div className="flex-shrink-0">{badge}</div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 border-t mt-2">
          <div className="pt-3">{children}</div>
        </CardContent>
      )}
    </Card>
  );
}

// ---- Summary Stats ----

function SummaryStats({ data }: { data: ToolboxData }) {
  const mcpCount = Object.keys(data.mcp.global).length +
    data.mcp.projects.reduce((s, p) => s + Object.keys(p.servers).length, 0);

  const stats = [
    { icon: Plug, label: "MCP Servers", value: mcpCount, color: "text-blue-500" },
    { icon: Sparkles, label: "Skills", value: data.skills.length, color: "text-amber-500" },
    { icon: Command, label: "Commands", value: data.commands.length, color: "text-purple-500" },
    { icon: Shield, label: "Hooks", value: data.hooks.length, color: "text-green-500" },
    { icon: Bot, label: "Agents", value: data.agents.length, color: "text-pink-500" },
    { icon: BookOpen, label: "Rules", value: data.rules.length, color: "text-cyan-500" },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {stats.map(({ icon: Icon, label, value, color }) => (
        <Card key={label} className="text-center">
          <CardContent className="py-3 px-2">
            <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-[10px] text-muted-foreground">{label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---- MCP Tab ----

function MCPTab({ data, health, onCheckHealth }: {
  data: MCPServersData;
  health: Record<string, HealthStatus>;
  onCheckHealth: (name: string, command: string) => void;
}) {
  const globalEntries = Object.entries(data.global);
  const hasGlobal = globalEntries.length > 0;
  const hasProject = data.projects.length > 0;

  if (!hasGlobal && !hasProject) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <Plug className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium mb-1">No MCP servers configured</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            MCP servers extend Claude with external tools (filesystem, search, databases, etc.).
            Configure them in <code className="bg-muted px-1 rounded">~/.claude/settings.json</code> or project <code className="bg-muted px-1 rounded">.mcp.json</code>.
          </p>
        </CardContent>
      </Card>
    );
  }

  const renderServer = (name: string, config: MCPServerConfig, scope: string) => {
    const status = health[name] || "unknown";
    const hcfg = HEALTH_CONFIG[status];
    const HIcon = hcfg.icon;
    const cmdDisplay = config.args?.length ? `${config.command} ${config.args.join(" ")}` : config.command;

    return (
      <Card key={`${scope}-${name}`} className="group hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`h-8 w-8 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center`}>
                <Plug className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-mono">{name}</CardTitle>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant={scope === "Global" ? "default" : "secondary"} className="text-[10px] h-4 px-1">{scope}</Badge>
                  <span className={`text-[10px] flex items-center gap-0.5 ${hcfg.color}`}>
                    <HIcon className="h-3 w-3" /> {hcfg.label}
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onCheckHealth(name, config.command)}
            >
              <RefreshCw className="h-3 w-3 mr-1" /> Check
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          <code className="text-xs bg-muted px-2 py-1.5 rounded block break-all font-mono">{cmdDisplay}</code>
          {config.env && Object.keys(config.env).length > 0 && (
            <div className="space-y-0.5">
              {Object.entries(config.env).map(([k, v]) => (
                <div key={k} className="text-[11px] text-muted-foreground font-mono px-1">
                  <span className="text-foreground/70">{k}</span>=<span className="text-green-600 dark:text-green-400">{v}</span>
                </div>
              ))}
            </div>
          )}
          {config.cwd && (
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <FolderOpen className="h-3 w-3" /> {config.cwd}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {hasGlobal && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="default" className="text-xs">Global</Badge>
            <span className="text-xs text-muted-foreground">{globalEntries.length} server{globalEntries.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {globalEntries.map(([name, config]) => renderServer(name, config, "Global"))}
          </div>
        </section>
      )}
      {hasProject && data.projects.map(({ project, servers }) => (
        <section key={project}>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="secondary" className="text-xs font-mono">{project}</Badge>
            <span className="text-xs text-muted-foreground">{Object.keys(servers).length} server{Object.keys(servers).length !== 1 ? "s" : ""}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(servers).map(([name, config]) => renderServer(name, config, project))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---- Skills Tab ----

function SkillsTab({ skills, commands }: { skills: SkillInfo[]; commands: CommandInfo[] }) {
  if (skills.length === 0 && commands.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium mb-1">No skills or commands found</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Skills provide reusable prompt templates. Commands define slash commands like <code className="bg-muted px-1 rounded">/commit</code>.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {skills.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold">Skills</span>
            <Badge variant="outline" className="text-xs">{skills.length}</Badge>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {skills.map((skill) => (
              <ExpandableCard
                key={skill.name}
                title={skill.name}
                subtitle={skill.description}
                icon={<div className="h-7 w-7 rounded-md bg-amber-500/10 flex items-center justify-center flex-shrink-0"><Sparkles className="h-3.5 w-3.5 text-amber-500" /></div>}
                badge={skill.allowedTools && (
                  <div className="flex gap-1 flex-wrap">
                    {skill.allowedTools.slice(0, 2).map(t => (
                      <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                    ))}
                    {skill.allowedTools.length > 2 && <Badge variant="outline" className="text-[10px]">+{skill.allowedTools.length - 2}</Badge>}
                  </div>
                )}
              >
                <MarkdownContent content={skill.content} className="text-xs" />
              </ExpandableCard>
            ))}
          </div>
        </section>
      )}

      {commands.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Command className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-semibold">Slash Commands</span>
            <Badge variant="outline" className="text-xs">{commands.length}</Badge>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {commands.map((cmd) => (
              <ExpandableCard
                key={cmd.name}
                title={`/${cmd.name}`}
                subtitle={cmd.description}
                icon={<div className="h-7 w-7 rounded-md bg-purple-500/10 flex items-center justify-center flex-shrink-0"><Command className="h-3.5 w-3.5 text-purple-500" /></div>}
              >
                <MarkdownContent content={cmd.content} className="text-xs" />
              </ExpandableCard>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---- Hooks Tab ----

const HOOK_TYPES = [
  "PreToolUse", "PostToolUse", "Stop", "SessionStart", "SessionEnd",
  "PreCompact", "PermissionRequest", "SubagentStart", "SubagentStop",
];

const HOOK_COLORS: Record<string, string> = {
  PreToolUse: "bg-blue-500/10 text-blue-500",
  PostToolUse: "bg-cyan-500/10 text-cyan-500",
  Stop: "bg-red-500/10 text-red-500",
  SessionStart: "bg-green-500/10 text-green-500",
  SessionEnd: "bg-orange-500/10 text-orange-500",
  PreCompact: "bg-purple-500/10 text-purple-500",
  PermissionRequest: "bg-amber-500/10 text-amber-500",
};

function HooksTab({ hooks }: { hooks: HookEntry[] }) {
  if (hooks.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <Shield className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium mb-1">No hooks configured</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Hooks run shell commands at lifecycle events (before/after tool use, session start/end, etc.).
          </p>
        </CardContent>
      </Card>
    );
  }

  const grouped = new Map<string, HookEntry[]>();
  for (const hook of hooks) {
    const list = grouped.get(hook.type) || [];
    list.push(hook);
    grouped.set(hook.type, list);
  }

  const allTypes = [...HOOK_TYPES, ...Array.from(grouped.keys()).filter(t => !HOOK_TYPES.includes(t))];

  return (
    <div className="space-y-4">
      {allTypes.map((type) => {
        const items = grouped.get(type);
        if (!items) return null;
        const colorClass = HOOK_COLORS[type] || "bg-zinc-500/10 text-zinc-500";

        return (
          <section key={type}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`h-6 px-2 rounded-md text-[11px] font-mono font-semibold flex items-center ${colorClass}`}>
                {type}
              </div>
              <Badge variant="outline" className="text-[10px]">{items.length} hook{items.length > 1 ? "s" : ""}</Badge>
            </div>
            <div className="space-y-1.5">
              {items.map((hook, i) => (
                <Card key={i} className="bg-muted/20">
                  <CardContent className="py-2.5 px-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {hook.description && (
                          <p className="text-xs text-foreground/80 mb-1">{hook.description}</p>
                        )}
                        {hook.matcher && (
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] text-muted-foreground">match:</span>
                            <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono">{hook.matcher}</code>
                          </div>
                        )}
                        <div className="bg-zinc-900 dark:bg-zinc-950 text-green-400 px-2.5 py-1.5 rounded font-mono text-[11px] break-all">
                          $ {hook.command}
                        </div>
                      </div>
                      {hook.timeout && (
                        <Badge variant="outline" className="text-[10px] flex-shrink-0">
                          <Clock className="h-2.5 w-2.5 mr-0.5" /> {hook.timeout}s
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ---- Agents Tab ----

function AgentsTab({ agents }: { agents: AgentInfo[] }) {
  if (agents.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <Bot className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium mb-1">No custom agents found</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Custom agents define specialized personas with their own prompts and tool access.
            Create them at <code className="bg-muted px-1 rounded">~/.claude/agents/</code>.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
      {agents.map((agent) => (
        <ExpandableCard
          key={agent.name}
          title={agent.name}
          subtitle={agent.description}
          icon={<div className="h-7 w-7 rounded-md bg-pink-500/10 flex items-center justify-center flex-shrink-0"><Bot className="h-3.5 w-3.5 text-pink-500" /></div>}
          badge={<Badge variant="secondary" className="text-[10px]">Agent</Badge>}
        >
          <MarkdownContent content={agent.content} className="text-xs" />
        </ExpandableCard>
      ))}
    </div>
  );
}

// ---- Rules Tab ----

function RulesTab({ rules }: { rules: RuleInfo[] }) {
  if (rules.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium mb-1">No rules found</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Rules are instruction files Claude follows automatically.
            Organize them by topic at <code className="bg-muted px-1 rounded">~/.claude/rules/</code>.
          </p>
        </CardContent>
      </Card>
    );
  }

  const grouped = new Map<string, RuleInfo[]>();
  for (const rule of rules) {
    const list = grouped.get(rule.group) || [];
    list.push(rule);
    grouped.set(rule.group, list);
  }

  return (
    <div className="space-y-5">
      {Array.from(grouped.entries()).map(([group, items]) => (
        <section key={group}>
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen className="h-4 w-4 text-cyan-500" />
            <span className="text-sm font-semibold">{group}</span>
            <Badge variant="outline" className="text-xs">{items.length}</Badge>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {items.map((rule) => (
              <ExpandableCard
                key={rule.path}
                title={rule.name}
                subtitle={rule.preview.split("\n")[0]?.replace(/^#+\s*/, "").slice(0, 80)}
                icon={<div className="h-7 w-7 rounded-md bg-cyan-500/10 flex items-center justify-center flex-shrink-0"><BookOpen className="h-3.5 w-3.5 text-cyan-500" /></div>}
              >
                <MarkdownContent content={rule.content} className="text-xs" />
              </ExpandableCard>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---- Main Page ----

export default function ToolboxPage() {
  const [data, setData] = useState<ToolboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<Record<string, HealthStatus>>({});
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    fetch("/api/toolbox")
      .then((r) => r.json())
      .then((d: ToolboxData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const checkHealth = useCallback((name: string, command: string) => {
    setHealth((prev) => ({ ...prev, [name]: "checking" }));
    fetch(`/api/toolbox/mcp/health?name=${encodeURIComponent(name)}&command=${encodeURIComponent(command)}`)
      .then((r) => r.json())
      .then((d: { status: string }) => {
        setHealth((prev) => ({ ...prev, [name]: d.status as HealthStatus }));
      })
      .catch(() => {
        setHealth((prev) => ({ ...prev, [name]: "error" }));
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-lg">Failed to load toolbox</h2>
      </div>
    );
  }

  const mcpCount = Object.keys(data.mcp.global).length + data.mcp.projects.reduce((s, p) => s + Object.keys(p.servers).length, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="h-6 w-6" />
            Toolbox
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Claude Code configuration center — MCP servers, skills, hooks, agents & rules
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowHelp(true)}>
          <HelpCircle className="h-4 w-4" /> Help
        </Button>
      </div>

      {/* Summary Stats */}
      <SummaryStats data={data} />

      {/* Tabs */}
      <Tabs defaultValue="mcp">
        <TabsList>
          <TabsTrigger value="mcp" className="gap-1.5">
            <Plug className="h-3.5 w-3.5" /> MCP
            {mcpCount > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">{mcpCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Skills
            {(data.skills.length + data.commands.length) > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">{data.skills.length + data.commands.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="hooks" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Hooks
            {data.hooks.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">{data.hooks.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-1.5">
            <Bot className="h-3.5 w-3.5" /> Agents
            {data.agents.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">{data.agents.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Rules
            {data.rules.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">{data.rules.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mcp">
          <MCPTab data={data.mcp} health={health} onCheckHealth={checkHealth} />
        </TabsContent>
        <TabsContent value="skills">
          <SkillsTab skills={data.skills} commands={data.commands} />
        </TabsContent>
        <TabsContent value="hooks">
          <HooksTab hooks={data.hooks} />
        </TabsContent>
        <TabsContent value="agents">
          <AgentsTab agents={data.agents} />
        </TabsContent>
        <TabsContent value="rules">
          <RulesTab rules={data.rules} />
        </TabsContent>
      </Tabs>

      {/* Help Dialog */}
      <HelpDialog open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
