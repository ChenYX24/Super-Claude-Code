export interface MCPRegistryEntry {
  name: string;
  description: string;
  category: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  envDescriptions?: Record<string, string>;
  githubUrl?: string;
  official?: boolean;
}

export const MCP_CATEGORIES = ["All", "Search", "Dev Tools", "Data", "Productivity", "AI", "Files"] as const;

export const MCP_REGISTRY: MCPRegistryEntry[] = [
  {
    name: "filesystem",
    description: "Read, write, and manage files on the local filesystem",
    category: "Files",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"],
    official: true,
    githubUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
  },
  {
    name: "brave-search",
    description: "Web search powered by Brave Search API",
    category: "Search",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    env: { "BRAVE_API_KEY": "" },
    envDescriptions: { "BRAVE_API_KEY": "Get your API key from https://brave.com/search/api/" },
    official: true,
  },
  {
    name: "github",
    description: "GitHub API integration for repos, issues, PRs, and more",
    category: "Dev Tools",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: { "GITHUB_PERSONAL_ACCESS_TOKEN": "" },
    envDescriptions: { "GITHUB_PERSONAL_ACCESS_TOKEN": "Personal access token from GitHub Settings > Developer settings" },
    official: true,
  },
  {
    name: "postgres",
    description: "Query and manage PostgreSQL databases",
    category: "Data",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://user:pass@host:5432/db"],
    official: true,
  },
  {
    name: "puppeteer",
    description: "Browser automation and web scraping",
    category: "Dev Tools",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    official: true,
  },
  {
    name: "memory",
    description: "Knowledge graph-based persistent memory",
    category: "AI",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    official: true,
  },
  {
    name: "sequential-thinking",
    description: "Dynamic problem-solving through sequential reasoning",
    category: "AI",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    official: true,
  },
  {
    name: "fetch",
    description: "Fetch and convert web content to markdown",
    category: "Search",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-fetch"],
    official: true,
  },
  {
    name: "sqlite",
    description: "SQLite database operations and queries",
    category: "Data",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sqlite", "/path/to/database.db"],
    official: true,
  },
  {
    name: "slack",
    description: "Slack workspace integration for messages and channels",
    category: "Productivity",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-slack"],
    env: { "SLACK_BOT_TOKEN": "", "SLACK_TEAM_ID": "" },
    envDescriptions: { "SLACK_BOT_TOKEN": "Bot User OAuth Token from Slack App settings", "SLACK_TEAM_ID": "Your Slack workspace Team ID" },
    official: true,
  },
  {
    name: "playwright",
    description: "Browser testing and automation via Playwright",
    category: "Dev Tools",
    command: "npx",
    args: ["-y", "@playwright/mcp@latest"],
    githubUrl: "https://github.com/microsoft/playwright-mcp",
  },
  {
    name: "context7",
    description: "Up-to-date documentation and code examples for libraries",
    category: "Dev Tools",
    command: "npx",
    args: ["-y", "@upstash/context7-mcp@latest"],
    githubUrl: "https://github.com/upstash/context7",
  },
  {
    name: "browser-tools",
    description: "Browser DevTools integration (console, network, screenshots)",
    category: "Dev Tools",
    command: "npx",
    args: ["-y", "@anthropic/browser-tools-mcp@latest"],
  },
  {
    name: "google-maps",
    description: "Google Maps API for geocoding, directions, and places",
    category: "Search",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-google-maps"],
    env: { "GOOGLE_MAPS_API_KEY": "" },
    envDescriptions: { "GOOGLE_MAPS_API_KEY": "API key from Google Cloud Console" },
    official: true,
  },
];
