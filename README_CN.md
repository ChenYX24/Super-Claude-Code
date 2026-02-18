# Super Claude Code

[English](./README.md) | [中文](./README_CN.md)

一个用于管理和监控 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 会话、团队、Token、MCP 服务器和配置文件的 Web 仪表盘。

技术栈: **Next.js 16** + **TypeScript** + **Tailwind CSS v4** + **shadcn/ui** + **Recharts**

## 功能

### 总览仪表盘
- 6 个统计卡片（总会话数、活跃团队、Agent 数、Token 用量、平均会话费用、缓存命中率）
- 活跃进程检测与状态指示器
- Token 摘要，含 7 天迷你趋势图
- 最近会话快速访问
- 快捷操作面板
- 团队概览

### 团队看板
- 实时展示团队成员及状态指示器（工作中 / 空闲 / 已完成 / 超时 / 已终止）
- 任务看板（待处理 → 进行中 → 已完成），支持持久化
- 消息流展示 Agent 间通信
- 历史 Agent 自动发现与折叠展示
- 团队下拉选择器

### 会话管理
- 网格/列表视图切换展示所有项目的会话
- 彩色状态方块（ClaudeGlance 风格）
- **收藏/星标** 系统，支持 localStorage 持久化
- **日期和模型筛选** 快速查找会话
- **搜索功能** 跨会话名称和项目搜索
- **排序选项**（最新/最旧、费用、Token 数）
- **自动刷新**，每 10 秒更新一次
- Card/Terminal 视图模式，支持 localStorage 记忆
- 会话详情与对话消息
- 引用文件预览
- **Markdown 导出** 会话对话内容
- 从团队看板深链接到关联会话

### Token 用量
- **时间范围选择器**（7 天 / 14 天 / 30 天 / 全部）
- **交互式面积图**，使用 Recharts + Brush 缩放控制
- **图表/表格切换** 数据可视化
- **分页表格**，支持每页条数控制
- **模型分布饼图** 展示各模型占比
- **CSV 导出**（明细模式 & 汇总模式）
- **今日 vs 本周对比** 统计数据
- **缓存节省** 计算与展示
- 按会话和项目追踪 Token 消耗
- 输入 / 输出 / 缓存读 / 缓存写分项统计
- 总费用估算，支持各模型定价

### 对话查看器
- **气泡式对话查看器** 交互式会话回放
- **自动滚动** 至最新消息
- **工具调用折叠/展开** 提高可读性
- **思考块显示** 展示扩展思考内容
- **会话选择器** 快速切换会话
- 实时对话渲染，支持 Markdown

### 工具箱（配置中心）
- **5 标签页界面**：MCP + Skills & Commands + Hooks + Agents + Rules
- **MCP 商店**：14 个热门服务器一键安装
  - 包括：Filesystem、Fetch、GitHub、Brave Search、Postgres、Playwright、Memory、Puppeteer、Slack、Sequential Thinking、Time、EverythingSearch、Perplexity、Google Drive
- **全 CRUD 操作** 支持所有工具类型（创建、读取、更新、删除）
- **Skills & Agents & Rules 模板商店** 快速设置
- **帮助文档** 各工具类型说明
- **摘要视图** 显示数量和状态
- MCP 服务器健康检查

### CLAUDE.md 编辑器
- 分栏编辑器 + 实时 Markdown 预览
- 编辑全局和项目级 CLAUDE.md 文件
- 创建新 CLAUDE.md 文件：
  - **项目预设**（自动检测 `~/.claude/projects/`）
  - **文件浏览器**（支持切换磁盘）
  - **自定义路径**（粘贴任意目录）
- 删除 CLAUDE.md 文件（带确认对话框）
- 快捷键 `Ctrl+S` 保存
- Registry 视图展示所有 CLAUDE.md 文件

### 设置
- **可编辑配置**（模型选择、主题、功能开关）
- **花费预警设置** 支持阈值配置
- 直接集成 Claude Code settings.json
- 模型默认值与偏好管理

### MCP 服务器管理（旧版）
- 查看所有已配置的 MCP 服务器（全局 `settings.json` + 项目级 `.mcp.json`）
- 服务器类型、命令、参数、环境变量展示
- 按项目分组
- *注意：v0.8.0 已由工具箱替代*

### 通用
- **通知系统** 含花费预警和铃铛图标
- **暗色模式**（跟随系统）
- **键盘快捷键**（1-8 页面导航）
- 响应式侧边栏布局
- 所有可交互元素显示手型光标
- 自动刷新 `~/.claude/` 目录数据

## 快速开始

### 前置要求
- Node.js 18+
- 已安装并配置 Claude Code（`~/.claude/` 目录存在）

### 安装与运行

