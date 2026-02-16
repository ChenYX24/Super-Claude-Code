# Super Claude Code

A web dashboard for managing and monitoring [Claude Code](https://docs.anthropic.com/en/docs/claude-code) sessions, teams, tokens, MCP servers, and configuration files.

Built with **Next.js 15** + **TypeScript** + **Tailwind CSS v4** + **shadcn/ui**.

## Features

### Overview Dashboard
- At-a-glance summary of all Claude Code activity
- Team status, session counts, token usage stats
- Quick navigation to all sections

### Team Board
- Real-time view of team members with status indicators (working / idle / completed / stale / terminated)
- Task Kanban board (Pending → In Progress → Completed) with task persistence
- Message stream showing inter-agent communication
- Past agents discovery and collapsible display (agents removed from config after shutdown are still visible)
- Team selector dropdown for multiple teams

### Sessions
- Grid view of all Claude Code sessions across all projects
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
  - **Directory browser** (navigate filesystem with drive switching support)
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
# Clone
git clone https://github.com/ChenYX24/Super-Claude-Code.git
cd Super-Claude-Code/dashboard

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

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

## TODO / Roadmap

### Phase 3: Dashboard Enhancement
- [ ] **Settings Panel** — View/edit Claude configuration (settings.json, hooks, permissions)
- [ ] **Running Process Detection** — Detect active Claude CLI processes, show live status
- [ ] **Terminal-style Session View** — Render session conversations closer to terminal appearance
- [ ] **MCP Server Health Check** — Detect whether MCP servers are actually running/reachable

### Phase 4: Claude Code Command Integration
- [ ] **/dashboard command** — Open dashboard for current session only
- [ ] **/dashboard_all command** — Open dashboard for all sessions
- [ ] **Opcode-inspired features** — Reference [opcode](https://github.com/winfunc/opcode)

### Phase 5: External Integrations
- [ ] **Telegram Bot** (Python + python-telegram-bot) — Mobile control & notifications
- [ ] **OpenClaw Docker Integration** — Automated task execution in isolated containers
- [ ] **AstrBot-inspired extensions** — Reference [AstrBot](https://github.com/AstrBotDevs/AstrBot)

### Backlog
- [ ] Session search & filtering
- [ ] Token usage charts / time series
- [ ] Multi-user support
- [ ] WebSocket-based live updates
- [ ] i18n (English / Chinese)

## Related Projects

- [opcode](https://github.com/winfunc/opcode) — Claude Code enhancement toolkit
- [AstrBot](https://github.com/AstrBotDevs/AstrBot) — Multi-platform bot framework
- [claude-code-telegram](https://github.com/RichardAtCT/claude-code-telegram) — Telegram integration for Claude Code
- [EdgeClaw](https://github.com/OpenBMB/EdgeClaw) — Secure isolated execution

## License

MIT
