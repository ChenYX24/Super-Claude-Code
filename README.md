# Super Claude Code

[English](./README.md) | [中文](./README_CN.md)

A web dashboard for managing and monitoring [Claude Code](https://docs.anthropic.com/en/docs/claude-code) sessions, teams, tokens, MCP servers, and configuration files.

Built with **Next.js 15** + **TypeScript** + **Tailwind CSS v4** + **shadcn/ui**

## Features

### Overview Dashboard
- At-a-glance summary of all Claude Code activity
- Team status, session counts, token usage stats
- Quick navigation to all sections

### Team Board
- Real-time view of team members with status indicators (working / idle / completed / stale / terminated)
- Task Kanban board (Pending → In Progress → Completed) with task persistence
- Message stream showing inter-agent communication
- Past agents discovery and collapsible display
- Team selector dropdown for multiple teams

### Sessions
- Grid view of all sessions across all projects
- Color-coded status blocks (ClaudeGlance-style)
- Session detail view with conversation messages
- File preview for referenced files
- Deep linking from Team Board to related sessions

### Token Usage
- Per-session and per-project token consumption tracking
- Input / Output / Cache Read / Cache Write breakdown
- Total cost estimation
- CSV export (Detail mode & Summary mode)

### MCP Server Management
- View all configured MCP servers (global `settings.json` + per-project `.mcp.json`)
- Server type, command, args, and environment display
- Per-project grouping

### CLAUDE.md Editor
- Split-pane editor with live Markdown preview
- Edit global and project-level CLAUDE.md files
- Create new CLAUDE.md files via:
  - **Project presets** (auto-detected from `~/.claude/projects/`)
  - **Directory browser** (navigate filesystem with drive switching)
  - **Custom path** (paste any directory path)
- Delete CLAUDE.md files with confirmation dialog
- Keyboard shortcut: `Ctrl+S` to save

### General
- Dark mode support (system preference)
- Responsive layout with sidebar navigation
- Cursor-pointer on all interactive elements
- Auto-refreshing data from `~/.claude/` directory

## Getting Started

### Prerequisites
- Node.js 18+
- Claude Code installed and configured (`~/.claude/` directory exists)

### Install & Run

```bash
git clone https://github.com/ChenYX24/Super-Claude-Code.git
cd Super-Claude-Code/dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
dashboard/
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── page.tsx          # Overview dashboard
│   │   ├── team/             # Team Board
│   │   ├── sessions/         # Sessions grid & detail
│   │   ├── tokens/           # Token usage & export
│   │   ├── mcp/              # MCP server management
│   │   ├── editor/           # CLAUDE.md editor
│   │   └── api/              # API routes
│   ├── components/           # Shared UI components
│   │   ├── ui/               # shadcn/ui primitives
│   │   ├── team-board/       # Team-specific components
│   │   └── markdown-content.tsx
│   └── lib/                  # Core logic
│       ├── claude-reader.ts  # Read ~/.claude/ data (teams, tasks, messages)
│       ├── session-reader.ts # Read session JSONL files
│       ├── claudemd.ts       # CLAUDE.md file management
│       └── types.ts          # Shared types
├── public/                   # Static assets
└── package.json
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui |
| Markdown | react-markdown + remark-gfm |
| Data Source | Local filesystem (`~/.claude/`) |

## Roadmap

### Phase 3: Dashboard Enhancement
- [ ] **Settings Panel** — View/edit Claude configuration (settings.json, hooks, permissions)
- [ ] **Running Process Detection** — Detect active Claude CLI processes, show live status
- [ ] **Terminal-style Session View** — Render sessions closer to terminal appearance
- [ ] **MCP Server Health Check** — Detect whether MCP servers are actually running/reachable

### Phase 4: Claude Code Command Integration
- [ ] **/dashboard command** — Open dashboard for current session only
- [ ] **/dashboard_all command** — Open dashboard for all sessions

### Phase 5: External Integrations
- [ ] **Telegram Bot** — Mobile control & notifications
- [ ] **Docker Integration** — Automated task execution in isolated containers

### AI Toolbox (Auto-task Ecosystem)

> Independent modules with a unified task intake — AI auto-dispatches and executes.

#### Creative & Content Production
- [ ] **Video Editing Service** — Receive footage + requirements, AI auto-edits/composes/subtitles
- [ ] **Design Service** — Receive design briefs, AI generates posters/logos/UI mockups
- [ ] **Video Info Extraction** — Extract metadata, transcripts, key frames
- [ ] **Mobile Media Upload** — Send photos & videos from mobile, trigger pipelines

#### Programming & Development
- [ ] **Coding Service** — Receive requirements, AI auto-codes + tests + delivers
- [ ] **Code Review Service** — Submit PR/snippets, AI generates review reports
- [ ] **Bug Fix Service** — Describe issue + repo URL, AI locates and fixes

#### Financial Market Analysis
- [ ] **Precious Metals** — Real-time gold & silver tracking, trend analysis
- [ ] **Crypto** — Bitcoin and major crypto monitoring, alerts
- [ ] **Stock Indices** — S&P 500, NASDAQ, CSI 300, HSI dashboards

#### Multi-Platform Content Hub
- [ ] **GitHub / Xiaohongshu / HF / Papers** — Manage, categorize, push notifications
- [ ] **Smart Routing** — AI-powered content routing to relevant channels

#### Unified API Management Platform
- [ ] **Usage Dashboard + Cost Analytics + Budget Alerts + Key Management**

### Backlog
- [ ] Token usage charts / time series
- [ ] Multi-user support
- [ ] WebSocket-based live updates
- [ ] i18n (English / Chinese)
