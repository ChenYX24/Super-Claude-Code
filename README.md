# Super Claude Code

A web dashboard for managing and monitoring [Claude Code](https://docs.anthropic.com/en/docs/claude-code) sessions, teams, tokens, MCP servers, and configuration files.

一个用于管理和监控 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 会话、团队、Token、MCP 服务器和配置文件的 Web 仪表盘。

Built with / 技术栈: **Next.js 15** + **TypeScript** + **Tailwind CSS v4** + **shadcn/ui**

## Features / 功能

### Overview Dashboard / 总览仪表盘
- At-a-glance summary of all Claude Code activity / 一览所有 Claude Code 活动摘要
- Team status, session counts, token usage stats / 团队状态、会话数量、Token 用量统计
- Quick navigation to all sections / 快速导航至各功能模块

### Team Board / 团队看板
- Real-time view of team members with status indicators (working / idle / completed / stale / terminated) / 实时展示团队成员及状态指示器
- Task Kanban board (Pending → In Progress → Completed) with task persistence / 任务看板（待处理 → 进行中 → 已完成），支持持久化
- Message stream showing inter-agent communication / 消息流展示 Agent 间通信
- Past agents discovery and collapsible display / 历史 Agent 自动发现与折叠展示
- Team selector dropdown for multiple teams / 团队下拉选择器

### Sessions / 会话管理
- Grid view of all sessions across all projects / 网格视图展示所有项目的会话
- Color-coded status blocks (ClaudeGlance-style) / 彩色状态方块
- Session detail view with conversation messages / 会话详情与对话消息
- File preview for referenced files / 引用文件预览
- Deep linking from Team Board to related sessions / 从团队看板深链接到关联会话

### Token Usage / Token 用量
- Per-session and per-project token consumption tracking / 按会话和项目追踪 Token 消耗
- Input / Output / Cache Read / Cache Write breakdown / 输入/输出/缓存读/缓存写分项统计
- Total cost estimation / 总费用估算
- CSV export (Detail mode & Summary mode) / CSV 导出（明细模式 & 汇总模式）

### MCP Server Management / MCP 服务器管理
- View all configured MCP servers (global `settings.json` + per-project `.mcp.json`) / 查看所有已配置的 MCP 服务器
- Server type, command, args, and environment display / 服务器类型、命令、参数、环境变量展示
- Per-project grouping / 按项目分组

### CLAUDE.md Editor / CLAUDE.md 编辑器
- Split-pane editor with live Markdown preview / 分栏编辑器 + 实时 Markdown 预览
- Edit global and project-level CLAUDE.md files / 编辑全局和项目级 CLAUDE.md 文件
- Create new CLAUDE.md files via: / 创建新 CLAUDE.md 文件：
  - **Project presets** (auto-detected from `~/.claude/projects/`) / 项目预设（自动检测）
  - **Directory browser** (navigate filesystem with drive switching) / 文件浏览器（支持切换磁盘）
  - **Custom path** (paste any directory path) / 自定义路径（粘贴任意目录）
- Delete CLAUDE.md files with confirmation dialog / 删除 CLAUDE.md 文件（带确认对话框）
- Keyboard shortcut: `Ctrl+S` to save / 快捷键 `Ctrl+S` 保存

### General / 通用
- Dark mode support (system preference) / 暗色模式（跟随系统）
- Responsive layout with sidebar navigation / 响应式侧边栏布局
- Cursor-pointer on all interactive elements / 所有可交互元素显示手型光标
- Auto-refreshing data from `~/.claude/` directory / 自动刷新 `~/.claude/` 目录数据

## Getting Started / 快速开始

### Prerequisites / 前置要求
- Node.js 18+
- Claude Code installed and configured (`~/.claude/` directory exists) / 已安装并配置 Claude Code

### Install & Run / 安装与运行

```bash
# Clone / 克隆
git clone https://github.com/ChenYX24/Super-Claude-Code.git
cd Super-Claude-Code/dashboard

# Install dependencies / 安装依赖
npm install

# Start dev server / 启动开发服务器
npm run dev
```

Open / 打开 [http://localhost:3000](http://localhost:3000)

### Build for Production / 生产构建

```bash
npm run build
npm start
```

## Project Structure / 项目结构

```
dashboard/
├── src/
│   ├── app/                  # Next.js App Router pages / 页面
│   │   ├── page.tsx          # Overview dashboard / 总览仪表盘
│   │   ├── team/             # Team Board / 团队看板
│   │   ├── sessions/         # Sessions grid & detail / 会话管理
│   │   ├── tokens/           # Token usage & export / Token 用量
│   │   ├── mcp/              # MCP server management / MCP 管理
│   │   ├── editor/           # CLAUDE.md editor / 编辑器
│   │   └── api/              # API routes / API 路由
│   ├── components/           # Shared UI components / 共享组件
│   │   ├── ui/               # shadcn/ui primitives / 基础组件
│   │   ├── team-board/       # Team-specific components / 团队组件
│   │   └── markdown-content.tsx
│   └── lib/                  # Core logic / 核心逻辑
│       ├── claude-reader.ts  # Read ~/.claude/ data / 读取团队、任务、消息
│       ├── session-reader.ts # Read session JSONL files / 读取会话文件
│       ├── claudemd.ts       # CLAUDE.md file management / 文件管理
│       └── types.ts          # Shared types / 共享类型
├── public/                   # Static assets / 静态资源
└── package.json
```

## Tech Stack / 技术栈

| Layer / 层 | Technology / 技术 |
|-------|-----------|
| Framework / 框架 | Next.js 15 (App Router) |
| Language / 语言 | TypeScript |
| Styling / 样式 | Tailwind CSS v4 |
| UI Components / 组件库 | shadcn/ui |
| Markdown | react-markdown + remark-gfm |
| Data Source / 数据源 | Local filesystem (`~/.claude/`) / 本地文件系统 |

## TODO / Roadmap / 路线图

### Phase 3: Dashboard Enhancement / 仪表盘增强
- [ ] **Settings Panel / 设置面板** — View/edit Claude configuration / 查看编辑 Claude 配置
- [ ] **Running Process Detection / 运行进程检测** — Detect active Claude CLI processes / 检测活跃的 CLI 进程
- [ ] **Terminal-style Session View / 终端风格会话视图** — Render sessions closer to terminal appearance / 更接近终端显示效果
- [ ] **MCP Server Health Check / MCP 健康检查** — Detect whether servers are running / 检测服务器是否在线

### Phase 4: Claude Code Command Integration / 命令集成
- [ ] **/dashboard command** — Open dashboard for current session only / 仅当前会话开启
- [ ] **/dashboard_all command** — Open dashboard for all sessions / 开启所有会话

### Phase 5: External Integrations / 外部集成
- [ ] **Telegram Bot** — Mobile control & notifications / 移动端控制与通知
- [ ] **Docker Integration / Docker 集成** — Automated task execution in isolated containers / 隔离容器中执行任务

### Extra Toolkits / 额外工具库

> Independent modules that extend the platform beyond Claude Code management.
> 独立于 Claude Code 管理的扩展工具模块。

#### Financial Market Analysis / 金融行情分析
- [ ] **Precious Metals / 贵金属** — Real-time gold & silver price tracking, trend analysis / 黄金白银实时行情与趋势分析
- [ ] **Crypto / 加密货币** — Bitcoin and major crypto monitoring, alerts / 比特币等主流币监控与提醒
- [ ] **Stock Indices / 股指分析** — Major indices (S&P 500, NASDAQ, CSI 300, HSI) analysis & dashboards / 主要股指（标普、纳斯达克、沪深300、恒生）分析看板

#### Video & Media Pipeline / 视频与媒体流水线
- [ ] **Video Info Extraction / 视频信息抓取** — Extract metadata, transcripts, key frames from videos / 提取视频元数据、字幕、关键帧
- [ ] **Video Generation / 视频生成** — AI-powered video content generation / AI 视频内容生成
- [ ] **Video Editing / 视频剪辑** — Automated editing, clipping, compositing / 自动剪辑、裁剪、合成
- [ ] **Mobile Media Upload / 手机媒体上传** — Send photos & videos from mobile, trigger processing pipelines / 手机端发送图片视频，触发处理流水线

#### Multi-Platform Content Hub / 多平台内容中心
- [ ] **GitHub Integration** — Repo tracking, star/fork alerts, release monitoring / 仓库追踪、Star/Fork 提醒、Release 监控
- [ ] **Xiaohongshu (RED) / 小红书** — Content management, trend analysis, auto-publish / 内容管理、趋势分析、自动发布
- [ ] **Hugging Face** — Model & dataset tracking, paper alerts / 模型和数据集追踪、论文提醒
- [ ] **Paper Management / 论文管理** — ArXiv/Semantic Scholar paper collection, categorization, push notifications / 论文收集、分类、推送通知
- [ ] **Smart Categorization & Push / 智能分类推送** — AI-powered content routing to relevant channels / AI 内容分类路由至相关频道

#### Unified API Management Platform / API 大一统管理中台
- [ ] **API Usage Dashboard / API 用量看板** — Centralized view of all API keys & usage across providers / 集中查看所有 API Key 及各平台用量
- [ ] **Cost Analytics / 费用分析** — Cross-provider cost breakdown, trends, forecasting / 跨平台费用明细、趋势、预测
- [ ] **Usage Statistics / 使用统计** — Request counts, latency, error rates, model comparison / 请求量、延迟、错误率、模型对比
- [ ] **Budget Alerts / 预算提醒** — Configurable spending alerts, auto-pause on threshold / 可配置的消费提醒，超阈值自动暂停
- [ ] **Key Rotation & Security / Key 轮换与安全** — API key lifecycle management, rotation reminders / API Key 生命周期管理、轮换提醒

### Backlog / 待定
- [ ] Session search & filtering / 会话搜索与筛选
- [ ] Token usage charts / Token 用量图表
- [ ] Multi-user support / 多用户支持
- [ ] WebSocket-based live updates / WebSocket 实时更新
- [ ] i18n (English / Chinese) / 国际化
