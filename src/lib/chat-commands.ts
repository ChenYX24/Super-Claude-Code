export interface ChatCommand {
  name: string;
  description: string;
  category: "built-in" | "slash" | "skill";
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

export const CATEGORY_LABELS: Record<string, string> = {
  "built-in": "Built-in",
  slash: "Slash Commands",
  skill: "Skills",
};

/** Merge CLI-reported slash commands with built-in commands */
export function mergeCliCommands(
  cliSlashCommands?: { name: string; description?: string }[],
): ChatCommand[] {
  const all = [...BUILTIN_COMMANDS];
  if (cliSlashCommands) {
    for (const cmd of cliSlashCommands) {
      const name = cmd.name.startsWith("/") ? cmd.name : `/${cmd.name}`;
      if (all.some((b) => b.name === name)) continue;
      all.push({ name, description: cmd.description || "", category: "slash" });
    }
  }
  return all;
}

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
  const order = ["built-in", "skill", "slash"] as const;
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