```bash
git clone https://github.com/ChenYX24/Super-Claude-Code.git
cd Super-Claude-Code/dashboard
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

### 生产构建

```bash
npm run build
npm start
```

## 项目结构

```
dashboard/
├── src/
│   ├── app/                      # Next.js App Router 页面
│   │   ├── page.tsx              # 总览仪表盘
│   │   ├── team/                 # 团队看板
│   │   ├── sessions/             # 会话管理
│   │   ├── tokens/               # Token 用量
│   │   ├── chat/                 # 对话查看器
│   │   ├── toolbox/              # 工具箱配置中心
│   │   ├── editor/               # CLAUDE.md 编辑器
│   │   ├── settings/             # 设置面板
│   │   ├── mcp/                  # MCP 管理（旧版）
│   │   └── api/                  # API 路由（19 个端点）
│   │       ├── teams/            # 团队管理
│   │       ├── sessions/         # 会话管理
│   │       ├── tokens/           # Token 统计与导出
│   │       ├── claudemd/         # CLAUDE.md CRUD & registry
│   │       ├── toolbox/          # 工具箱数据与 CRUD
│   │       ├── browse/           # 文件系统浏览
│   │       ├── settings/         # 设置 GET/PUT
│   │       └── processes/        # 进程检测
│   ├── components/               # 共享组件
│   │   ├── ui/                   # shadcn/ui 基础组件
│   │   ├── team-board/           # 团队相关组件
│   │   ├── sessions/             # 会话组件（block, detail, list, analytics）
│   │   ├── toolbox/              # 工具箱对话框（rule, agent）
│   │   ├── sidebar-nav.tsx       # 侧边栏导航
│   │   ├── notification-bell.tsx # 通知系统
│   │   └── markdown-content.tsx  # Markdown 渲染器
│   ├── hooks/                    # 自定义 React Hooks
│   │   ├── use-favorites.ts      # 收藏 localStorage hook
│   │   ├── use-notifications.ts  # 通知 hook
│   │   └── use-keyboard-shortcuts.ts # 全局键盘快捷键
│   └── lib/                      # 核心逻辑
│       ├── claude-reader.ts      # 团队、任务、消息 + 任务缓存 + MCP
│       ├── session-reader.ts     # 会话 JSONL + Token 导出 + 模型检测
│       ├── claudemd.ts           # CLAUDE.md CRUD + Registry
│       ├── toolbox-reader.ts     # Skills/Commands/Hooks/Agents/Rules 读取
│       ├── mcp-registry.ts       # 14 个热门 MCP 服务器注册
│       ├── tools-registry.ts     # Skills/Agents/Rules 模板库
│       ├── format-utils.ts       # 公共格式化工具
│       ├── process-reader.ts     # 进程检测
│       └── types.ts              # 共享类型
├── public/                       # 静态资源
└── package.json
```

## 技术栈

| 层 | 技术 |
|-------|-----------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS v4 |
| 组件库 | shadcn/ui |
| 图表 | Recharts |
| Markdown | react-markdown + remark-gfm |
| 数据源 | 本地文件系统（`~/.claude/`） |
| 状态管理 | localStorage（收藏、通知、视图偏好） |

## 路线图

### Phase 3: 仪表盘增强
- [x] **设置面板** — 查看/编辑 Claude 配置 ✅ v0.8.0
- [x] **运行进程检测** — 检测活跃的 Claude CLI 进程 ✅ v0.4.0
- [x] **终端风格会话视图** — 会话详情更接近终端显示效果 ✅ v0.4.0
- [x] **MCP 健康检查** — 检测 MCP 服务器是否在线/可达 ✅ v0.8.0
- [x] **通知系统** — 花费预警与更新提示 ✅ v0.8.0

### Phase 4: Claude Code 命令集成
- [x] **/dashboard 命令** — 仅当前会话开启 Dashboard ✅（脚本位于 `~/.claude/scripts/scc/`）
- [x] **/dashboard_all 命令** — 开启所有会话的 Dashboard ✅（脚本位于 `~/.claude/scripts/scc/`）

### Phase 5: 外部集成
- [ ] **Telegram Bot** — 移动端控制与通知
- [ ] **Docker 集成** — 隔离容器中执行自动化任务

### Phase 6: 质量与打磨
- [ ] **代码质量**：拆分大文件（toolbox 900+ 行）、测试覆盖、代码审查
- [ ] **UX 打磨**：响应式优化、暗色模式全覆盖、统一加载状态
- [ ] **移动端远程管理**：手机端项目管理与控制

### AI 工具箱（自动接单生态）

> 独立扩展模块，通过统一入口接收任务，AI 自动分发执行。

#### 创意与内容制作
- [ ] **视频剪辑接单** — 接收素材 + 要求，AI 自动剪辑/合成/配字幕
- [ ] **设计接单** — 接收设计需求，AI 生成海报/Logo/UI 稿
- [ ] **视频信息抓取** — 提取元数据、字幕、关键帧
- [ ] **手机媒体上传** — 手机端发图片/视频触发处理流水线

#### 编程与开发
- [ ] **编程接单** — 接收需求，AI 自动编码 + 测试 + 交付
- [ ] **代码审查服务** — 提交 PR/代码片段，AI 出审查报告
- [ ] **Bug 修复服务** — 描述问题 + 仓库地址，AI 定位修复

#### 金融行情分析
- [ ] **贵金属** — 黄金白银实时行情与趋势
- [ ] **加密货币** — 比特币等监控与提醒
- [ ] **股指分析** — 标普/纳斯达克/沪深300/恒生看板

#### 多平台内容中心
- [ ] **GitHub/小红书/HF/论文** — 管理分类推送
- [ ] **智能分类推送** — AI 内容路由至相关频道

#### API 大一统管理中台
- [ ] **用量看板 + 费用分析 + 预算提醒 + Key 管理**

### 待定
- [ ] Token 用量图表
- [ ] 多用户支持
- [ ] WebSocket 实时更新
- [ ] 国际化（English / Chinese）
