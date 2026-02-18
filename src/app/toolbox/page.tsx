"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownContent } from "@/components/markdown-content";
import { useToast } from "@/components/toast";
import { AgentDialog } from "@/components/toolbox/agent-dialog";
import { RuleDialog } from "@/components/toolbox/rule-dialog";
import { MCP_REGISTRY, MCP_CATEGORIES, type MCPRegistryEntry } from "@/lib/mcp-registry";
import {
  SKILL_TEMPLATES,
  AGENT_TEMPLATES,
  RULE_TEMPLATES,
  TOOL_CATEGORIES,
  type ToolTemplate,
} from "@/lib/tools-registry";
import {
  Wrench, Plug, Sparkles, Command, Shield, Bot, BookOpen,
  RefreshCw, ChevronDown, ChevronRight, Info, AlertCircle,
  CheckCircle, Clock, Circle, HelpCircle, X, FolderOpen,
  ExternalLink, Zap, Hash, Plus, Pencil, Trash2, ShoppingBag,
  Search,
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
  index?: number;
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

// ---- MCP Server Dialog ----

interface MCPDialogProps {
  open: boolean;
  onClose: () => void;
  mode: "add" | "edit";
  scope: "global" | string;
  serverName?: string;
  serverConfig?: MCPServerConfig;
  onSuccess: () => void;
}

function MCPServerDialog({
  open,
  onClose,
  mode,
  scope,
  serverName = "",
  serverConfig,
  onSuccess,
}: MCPDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState(serverName);
  const [command, setCommand] = useState(serverConfig?.command || "");
  const [args, setArgs] = useState(serverConfig?.args?.join(", ") || "");
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>(
    serverConfig?.env
      ? Object.entries(serverConfig.env).map(([key, value]) => ({ key, value }))
      : []
  );
  const [currentScope, setCurrentScope] = useState<"global" | "project">(
    scope === "global" ? "global" : "project"
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(serverName);
      setCommand(serverConfig?.command || "");
      setArgs(serverConfig?.args?.join(", ") || "");
      setEnvVars(
        serverConfig?.env
          ? Object.entries(serverConfig.env).map(([key, value]) => ({ key, value }))
          : []
      );
      setCurrentScope(scope === "global" ? "global" : "project");
    }
  }, [open, serverName, serverConfig, scope]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!name.trim() || !command.trim()) {
      toast("Server name and command are required", "error");
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      toast("Server name must be alphanumeric (hyphens and underscores allowed)", "error");
      return;
    }

    setSubmitting(true);

    const config: MCPServerConfig = {
      command: command.trim(),
      args: args.trim() ? args.split(",").map((a) => a.trim()).filter(Boolean) : undefined,
      env: envVars.length > 0
        ? Object.fromEntries(envVars.filter((e) => e.key && e.value).map((e) => [e.key, e.value]))
        : undefined,
    };

    const requestBody = {
      scope: currentScope,
      name: name.trim(),
      config,
    };

    try {
      const method = mode === "add" ? "POST" : "PUT";
      const res = await fetch("/api/toolbox/mcp", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (res.ok) {
        toast(data.message || `Server ${mode === "add" ? "added" : "updated"} successfully`, "success");
        onSuccess();
        onClose();
      } else {
        toast(data.error || "Operation failed", "error");
      }
    } catch (error) {
      toast("Failed to save server", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: "", value: "" }]);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const updateEnvVar = (index: number, field: "key" | "value", value: string) => {
    const updated = [...envVars];
    updated[index][field] = value;
    setEnvVars(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background border rounded-xl shadow-2xl max-w-xl w-full mx-4 max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-background z-10">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Plug className="h-5 w-5 text-primary" />
            {mode === "add" ? "Add MCP Server" : "Edit MCP Server"}
          </h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Server Name */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Server Name</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md text-sm font-mono bg-background"
              placeholder="my-server"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={mode === "edit"}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Alphanumeric characters, hyphens, and underscores only
            </p>
          </div>

          {/* Command */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Command *</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md text-sm font-mono bg-background"
              placeholder="npx"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
            />
          </div>

          {/* Arguments */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Arguments</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md text-sm font-mono bg-background"
              placeholder="-y, @modelcontextprotocol/server-filesystem"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">Comma-separated list</p>
          </div>

          {/* Environment Variables */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">Environment Variables</label>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={addEnvVar}
              >
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            {envVars.length === 0 ? (
              <p className="text-xs text-muted-foreground">No environment variables</p>
            ) : (
              <div className="space-y-2">
                {envVars.map((env, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-2 py-1.5 border rounded text-xs font-mono bg-background"
                      placeholder="KEY"
                      value={env.key}
                      onChange={(e) => updateEnvVar(i, "key", e.target.value)}
                    />
                    <input
                      type="text"
                      className="flex-1 px-2 py-1.5 border rounded text-xs font-mono bg-background"
                      placeholder="value"
                      value={env.value}
                      onChange={(e) => updateEnvVar(i, "value", e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => removeEnvVar(i)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scope (only for add mode) */}
          {mode === "add" && (
            <div>
              <label className="text-sm font-medium block mb-1.5">Scope</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    value="global"
                    checked={currentScope === "global"}
                    onChange={() => setCurrentScope("global")}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Global</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    value="project"
                    checked={currentScope === "project"}
                    onChange={() => setCurrentScope("project")}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Project</span>
                </label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {currentScope === "global"
                  ? "Available in all projects"
                  : "Scoped to current project (not yet implemented)"}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : mode === "add" ? "Add Server" : "Update Server"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Marketplace Install Dialog ----

interface InstallDialogProps {
  open: boolean;
  onClose: () => void;
  entry: MCPRegistryEntry | null;
  onSuccess: () => void;
}

function MarketplaceInstallDialog({ open, onClose, entry, onSuccess }: InstallDialogProps) {
  const { toast } = useToast();
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string; description?: string }>>([]);
  const [scope, setScope] = useState<"global" | "project">("global");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && entry) {
      setCommand(entry.command);
      setArgs(entry.args.join(", "));
      setEnvVars(
        entry.env
          ? Object.entries(entry.env).map(([key, value]) => ({
              key,
              value,
              description: entry.envDescriptions?.[key],
            }))
          : []
      );
      setScope("global");
    }
  }, [open, entry]);

  if (!open || !entry) return null;

  const handleSubmit = async () => {
    if (!command.trim()) {
      toast("Command is required", "error");
      return;
    }

    // Validate env vars if required
    if (entry.env && envVars.some((e) => !e.value.trim())) {
      toast("All environment variables must be filled", "error");
      return;
    }

    setSubmitting(true);

    const config: MCPServerConfig = {
      command: command.trim(),
      args: args.trim() ? args.split(",").map((a) => a.trim()).filter(Boolean) : undefined,
      env: envVars.length > 0
        ? Object.fromEntries(envVars.filter((e) => e.key && e.value).map((e) => [e.key, e.value]))
        : undefined,
    };

    const requestBody = {
      scope,
      name: entry.name,
      config,
    };

    try {
      const res = await fetch("/api/toolbox/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (res.ok) {
        toast(data.message || "Server installed successfully", "success");
        onSuccess();
        onClose();
      } else {
        toast(data.error || "Installation failed", "error");
      }
    } catch (error) {
      toast("Failed to install server", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const updateEnvVar = (index: number, field: "key" | "value", value: string) => {
    const updated = [...envVars];
    updated[index][field] = value;
    setEnvVars(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background border rounded-xl shadow-2xl max-w-xl w-full mx-4 max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-background z-10">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Install MCP Server
          </h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Server Name */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Server Name</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md text-sm font-mono bg-muted"
              value={entry.name}
              disabled
            />
          </div>

          {/* Description */}
          {entry.description && (
            <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
              {entry.description}
            </div>
          )}

          {/* Command Preview */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Command Preview</label>
            <code className="text-xs bg-muted px-3 py-2 rounded block break-all font-mono">
              {command} {args}
            </code>
          </div>

          {/* Environment Variables */}
          {envVars.length > 0 && (
            <div>
              <label className="text-sm font-medium block mb-1.5">Environment Variables *</label>
              <div className="space-y-2">
                {envVars.map((env, i) => (
                  <div key={i}>
                    <label className="text-xs text-muted-foreground block mb-1">{env.key}</label>
                    <input
                      type="text"
                      className="w-full px-2 py-1.5 border rounded text-xs font-mono bg-background"
                      placeholder={env.description || "value"}
                      value={env.value}
                      onChange={(e) => updateEnvVar(i, "value", e.target.value)}
                    />
                    {env.description && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{env.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Arguments (Editable) */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Arguments</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md text-sm font-mono bg-background"
              placeholder="Comma-separated list"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">You can customize the arguments if needed</p>
          </div>

          {/* Scope */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Scope</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="install-scope"
                  value="global"
                  checked={scope === "global"}
                  onChange={() => setScope("global")}
                  className="h-4 w-4"
                />
                <span className="text-sm">Global</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="install-scope"
                  value="project"
                  checked={scope === "project"}
                  onChange={() => setScope("project")}
                  className="h-4 w-4"
                />
                <span className="text-sm">Project</span>
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {scope === "global"
                ? "Available in all projects"
                : "Scoped to current project (not yet implemented)"}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Installing..." : "Install"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Delete Confirmation Dialog ----

interface DeleteDialogProps {
  open: boolean;
  onClose: () => void;
  serverName: string;
  scope: string;
  onConfirm: () => void;
}

function DeleteConfirmDialog({ open, onClose, serverName, scope, onConfirm }: DeleteDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background border rounded-xl shadow-2xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Delete MCP Server
          </h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete the MCP server{" "}
            <span className="font-mono font-semibold text-foreground">{serverName}</span> from{" "}
            <span className="font-semibold">{scope === "global" ? "global" : scope}</span> scope?
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">
            This action cannot be undone.
          </p>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- MCP Tab ----

function MCPTab({ data, health, onCheckHealth, onRefresh }: {
  data: MCPServersData;
  health: Record<string, HealthStatus>;
  onCheckHealth: (name: string, command: string) => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const globalEntries = Object.entries(data.global);
  const hasGlobal = globalEntries.length > 0;
  const hasProject = data.projects.length > 0;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [dialogScope, setDialogScope] = useState<"global" | string>("global");
  const [dialogServerName, setDialogServerName] = useState("");
  const [dialogServerConfig, setDialogServerConfig] = useState<MCPServerConfig | undefined>();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteServerName, setDeleteServerName] = useState("");
  const [deleteScope, setDeleteScope] = useState("");

  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<MCPRegistryEntry | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const handleAddServer = () => {
    setDialogMode("add");
    setDialogScope("global");
    setDialogServerName("");
    setDialogServerConfig(undefined);
    setDialogOpen(true);
  };

  const handleEditServer = (name: string, config: MCPServerConfig, scope: string) => {
    setDialogMode("edit");
    setDialogScope(scope);
    setDialogServerName(name);
    setDialogServerConfig(config);
    setDialogOpen(true);
  };

  const handleDeleteClick = (name: string, scope: string) => {
    setDeleteServerName(name);
    setDeleteScope(scope);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const res = await fetch("/api/toolbox/mcp", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: deleteScope, name: deleteServerName }),
      });

      const data = await res.json();

      if (res.ok) {
        toast(data.message || "Server deleted successfully", "success");
        onRefresh();
      } else {
        toast(data.error || "Failed to delete server", "error");
      }
    } catch (error) {
      toast("Failed to delete server", "error");
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const handleDialogSuccess = () => {
    onRefresh();
  };

  const handleInstallClick = (entry: MCPRegistryEntry) => {
    setSelectedEntry(entry);
    setInstallDialogOpen(true);
  };

  const handleInstallSuccess = () => {
    onRefresh();
  };

  // Get installed server names for checking
  const installedNames = new Set([
    ...Object.keys(data.global),
    ...data.projects.flatMap(p => Object.keys(p.servers)),
  ]);

  // Filter marketplace entries
  const filteredEntries = MCP_REGISTRY.filter((entry) => {
    const matchesCategory = categoryFilter === "All" || entry.category === categoryFilter;
    const matchesSearch = !searchQuery ||
      entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (!hasGlobal && !hasProject) {
    return (
      <>
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={handleAddServer} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Server
          </Button>
        </div>
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
        <MCPServerDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          mode={dialogMode}
          scope={dialogScope}
          serverName={dialogServerName}
          serverConfig={dialogServerConfig}
          onSuccess={handleDialogSuccess}
        />
      </>
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
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onCheckHealth(name, config.command)}
              >
                <RefreshCw className="h-3 w-3 mr-1" /> Check
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => handleEditServer(name, config, scope === "Global" ? "global" : scope)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => handleDeleteClick(name, scope === "Global" ? "global" : scope)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
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
    <>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={handleAddServer} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Server
        </Button>
      </div>

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

        {/* Separator */}
        <div className="border-t my-6" />

        {/* Marketplace Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">MCP Marketplace</h2>
            <Badge variant="outline" className="text-xs">{MCP_REGISTRY.length} available</Badge>
          </div>

          {/* Category Filter + Search */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex gap-2 flex-wrap">
              {MCP_CATEGORIES.map((cat) => (
                <Button
                  key={cat}
                  variant={categoryFilter === cat ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search servers..."
                className="w-full h-7 pl-8 pr-3 text-xs border rounded-md bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Marketplace Cards */}
          {filteredEntries.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No servers found matching your filters</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredEntries.map((entry) => {
                const isInstalled = installedNames.has(entry.name);

                return (
                  <Card key={entry.name} className="group hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <ShoppingBag className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-sm font-mono truncate">{entry.name}</CardTitle>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                {entry.category}
                              </Badge>
                              {entry.official && (
                                <Badge variant="default" className="text-[10px] h-4 px-1">
                                  Official
                                </Badge>
                              )}
                              {isInstalled && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1 text-green-600 border-green-600">
                                  Installed
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      <p className="text-xs text-muted-foreground line-clamp-2">{entry.description}</p>
                      <Button
                        size="sm"
                        variant={isInstalled ? "outline" : "default"}
                        className="w-full h-7 text-xs"
                        disabled={isInstalled}
                        onClick={() => handleInstallClick(entry)}
                      >
                        {isInstalled ? "Installed" : "Install"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* External Links */}
          <div className="mt-4 flex gap-3 text-xs text-muted-foreground">
            <a href="https://github.com/modelcontextprotocol/servers" target="_blank" rel="noopener noreferrer" className="hover:text-primary flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />Official Servers
            </a>
            <a href="https://glama.ai/mcp/servers" target="_blank" rel="noopener noreferrer" className="hover:text-primary flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />Glama Directory
            </a>
            <a href="https://smithery.ai/" target="_blank" rel="noopener noreferrer" className="hover:text-primary flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />Smithery
            </a>
          </div>
        </section>
      </div>

      {/* Dialogs */}
      <MCPServerDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        mode={dialogMode}
        scope={dialogScope}
        serverName={dialogServerName}
        serverConfig={dialogServerConfig}
        onSuccess={handleDialogSuccess}
      />
      <MarketplaceInstallDialog
        open={installDialogOpen}
        onClose={() => setInstallDialogOpen(false)}
        entry={selectedEntry}
        onSuccess={handleInstallSuccess}
      />
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        serverName={deleteServerName}
        scope={deleteScope}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}

// ---- Skills Tab ----

function SkillsTab({ skills, commands, onRefresh }: {
  skills: SkillInfo[];
  commands: CommandInfo[];
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [installing, setInstalling] = useState<string | null>(null);

  // Get installed skill names
  const installedNames = new Set(skills.map(s => s.name));

  // Filter templates
  const filteredTemplates = SKILL_TEMPLATES.filter((template) => {
    const matchesCategory = categoryFilter === "All" || template.category === categoryFilter;
    const matchesSearch = !searchQuery ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleInstall = async (template: ToolTemplate) => {
    setInstalling(template.name);
    try {
      const res = await fetch("/api/toolbox/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          content: template.content,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast(data.message || "Skill installed successfully", "success");
        onRefresh();
      } else {
        toast(data.error || "Installation failed", "error");
      }
    } catch (error) {
      toast("Failed to install skill", "error");
    } finally {
      setInstalling(null);
    }
  };

  const hasInstalledItems = skills.length > 0 || commands.length > 0;

  return (
    <div className="space-y-6">
      {/* Installed Skills */}
      {skills.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold">Installed Skills</span>
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

      {/* Installed Commands */}
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

      {/* Separator */}
      {hasInstalledItems && <div className="border-t my-6" />}

      {/* Skill Templates Marketplace */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <ShoppingBag className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">Skill Templates</span>
          <Badge variant="outline" className="text-xs">{SKILL_TEMPLATES.length}</Badge>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="flex gap-1 flex-wrap">
            {TOOL_CATEGORIES.skills.map((cat) => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setCategoryFilter(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search templates..."
              className="w-full h-7 pl-7 pr-2 text-xs border rounded-md bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Template Cards */}
        {filteredTemplates.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-6 text-center">
              <p className="text-sm text-muted-foreground">No templates found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filteredTemplates.map((template) => {
              const isInstalled = installedNames.has(template.name);
              return (
                <Card key={template.name} className="group hover:shadow-md transition-shadow">
                  <CardContent className="pt-4 pb-3 px-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-mono font-semibold truncate">{template.name}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {template.description}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                        {template.category}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      {isInstalled ? (
                        <Badge variant="outline" className="text-[10px] text-green-600 dark:text-green-400">
                          <CheckCircle className="h-2.5 w-2.5 mr-1" />
                          Installed
                        </Badge>
                      ) : (
                        <div />
                      )}
                      <Button
                        size="sm"
                        variant={isInstalled ? "outline" : "default"}
                        className="h-7 text-xs"
                        onClick={() => handleInstall(template)}
                        disabled={isInstalled || installing === template.name}
                      >
                        {installing === template.name ? "Installing..." : isInstalled ? "Reinstall" : "Install"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
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

// Hook Dialog
interface HookDialogProps {
  open: boolean;
  onClose: () => void;
  mode: "add" | "edit";
  hook: HookEntry | null;
  onSuccess: () => void;
}

function HookDialog({ open, onClose, mode, hook, onSuccess }: HookDialogProps) {
  const { toast } = useToast();
  const [hookType, setHookType] = useState(hook?.type || "PreToolUse");
  const [matcher, setMatcher] = useState(hook?.matcher || "");
  const [command, setCommand] = useState(hook?.command || "");
  const [timeout, setTimeout] = useState<string>(hook?.timeout?.toString() || "");
  const [description, setDescription] = useState(hook?.description || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setHookType(hook?.type || "PreToolUse");
      setMatcher(hook?.matcher || "");
      setCommand(hook?.command || "");
      setTimeout(hook?.timeout?.toString() || "");
      setDescription(hook?.description || "");
    }
  }, [open, hook]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!command.trim()) {
      toast("Command is required", "error");
      return;
    }

    setSubmitting(true);

    const requestBody: any = {
      type: hookType,
      command: command.trim(),
    };

    if (matcher.trim()) requestBody.matcher = matcher.trim();
    if (timeout.trim()) requestBody.timeout = parseInt(timeout);
    if (description.trim()) requestBody.description = description.trim();

    if (mode === "edit" && hook) {
      requestBody.index = hook.index;
    }

    try {
      const method = mode === "add" ? "POST" : "PUT";
      const res = await fetch("/api/toolbox/hooks", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (res.ok) {
        toast(data.message || `Hook ${mode === "add" ? "added" : "updated"} successfully`, "success");
        onSuccess();
        onClose();
      } else {
        toast(data.error || "Operation failed", "error");
      }
    } catch (error) {
      toast("Failed to save hook", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background border rounded-xl shadow-2xl max-w-xl w-full mx-4 max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-background z-10">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {mode === "add" ? "Add Hook" : "Edit Hook"}
          </h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Hook Type */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Hook Type *</label>
            <select
              className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              value={hookType}
              onChange={(e) => setHookType(e.target.value)}
              disabled={mode === "edit"}
            >
              {HOOK_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Matcher */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Matcher (optional)</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md text-sm font-mono bg-background"
              placeholder="e.g., Bash"
              value={matcher}
              onChange={(e) => setMatcher(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Filter by tool name (e.g., Bash, Read, Write)
            </p>
          </div>

          {/* Command */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Command *</label>
            <textarea
              className="w-full px-3 py-2 border rounded-md text-sm font-mono bg-background min-h-[80px]"
              placeholder="node script.js"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
            />
          </div>

          {/* Timeout */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Timeout (seconds)</label>
            <input
              type="number"
              className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              placeholder="30"
              value={timeout}
              onChange={(e) => setTimeout(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Description</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              placeholder="Hook description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : mode === "add" ? "Add Hook" : "Update Hook"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function HooksTab({ hooks, onRefresh }: { hooks: HookEntry[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [editingHook, setEditingHook] = useState<HookEntry | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [hookToDelete, setHookToDelete] = useState<HookEntry | null>(null);

  const handleAddHook = () => {
    setDialogMode("add");
    setEditingHook(null);
    setDialogOpen(true);
  };

  const handleEditHook = (hook: HookEntry) => {
    setDialogMode("edit");
    setEditingHook(hook);
    setDialogOpen(true);
  };

  const handleDeleteClick = (hook: HookEntry) => {
    setHookToDelete(hook);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!hookToDelete) return;

    try {
      const res = await fetch("/api/toolbox/hooks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: hookToDelete.type,
          index: hookToDelete.index,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast(data.message || "Hook deleted successfully", "success");
        onRefresh();
      } else {
        toast(data.error || "Failed to delete hook", "error");
      }
    } catch (error) {
      toast("Failed to delete hook", "error");
    } finally {
      setDeleteDialogOpen(false);
      setHookToDelete(null);
    }
  };

  if (hooks.length === 0) {
    return (
      <>
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={handleAddHook} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Hook
          </Button>
        </div>
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <Shield className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium mb-1">No hooks configured</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Hooks run shell commands at lifecycle events (before/after tool use, session start/end, etc.).
            </p>
          </CardContent>
        </Card>
        <HookDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          mode={dialogMode}
          hook={editingHook}
          onSuccess={onRefresh}
        />
      </>
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
    <>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={handleAddHook} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Hook
        </Button>
      </div>
      <div className="space-y-4">
        <div className="flex items-start gap-2 bg-muted/30 rounded-lg px-3 py-2.5">
          <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Shell commands that run automatically at lifecycle events. Configured in <code className="bg-muted px-1 rounded">~/.claude/settings.json</code>
          </p>
        </div>
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
                  <Card key={i} className="bg-muted/20 group hover:shadow-md transition-shadow">
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
                        <div className="flex items-start gap-1">
                          {hook.timeout && (
                            <Badge variant="outline" className="text-[10px] flex-shrink-0">
                              <Clock className="h-2.5 w-2.5 mr-0.5" /> {hook.timeout}s
                            </Badge>
                          )}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleEditHook(hook)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              onClick={() => handleDeleteClick(hook)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <HookDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        mode={dialogMode}
        hook={editingHook}
        onSuccess={onRefresh}
      />

      {/* Delete Confirmation */}
      {deleteDialogOpen && hookToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteDialogOpen(false)}>
          <div
            className="bg-background border rounded-xl shadow-2xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Delete Hook
              </h2>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDeleteDialogOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete this{" "}
                <span className="font-mono font-semibold text-foreground">{hookToDelete.type}</span> hook?
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="destructive" onClick={handleDeleteConfirm}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---- Agents Tab ----

function AgentsTab({ agents, onRefresh }: { agents: AgentInfo[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [editingAgent, setEditingAgent] = useState<AgentInfo | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<AgentInfo | null>(null);

  const handleAddAgent = () => {
    setDialogMode("add");
    setEditingAgent(null);
    setDialogOpen(true);
  };

  const handleEditAgent = (agent: AgentInfo) => {
    setDialogMode("edit");
    setEditingAgent(agent);
    setDialogOpen(true);
  };

  const handleDeleteClick = (agent: AgentInfo) => {
    setAgentToDelete(agent);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!agentToDelete) return;

    try {
      const res = await fetch("/api/toolbox/agents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: agentToDelete.name }),
      });

      const data = await res.json();

      if (res.ok) {
        toast(data.message || "Agent deleted successfully", "success");
        onRefresh();
      } else {
        toast(data.error || "Failed to delete agent", "error");
      }
    } catch (error) {
      toast("Failed to delete agent", "error");
    } finally {
      setDeleteDialogOpen(false);
      setAgentToDelete(null);
    }
  };

  if (agents.length === 0) {
    return (
      <>
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={handleAddAgent} className="gap-1.5">
            <Plus className="h-4 w-4" /> Create Agent
          </Button>
        </div>
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
        <AgentDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          mode={dialogMode}
          agent={editingAgent}
          onSuccess={onRefresh}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={handleAddAgent} className="gap-1.5">
          <Plus className="h-4 w-4" /> Create Agent
        </Button>
      </div>
      <div className="space-y-4">
        <div className="flex items-start gap-2 bg-muted/30 rounded-lg px-3 py-2.5">
          <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Custom agent definitions with specialized prompts and tool access. Located in <code className="bg-muted px-1 rounded">~/.claude/agents/</code>
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {agents.map((agent) => (
          <div key={agent.name} className="group relative">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-md bg-pink-500/10 flex items-center justify-center flex-shrink-0"><Bot className="h-3.5 w-3.5 text-pink-500" /></div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-mono truncate">{agent.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{agent.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => { e.stopPropagation(); handleEditAgent(agent); }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      onClick={(e) => { e.stopPropagation(); handleDeleteClick(agent); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
        ))}
        </div>
      </div>

      <AgentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        mode={dialogMode}
        agent={editingAgent}
        onSuccess={onRefresh}
      />

      {/* Delete Confirmation */}
      {deleteDialogOpen && agentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteDialogOpen(false)}>
          <div
            className="bg-background border rounded-xl shadow-2xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Delete Agent
              </h2>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDeleteDialogOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete the agent{" "}
                <span className="font-mono font-semibold text-foreground">{agentToDelete.name}</span>?
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="destructive" onClick={handleDeleteConfirm}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---- Rules Tab ----

function RulesTab({ rules, onRefresh }: { rules: RuleInfo[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [editingRule, setEditingRule] = useState<RuleInfo | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<RuleInfo | null>(null);

  const handleAddRule = () => {
    setDialogMode("add");
    setEditingRule(null);
    setDialogOpen(true);
  };

  const handleEditRule = (rule: RuleInfo) => {
    setDialogMode("edit");
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleDeleteClick = (rule: RuleInfo) => {
    setRuleToDelete(rule);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!ruleToDelete) return;

    try {
      const res = await fetch("/api/toolbox/rules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: ruleToDelete.path }),
      });

      const data = await res.json();

      if (res.ok) {
        toast(data.message || "Rule deleted successfully", "success");
        onRefresh();
      } else {
        toast(data.error || "Failed to delete rule", "error");
      }
    } catch (error) {
      toast("Failed to delete rule", "error");
    } finally {
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
    }
  };

  const existingGroups = Array.from(new Set(rules.map(r => r.group)));

  if (rules.length === 0) {
    return (
      <>
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={handleAddRule} className="gap-1.5">
            <Plus className="h-4 w-4" /> Create Rule
          </Button>
        </div>
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
        <RuleDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          mode={dialogMode}
          rule={editingRule}
          existingGroups={["common"]}
          onSuccess={onRefresh}
        />
      </>
    );
  }

  const grouped = new Map<string, RuleInfo[]>();
  for (const rule of rules) {
    const list = grouped.get(rule.group) || [];
    list.push(rule);
    grouped.set(rule.group, list);
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={handleAddRule} className="gap-1.5">
          <Plus className="h-4 w-4" /> Create Rule
        </Button>
      </div>
      <div className="space-y-5">
        <div className="flex items-start gap-2 bg-muted/30 rounded-lg px-3 py-2.5">
          <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Instruction files Claude follows automatically. Organized by category in <code className="bg-muted px-1 rounded">~/.claude/rules/</code>
          </p>
        </div>
        {Array.from(grouped.entries()).map(([group, items]) => (
          <section key={group}>
            <div className="flex items-center gap-2 mb-2">
              <FolderOpen className="h-4 w-4 text-cyan-500" />
              <span className="text-sm font-semibold">{group}</span>
              <Badge variant="outline" className="text-xs">{items.length}</Badge>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {items.map((rule) => {
                const previewLines = rule.preview.split("\n").filter(l => l.trim());
                let subtitle = "";
                for (const line of previewLines) {
                  if (!line.match(/^#+\s/)) {
                    subtitle = line.slice(0, 80);
                    break;
                  }
                }

                return (
                  <div key={rule.path} className="group relative">
                    <Card className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <div className="h-7 w-7 rounded-md bg-cyan-500/10 flex items-center justify-center flex-shrink-0"><BookOpen className="h-3.5 w-3.5 text-cyan-500" /></div>
                            <div className="min-w-0">
                              <CardTitle className="text-sm font-mono truncate">{rule.name}</CardTitle>
                              {subtitle && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{subtitle}</p>}
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => { e.stopPropagation(); handleEditRule(rule); }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              onClick={(e) => { e.stopPropagation(); handleDeleteClick(rule); }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <RuleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        mode={dialogMode}
        rule={editingRule}
        existingGroups={existingGroups}
        onSuccess={onRefresh}
      />

      {/* Delete Confirmation */}
      {deleteDialogOpen && ruleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteDialogOpen(false)}>
          <div
            className="bg-background border rounded-xl shadow-2xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Delete Rule
              </h2>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDeleteDialogOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete the rule{" "}
                <span className="font-mono font-semibold text-foreground">{ruleToDelete.name}</span> from group{" "}
                <span className="font-semibold">{ruleToDelete.group}</span>?
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="destructive" onClick={handleDeleteConfirm}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---- Main Page ----

export default function ToolboxPage() {
  const [data, setData] = useState<ToolboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<Record<string, HealthStatus>>({});
  const [showHelp, setShowHelp] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch("/api/toolbox")
      .then((r) => r.json())
      .then((d: ToolboxData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
          <MCPTab data={data.mcp} health={health} onCheckHealth={checkHealth} onRefresh={fetchData} />
        </TabsContent>
        <TabsContent value="skills">
          <SkillsTab skills={data.skills} commands={data.commands} onRefresh={fetchData} />
        </TabsContent>
        <TabsContent value="hooks">
          <HooksTab hooks={data.hooks} onRefresh={fetchData} />
        </TabsContent>
        <TabsContent value="agents">
          <AgentsTab agents={data.agents} onRefresh={fetchData} />
        </TabsContent>
        <TabsContent value="rules">
          <RulesTab rules={data.rules} onRefresh={fetchData} />
        </TabsContent>
      </Tabs>

      {/* Help Dialog */}
      <HelpDialog open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
