export type CommandCategory = "built-in" | "slash" | "skill" | "agent";

export interface ChatCommand {
  name: string;
  description: string;
  category: CommandCategory;
  shortcut?: string;
}

/** Commands handled locally without CLI invocation */
export const LOCAL_COMMAND_NAMES = ["/help", "/clear", "/model", "/cost"];

export const BUILTIN_COMMANDS: ChatCommand[] = [
  { name: "/help", description: "Show available commands", category: "built-in", shortcut: "h" },
  { name: "/clear", description: "Clear current conversation", category: "built-in" },
  { name: "/model", description: "Show current model", category: "built-in" },
  { name: "/cost", description: "Show session cost summary", category: "built-in" },
  { name: "/compact", description: "Compact conversation context", category: "built-in" },
];

// ---------------------------------------------------------------------------
// Provider-specific built-in commands
// ---------------------------------------------------------------------------

/** Claude Code CLI built-in commands (~23 commands) */
export const CLAUDE_BUILTIN_COMMANDS: ChatCommand[] = [
  { name: "/add-dir", description: "Add a directory to the session context", category: "built-in" },
  { name: "/agents", description: "List available agents", category: "built-in" },
  { name: "/bug", description: "Report a bug", category: "built-in" },
  { name: "/chrome", description: "Open a Chrome browser session", category: "built-in" },
  { name: "/clear", description: "Clear current conversation", category: "built-in" },
  { name: "/color", description: "Toggle color output", category: "built-in" },
  { name: "/compact", description: "Compact conversation context", category: "built-in" },
  { name: "/config", description: "Open or edit configuration", category: "built-in" },
  { name: "/cost", description: "Show session cost summary", category: "built-in" },
  { name: "/dashboard", description: "Open the dashboard", category: "built-in" },
  { name: "/dashboard-all", description: "Open the full dashboard view", category: "built-in" },
  { name: "/doctor", description: "Run diagnostics and health checks", category: "built-in" },
  { name: "/help", description: "Show available commands", category: "built-in", shortcut: "h" },
  { name: "/init", description: "Initialize Claude Code in a project", category: "built-in" },
  { name: "/login", description: "Log in to your account", category: "built-in" },
  { name: "/logout", description: "Log out of your account", category: "built-in" },
  { name: "/memory", description: "View or edit CLAUDE.md memory files", category: "built-in" },
  { name: "/model", description: "Show or change current model", category: "built-in" },
  { name: "/permissions", description: "View or modify tool permissions", category: "built-in" },
  { name: "/pr-comments", description: "View pull request comments", category: "built-in" },
  { name: "/review-pr", description: "Review a pull request", category: "built-in" },
  { name: "/status", description: "Show session status", category: "built-in" },
  { name: "/terminal-setup", description: "Set up terminal integration", category: "built-in" },
  { name: "/vim", description: "Toggle vim keybindings", category: "built-in" },
];

/** Codex CLI built-in commands */
export const CODEX_BUILTIN_COMMANDS: ChatCommand[] = [
  { name: "/help", description: "Show available commands", category: "built-in", shortcut: "h" },
  { name: "/clear", description: "Clear current conversation", category: "built-in" },
  { name: "/model", description: "Show or change current model", category: "built-in" },
  { name: "/compact", description: "Compact conversation context", category: "built-in" },
  { name: "/config", description: "Open or edit configuration", category: "built-in" },
  { name: "/status", description: "Show session status", category: "built-in" },
];

/**
 * Return the built-in command list for a given provider.
 *
 * Falls back to the generic `BUILTIN_COMMANDS` for unknown providers.
 */
export function getProviderBuiltins(provider: string): ChatCommand[] {
  switch (provider) {
    case "codex":
      return CODEX_BUILTIN_COMMANDS;
    case "claude":
    default:
      return CLAUDE_BUILTIN_COMMANDS;
  }
}

// ---------------------------------------------------------------------------
// Category labels
// ---------------------------------------------------------------------------

export const CATEGORY_LABELS: Record<string, string> = {
  "built-in": "Built-in",
  slash: "Slash Commands",
  skill: "Skills",
  agent: "Agents",
};

// ---------------------------------------------------------------------------
// Merge helpers
// ---------------------------------------------------------------------------

/** Merge CLI-reported slash commands with built-in commands (legacy helper) */
export function mergeCliCommands(
  cliSlashCommands?: { name: string; description?: string }[],
): ChatCommand[] {
  const all = [...BUILTIN_COMMANDS];
  if (cliSlashCommands) {
    for (const cmd of cliSlashCommands) {
      if (!cmd?.name) continue;
      const name = cmd.name.startsWith("/") ? cmd.name : `/${cmd.name}`;
      if (all.some((b) => b.name === name)) continue;
      all.push({ name, description: cmd.description || "", category: "slash" });
    }
  }
  return all;
}

