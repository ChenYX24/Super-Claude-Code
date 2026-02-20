"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownContent } from "@/components/markdown-content";
import { useToast } from "@/components/toast";
import { AgentDialog } from "@/components/toolbox/agent-dialog";
import { RuleDialog } from "@/components/toolbox/rule-dialog";
import { MCPTab } from "@/components/toolbox/mcp-tab";
import { SkillsTab } from "@/components/toolbox/skills-tab";
import { HooksTab } from "@/components/toolbox/hooks-tab";
import { AgentsTab } from "@/components/toolbox/agents-tab";
import { RulesTab } from "@/components/toolbox/rules-tab";
import type { MCPRegistryEntry } from "@/lib/mcp-registry";
import {
  Wrench, Plug, Sparkles, Command, Shield, Bot, BookOpen,
  RefreshCw, HelpCircle, X, AlertCircle, ShoppingBag, Plus,
} from "lucide-react";
import type {
  ToolboxData,
  HealthStatus,
  MCPServerConfig,
} from "@/components/toolbox/types";

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
                  : "Scoped to current project"}
              </p>
            </div>
          )}
        </div>

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

// ---- Hook Dialog ----

const HOOK_TYPES = [
  "PreToolUse", "PostToolUse", "Stop", "SessionStart", "SessionEnd",
  "PreCompact", "PermissionRequest", "SubagentStart", "SubagentStop",
];

interface HookDialogProps {
  open: boolean;
  onClose: () => void;
  mode: "add" | "edit";
  hook: any;
  onSuccess: () => void;
}

function HookDialog({ open, onClose, mode, hook, onSuccess }: HookDialogProps) {
  const { toast } = useToast();
  const [hookType, setHookType] = useState(hook?.type || "PreToolUse");
  const [matcher, setMatcher] = useState(hook?.matcher || "");
  const [command, setCommand] = useState(hook?.command || "");
  const [hookTimeout, setHookTimeout] = useState<string>(hook?.timeout?.toString() || "");
  const [description, setDescription] = useState(hook?.description || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setHookType(hook?.type || "PreToolUse");
      setMatcher(hook?.matcher || "");
      setCommand(hook?.command || "");
      setHookTimeout(hook?.timeout?.toString() || "");
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
    if (hookTimeout.trim()) requestBody.timeout = parseInt(hookTimeout);
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
              value={hookTimeout}
              onChange={(e) => setHookTimeout(e.target.value)}
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
          <MCPTab
            data={data.mcp}
            health={health}
            onCheckHealth={checkHealth}
            onRefresh={fetchData}
            MCPServerDialog={MCPServerDialog}
            MarketplaceInstallDialog={MarketplaceInstallDialog}
            DeleteConfirmDialog={DeleteConfirmDialog}
          />
        </TabsContent>
        <TabsContent value="skills">
          <SkillsTab skills={data.skills} commands={data.commands} onRefresh={fetchData} />
        </TabsContent>
        <TabsContent value="hooks">
          <HooksTab hooks={data.hooks} onRefresh={fetchData} HookDialog={HookDialog} />
        </TabsContent>
        <TabsContent value="agents">
          <AgentsTab agents={data.agents} onRefresh={fetchData} AgentDialog={AgentDialog} />
        </TabsContent>
        <TabsContent value="rules">
          <RulesTab rules={data.rules} onRefresh={fetchData} RuleDialog={RuleDialog} />
        </TabsContent>
      </Tabs>

      {/* Help Dialog */}
      <HelpDialog open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
