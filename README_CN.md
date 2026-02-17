# Super Claude Code

[English](./README.md) | [中文](./README_CN.md)

一个用于管理和监控 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 会话、团队、Token、MCP 服务器和配置文件的 Web 仪表盘。

技术栈: **Next.js 15** + **TypeScript** + **Tailwind CSS v4** + **shadcn/ui**

## 功能

### 总览仪表盘
- 一览所有 Claude Code 活动摘要
- 团队状态、会话数量、Token 用量统计
- 快速导航至各功能模块

### 团队看板
- 实时展示团队成员及状态指示器（工作中 / 空闲 / 已完成 / 超时 / 已终止）
- 任务看板（待处理 → 进行中 → 已完成），支持持久化
- 消息流展示 Agent 间通信
- 历史 Agent 自动发现与折叠展示
- 团队下拉选择器

### 会话管理
- 网格视图展示所有项目的会话
- 彩色状态方块（ClaudeGlance 风格）
- 会话详情与对话消息
- 引用文件预览
- 从团队看板深链接到关联会话

### Token 用量
- 按会话和项目追踪 Token 消耗
- 输入 / 输出 / 缓存读 / 缓存写分项统计
- 总费用估算
- CSV 导出（明细模式 & 汇总模式）

### MCP 服务器管理
- 查看所有已配置的 MCP 服务器（全局 `settings.json` + 项目级 `.mcp.json`）
- 服务器类型、命令、参数、环境变量展示
- 按项目分组

### CLAUDE.md 编辑器
- 分栏编辑器 + 实时 Markdown 预览
- 编辑全局和项目级 CLAUDE.md 文件
- 创建新 CLAUDE.md 文件：
  - **项目预设**（自动检测 `~/.claude/projects/`）
  - **文件浏览器**（支持切换磁盘）
  - **自定义路径**（粘贴任意目录）
- 删除 CLAUDE.md 文件（带确认对话框）
- 快捷键 `Ctrl+S` 保存

### 通用
- 暗色模式（跟随系统）
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
│   ├── app/                  # Next.js App Router 页面
│   │   ├── page.tsx          # 总览仪表盘
│   │   ├── team/             # 团队看板
│   │   ├── sessions/         # 会话管理
│   │   ├── tokens/           # Token 用量
│   │   ├── mcp/              # MCP 管理
│   │   ├── editor/           # CLAUDE.md 编辑器
│   │   └── api/              # API 路由
│   ├── components/           # 共享组件
│   │   ├── ui/               # shadcn/ui 基础组件
│   │   ├── team-board/       # 团队相关组件
│   │   └── markdown-content.tsx
│   └── lib/                  # 核心逻辑
│       ├── claude-reader.ts  # 读取团队、任务、消息数据
│       ├── session-reader.ts # 读取会话 JSONL 文件
│       ├── claudemd.ts       # CLAUDE.md 文件管理
│       └── types.ts          # 共享类型
├── public/                   # 静态资源
└── package.json
```

## 技术栈

| 层 | 技术 |
|-------|-----------|
| 框架 | Next.js 15 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS v4 |
| 组件库 | shadcn/ui |
| Markdown | react-markdown + remark-gfm |
| 数据源 | 本地文件系统（`~/.claude/`） |

## 路线图

### Phase 3: 仪表盘增强
- [ ] **设置面板** — 查看/编辑 Claude 配置（settings.json、hooks、permissions）
- [ ] **运行进程检测** — 检测活跃的 Claude CLI 进程，显示实时状态
- [ ] **终端风格会话视图** — 会话详情更接近终端显示效果
- [ ] **MCP 健康检查** — 检测 MCP 服务器是否在线/可达

### Phase 4: Claude Code 命令集成
- [ ] **/dashboard 命令** — 仅当前会话开启 Dashboard
- [ ] **/dashboard_all 命令** — 开启所有会话的 Dashboard

### Phase 5: 外部集成
- [ ] **Telegram Bot** — 移动端控制与通知
- [ ] **Docker 集成** — 隔离容器中执行自动化任务

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
