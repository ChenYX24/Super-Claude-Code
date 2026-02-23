// Shared types for toolbox components

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface MCPServersData {
  global: Record<string, MCPServerConfig>;
  projects: { project: string; servers: Record<string, MCPServerConfig> }[];
}

export type ToolboxProvider = "claude" | "codex";

export interface SkillInfo {
  name: string;
  description: string;
  allowedTools?: string[];
  content: string;
  path: string;
  provider?: ToolboxProvider;
}

export interface CommandInfo {
  name: string;
  description: string;
  content: string;
  path: string;
}

export interface AgentInfo {
  name: string;
  description: string;
  content: string;
  path: string;
  provider?: ToolboxProvider;
}

export interface RuleInfo {
  name: string;
  group: string;
  preview: string;
  content: string;
  path: string;
  provider?: ToolboxProvider;
}

export interface HookEntry {
  type: string;
  matcher?: string;
  command: string;
  timeout?: number;
  description?: string;
  index?: number;
}

export interface ToolboxData {
  skills: SkillInfo[];
  commands: CommandInfo[];
  agents: AgentInfo[];
  rules: RuleInfo[];
  hooks: HookEntry[];
  mcp: MCPServersData;
}

export type HealthStatus = "healthy" | "warning" | "timeout" | "error" | "checking" | "unknown";