/**
 * Merge provider builtins + toolbox skills/agents + CLI dynamic commands.
 *
 * This is the recommended replacement for `mergeCliCommands()` when you have
 * access to provider information and toolbox data.
 */
export function mergeAllCommands({
  provider,
  cliSlashCommands,
  toolboxCommands,
}: {
  provider: string;
  cliSlashCommands?: { name: string; description?: string }[];
  toolboxCommands?: ChatCommand[];
}): ChatCommand[] {
  const builtins = getProviderBuiltins(provider);
  const all = [...builtins];
  const seen = new Set(builtins.map((c) => c.name));

  // Layer in toolbox commands (skills + agents)
  if (toolboxCommands) {
    for (const cmd of toolboxCommands) {
      if (seen.has(cmd.name)) continue;
      seen.add(cmd.name);
      all.push(cmd);
    }
  }

  // Layer in CLI dynamic slash commands
  if (cliSlashCommands) {
    for (const cmd of cliSlashCommands) {
      if (!cmd?.name) continue;
      const name = cmd.name.startsWith("/") ? cmd.name : `/${cmd.name}`;
      if (seen.has(name)) continue;
      seen.add(name);
      all.push({ name, description: cmd.description || "", category: "slash" });
    }
  }

  return all;
}

// ---------------------------------------------------------------------------
// Filter / group helpers
// ---------------------------------------------------------------------------

/** Filter commands by fuzzy query (matches name, description, or shortcut) */
export function filterCommands(commands: ChatCommand[], input: string): ChatCommand[] {
  const q = input.toLowerCase().replace(/^\//, "");
  if (!q) return commands;
  return commands.filter(
    (cmd) =>
      cmd.name.slice(1).toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      (cmd.shortcut && cmd.shortcut.toLowerCase().startsWith(q)),
  );
}

/** Group commands by category in display order */
export function groupByCategory(commands: ChatCommand[]): [string, ChatCommand[]][] {
  const order: CommandCategory[] = ["built-in", "slash", "skill", "agent"];
  const groups: [string, ChatCommand[]][] = [];
  for (const cat of order) {
    const cmds = commands.filter((c) => c.category === cat);
    if (cmds.length > 0) groups.push([cat, cmds]);
  }
  return groups;
}

/** Get flat ordered list of filtered commands (used for keyboard index mapping) */
export function getFlatFilteredCommands(commands: ChatCommand[], input: string): ChatCommand[] {
  const filtered = filterCommands(commands, input);
  const groups = groupByCategory(filtered);
  const flat: ChatCommand[] = [];
  for (const [, cmds] of groups) flat.push(...cmds);
  return flat;
}

/** Create ChatCommands from skill info objects */
export function createSkillCommands(skills: { name: string; description: string }[]): ChatCommand[] {
  return skills.map((s) => ({
    name: s.name.startsWith("/") ? s.name : `/${s.name}`,
    description: s.description || "Custom skill",
    category: "skill" as const,
  }));
}

/** Create ChatCommands from agent info objects */
export function createAgentCommands(agents: { name: string; description: string }[]): ChatCommand[] {
  return agents.map((a) => ({
    name: a.name.startsWith("/") ? a.name : `/${a.name}`,
    description: a.description || "Custom agent",
    category: "agent" as const,
  }));
}

/** Get commands grouped by category (convenience wrapper) */
export function getCommandsByCategory(commands: ChatCommand[]): Record<string, ChatCommand[]> {
  const result: Record<string, ChatCommand[]> = {};
  for (const cmd of commands) {
    if (!result[cmd.category]) result[cmd.category] = [];
    result[cmd.category].push(cmd);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Toolbox loader
// ---------------------------------------------------------------------------

/**
 * Fetch agents and skills from the toolbox API and return them as ChatCommands.
 *
 * @param provider - Optional provider name (e.g. "claude", "codex").
 *   When specified, only toolbox items whose `provider` field matches
 *   (or whose `provider` is undefined) are included.
 */
export async function loadToolboxCommands(provider?: string): Promise<ChatCommand[]> {
  try {
    const res = await fetch("/api/toolbox");
    if (!res.ok) return [];
    const data = await res.json();

    const matchesProvider = (item: { provider?: string }) =>
      !provider || !item.provider || item.provider === provider;

    const agentCommands: ChatCommand[] = (data.agents ?? [])
      .filter((a: { provider?: string }) => matchesProvider(a))
      .map((a: { name: string; description?: string }) => ({
        name: a.name.startsWith("@") ? a.name : `@${a.name}`,
        description: a.description || "Custom agent",
        category: "agent" as const,
      }));

    const skillCommands: ChatCommand[] = (data.skills ?? [])
      .filter((s: { provider?: string }) => matchesProvider(s))
      .map((s: { name: string; description?: string }) => ({
        name: s.name.startsWith("/") ? s.name : `/${s.name}`,
        description: s.description || "Custom skill",
        category: "skill" as const,
      }));

    return [...agentCommands, ...skillCommands];
  } catch {
    return [];
  }
}
