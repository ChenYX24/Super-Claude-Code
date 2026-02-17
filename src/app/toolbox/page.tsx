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
  CheckCircle, Clock, Circle,
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

const HEALTH_CONFIG: Record<HealthStatus, { color: string; icon: typeof CheckCircle }> = {
  healthy: { color: "text-green-500", icon: CheckCircle },
  warning: { color: "text-yellow-500", icon: AlertCircle },
  timeout: { color: "text-orange-500", icon: Clock },
  error: { color: "text-red-500", icon: AlertCircle },
  checking: { color: "text-muted-foreground animate-spin", icon: RefreshCw },
  unknown: { color: "text-muted-foreground", icon: Circle },
};

// ---- Expandable Card ----

function ExpandableCard({ title, subtitle, badge, children }: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2">
            {expanded ? <ChevronDown className="h-4 w-4 mt-0.5 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground" />}
            <div>
              <CardTitle className="text-sm font-mono">{title}</CardTitle>
              {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {badge}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
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
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="py-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">No MCP servers configured</p>
            <p className="text-xs text-amber-600 mt-1">
              Add MCP servers in <code>~/.claude/settings.json</code> or project <code>.mcp.json</code>.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderServer = (name: string, config: MCPServerConfig, scope: string) => {
    const status = health[name] || "unknown";
    const cfg = HEALTH_CONFIG[status];
    const Icon = cfg.icon;
    const cmdDisplay = config.args?.length ? `${config.command} ${config.args.join(" ")}` : config.command;

    return (
      <Card key={`${scope}-${name}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${cfg.color}`} />
              <CardTitle className="text-sm font-mono">{name}</CardTitle>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant={scope === "Global" ? "default" : "secondary"} className="text-xs">{scope}</Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => onCheckHealth(name, config.command)}
                title="Check health"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Command</div>
            <code className="text-xs bg-muted px-2 py-1 rounded block break-all">{cmdDisplay}</code>
          </div>
          {config.env && Object.keys(config.env).length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Env</div>
              {Object.entries(config.env).map(([k, v]) => (
                <div key={k} className="text-xs bg-muted/50 px-2 py-0.5 rounded font-mono">{k}: {v}</div>
              ))}
            </div>
          )}
          {config.cwd && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">CWD</div>
              <code className="text-xs bg-muted px-2 py-1 rounded block break-all">{config.cwd}</code>
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
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Badge variant="default" className="text-xs">Global</Badge>
            <span className="text-muted-foreground text-xs">{globalEntries.length} server{globalEntries.length !== 1 ? "s" : ""}</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {globalEntries.map(([name, config]) => renderServer(name, config, "Global"))}
          </div>
        </section>
      )}
      {hasProject && data.projects.map(({ project, servers }) => (
        <section key={project}>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{project}</Badge>
            <span className="text-muted-foreground text-xs">{Object.keys(servers).length} server{Object.keys(servers).length !== 1 ? "s" : ""}</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No skills or commands found</p>
          <p className="text-xs mt-1">Add skills to <code>~/.claude/skills/</code> or commands to <code>~/.claude/commands/</code></p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {skills.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Skills ({skills.length})
          </h3>
          <div className="space-y-2">
            {skills.map((skill) => (
              <ExpandableCard
                key={skill.name}
                title={skill.name}
                subtitle={skill.description}
                badge={skill.allowedTools && (
                  <div className="flex gap-1 flex-wrap">
                    {skill.allowedTools.slice(0, 3).map(t => (
                      <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                    ))}
                    {skill.allowedTools.length > 3 && <Badge variant="outline" className="text-[10px]">+{skill.allowedTools.length - 3}</Badge>}
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
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Command className="h-4 w-4" /> Commands ({commands.length})
          </h3>
          <div className="space-y-2">
            {commands.map((cmd) => (
              <ExpandableCard key={cmd.name} title={`/${cmd.name}`} subtitle={cmd.description}>
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

const HOOK_TYPES = ["PreToolUse", "PostToolUse", "Stop", "SessionStart", "SessionEnd"];

function HooksTab({ hooks }: { hooks: HookEntry[] }) {
  if (hooks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No hooks configured</p>
          <p className="text-xs mt-1">Add hooks in <code>~/.claude/settings.json</code> under the <code>hooks</code> field</p>
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

  return (
    <div className="space-y-4">
      {HOOK_TYPES.map((type) => {
        const items = grouped.get(type);
        if (!items) return null;
        return (
          <section key={type}>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4" /> {type}
              <Badge variant="outline" className="text-xs">{items.length}</Badge>
            </h3>
            <div className="space-y-2">
              {items.map((hook, i) => (
                <Card key={i}>
                  <CardContent className="py-3 space-y-2">
                    {hook.matcher && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Matcher:</span>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{hook.matcher}</code>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-muted-foreground">Command:</span>
                      <code className="text-xs bg-zinc-900 text-green-400 dark:bg-zinc-950 px-2 py-1 rounded block mt-1 font-mono">
                        $ {hook.command}
                      </code>
                    </div>
                    {hook.timeout && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Timeout:</span>
                        <span className="text-xs">{hook.timeout}ms</span>
                      </div>
                    )}
                    {hook.description && <p className="text-xs text-muted-foreground">{hook.description}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}

      {/* Show any hook types not in the predefined list */}
      {Array.from(grouped.entries())
        .filter(([type]) => !HOOK_TYPES.includes(type))
        .map(([type, items]) => (
          <section key={type}>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4" /> {type}
              <Badge variant="outline" className="text-xs">{items.length}</Badge>
            </h3>
            <div className="space-y-2">
              {items.map((hook, i) => (
                <Card key={i}>
                  <CardContent className="py-3">
                    <code className="text-xs bg-zinc-900 text-green-400 px-2 py-1 rounded block font-mono">$ {hook.command}</code>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}

// ---- Agents Tab ----

function AgentsTab({ agents }: { agents: AgentInfo[] }) {
  if (agents.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No custom agents found</p>
          <p className="text-xs mt-1">Add agent definitions to <code>~/.claude/agents/</code></p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {agents.map((agent) => (
        <ExpandableCard
          key={agent.name}
          title={agent.name}
          subtitle={agent.description}
          badge={<Badge variant="secondary" className="text-xs"><Bot className="h-3 w-3 mr-1" />Agent</Badge>}
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
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No rules found</p>
          <p className="text-xs mt-1">Add rules to <code>~/.claude/rules/</code></p>
        </CardContent>
      </Card>
    );
  }

  // Group by group name
  const grouped = new Map<string, RuleInfo[]>();
  for (const rule of rules) {
    const list = grouped.get(rule.group) || [];
    list.push(rule);
    grouped.set(rule.group, list);
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([group, items]) => (
        <section key={group}>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> {group}
            <Badge variant="outline" className="text-xs">{items.length}</Badge>
          </h3>
          <div className="space-y-2">
            {items.map((rule) => (
              <ExpandableCard key={rule.path} title={rule.name} subtitle={rule.preview.split("\n")[0]?.slice(0, 80)}>
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Wrench className="h-6 w-6" />
        Toolbox
      </h1>

      <Tabs defaultValue="mcp">
        <TabsList>
          <TabsTrigger value="mcp" className="gap-1.5">
            <Plug className="h-3.5 w-3.5" /> MCP Servers
            {mcpCount > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">{mcpCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Skills & Commands
            {(data.skills.length + data.commands.length) > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">{data.skills.length + data.commands.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="hooks" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Hooks
            {data.hooks.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">{data.hooks.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-1.5">
            <Bot className="h-3.5 w-3.5" /> Agents
            {data.agents.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">{data.agents.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Rules
            {data.rules.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">{data.rules.length}</Badge>}
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
    </div>
  );
}
