# Super Claude Code

[English](./README.md) | [中文](./README_CN.md)

A web dashboard for managing and monitoring [Claude Code](https://docs.anthropic.com/en/docs/claude-code) sessions, teams, tokens, MCP servers, and configuration files.

Built with **Next.js 16** + **TypeScript** + **Tailwind CSS v4** + **shadcn/ui** + **Recharts**

## Features

### Overview Dashboard
- 6 stat cards (Total Sessions, Active Teams, Agents, Token Usage, Avg Cost/Session, Cache Hit Rate)
- Active Processes detection with status indicators
- Token Summary with 7-day mini trend charts
- Recent Sessions quick access
- Quick Actions panel
- Teams overview

### Team Board
- Real-time view of team members with status indicators (working / idle / completed / stale / terminated)
- Task Kanban board (Pending → In Progress → Completed) with task persistence
- Message stream showing inter-agent communication
- Past agents discovery and collapsible display
- Team selector dropdown for multiple teams

### Sessions
- Grid/List view toggle for all sessions across all projects
- Color-coded status blocks (ClaudeGlance-style)
- **Favorites/Star** system with localStorage persistence
- **Date and Model filters** for quick session lookup
- **Search** functionality across session names and projects
- **Sort** options (newest/oldest, cost, tokens)
- **Auto-refresh** every 10 seconds
- Card/Terminal view modes with localStorage memory
- Session detail view with conversation messages
- File preview for referenced files
- **Markdown export** for session conversations
- Deep linking from Team Board to related sessions

### Token Usage
- **Time range selector** (7d / 14d / 30d / all time)
- **Interactive AreaChart** with Recharts + Brush zoom control
- **Chart/Table toggle** for data visualization
- **Paginated table** with per-page controls
- **Model breakdown PieChart** showing distribution by model
- **CSV export** (Detail mode & Summary mode)
- **Today vs Week comparison** statistics
- **Cache savings** calculation and display
- Per-session and per-project token consumption tracking
- Input / Output / Cache Read / Cache Write breakdown
- Total cost estimation with model-specific pricing

### Chat
- **Bubble-style conversation viewer** for interactive session playback
- **Auto-scroll** to latest messages
- **Tool call collapse/expand** for better readability
- **Thinking blocks** display for extended thinking content
- **Session selector** to switch between sessions
- Real-time conversation rendering with markdown support

### Toolbox (Configuration Hub)
- **5-tab interface**: MCP + Skills & Commands + Hooks + Agents + Rules
- **MCP Marketplace**: 14 popular servers with one-click installation
  - Includes: Filesystem, Fetch, GitHub, Brave Search, Postgres, Playwright, Memory, Puppeteer, Slack, Sequential Thinking, Time, EverythingSearch, Perplexity, Google Drive
- **Full CRUD operations** for all tool types (Create, Read, Update, Delete)
- **Skills & Agents & Rules template marketplace** for quick setup
- **Help documentation** for each tool type
- **Summary view** showing counts and status
- Health check for MCP servers

### CLAUDE.md Editor
- Split-pane editor with live Markdown preview
- Edit global and project-level CLAUDE.md files
- Create new CLAUDE.md files via:
  - **Project presets** (auto-detected from `~/.claude/projects/`)
  - **Directory browser** (navigate filesystem with drive switching)
  - **Custom path** (paste any directory path)
- Delete CLAUDE.md files with confirmation dialog
- Keyboard shortcut: `Ctrl+S` to save
- Registry view for all CLAUDE.md files

### Settings
- **Editable configuration** (model selection, theme, feature toggles)
- **Cost alert settings** with threshold configuration
- Direct integration with Claude Code settings.json
- Model defaults and preference management

### MCP Server Management (Legacy)
- View all configured MCP servers (global `settings.json` + per-project `.mcp.json`)
- Server type, command, args, and environment display
- Per-project grouping
- *Note: Replaced by Toolbox in v0.8.0*

### General
- **Notification system** with cost alerts and bell icon
- **Dark mode** support (system preference)
- **Keyboard shortcuts** (1-8 for page navigation)
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
│   ├── app/                      # Next.js App Router pages
│   │   ├── page.tsx              # Overview dashboard
│   │   ├── team/                 # Team Board
│   │   ├── sessions/             # Sessions grid & detail
│   │   ├── tokens/               # Token usage & export
│   │   ├── chat/                 # Chat conversation viewer
│   │   ├── toolbox/              # Toolbox configuration hub
│   │   ├── editor/               # CLAUDE.md editor
│   │   ├── settings/             # Settings panel
│   │   ├── mcp/                  # MCP server management (legacy)
│   │   └── api/                  # API routes (19 endpoints)
│   │       ├── teams/            # Team management
│   │       ├── sessions/         # Session management
│   │       ├── tokens/           # Token statistics & export
│   │       ├── claudemd/         # CLAUDE.md CRUD & registry
│   │       ├── toolbox/          # Toolbox data & CRUD
│   │       ├── browse/           # Filesystem browser
│   │       ├── settings/         # Settings GET/PUT
│   │       └── processes/        # Process detection
│   ├── components/               # Shared UI components
│   │   ├── ui/                   # shadcn/ui primitives
│   │   ├── team-board/           # Team-specific components
│   │   ├── sessions/             # Session components (block, detail, list, analytics)
│   │   ├── toolbox/              # Toolbox dialogs (rule, agent)
│   │   ├── sidebar-nav.tsx       # Sidebar navigation
│   │   ├── notification-bell.tsx # Notification system
│   │   └── markdown-content.tsx  # Markdown renderer
│   ├── hooks/                    # Custom React hooks
│   │   ├── use-favorites.ts      # Favorites localStorage hook
│   │   ├── use-notifications.ts  # Notifications hook
│   │   └── use-keyboard-shortcuts.ts # Global keyboard shortcuts
│   └── lib/                      # Core logic
│       ├── claude-reader.ts      # Teams, tasks, messages + task cache + MCP
│       ├── session-reader.ts     # Session JSONL + token export + model detection
│       ├── claudemd.ts           # CLAUDE.md CRUD + Registry
│       ├── toolbox-reader.ts     # Skills/Commands/Hooks/Agents/Rules reader
│       ├── mcp-registry.ts       # 14 popular MCP servers registry
│       ├── tools-registry.ts     # Skills/Agents/Rules template library
│       ├── format-utils.ts       # Common formatting utilities
│       ├── process-reader.ts     # Process detection
│       └── types.ts              # Shared types
├── public/                       # Static assets
└── package.json
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui |
| Charts | Recharts |
| Markdown | react-markdown + remark-gfm |
| Data Source | Local filesystem (`~/.claude/`) |
| State | localStorage (favorites, notifications, view preferences) |

## Roadmap

### Phase 3: Dashboard Enhancement
- [x] **Settings Panel** — View/edit Claude configuration ✅ v0.8.0
- [x] **Running Process Detection** — Detect active Claude CLI processes ✅ v0.4.0
- [x] **Terminal-style Session View** — Render sessions closer to terminal appearance ✅ v0.4.0
- [x] **MCP Server Health Check** — Detect whether MCP servers are actually running/reachable ✅ v0.8.0
- [x] **Notification System** — Cost alerts and updates ✅ v0.8.0

### Phase 4: Claude Code Command Integration
- [x] **/dashboard command** — Open dashboard for current session only ✅ (scripts in `~/.claude/scripts/scc/`)
- [x] **/dashboard_all command** — Open dashboard for all sessions ✅ (scripts in `~/.claude/scripts/scc/`)

### Phase 5: External Integrations
- [ ] **Telegram Bot** — Mobile control & notifications
- [ ] **Docker Integration** — Automated task execution in isolated containers

### Phase 6: Quality & Polish
- [ ] **Code Quality**: Split large files (toolbox 900+ lines), test coverage, code review
- [ ] **UX Polish**: Responsive optimization, dark mode full coverage, unified loading states
- [ ] **Mobile Remote Management**: Mobile project management and control

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
