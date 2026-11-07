[English](./README.md) | [简体中文](./README.zh-CN.md)

# FrankenMCP

🌐 **在线演示**：[https://frankenmcp.vercel.app](https://frankenmcp.vercel.app)

> **FrankenMCP** 通过动态路由器将多个原本不兼容的 MCP 服务器缝合为一个有机整体，并提供实时的“怪物实验室（Monster Lab）”仪表盘，逐轮展示工具路由决策、Schema 裁剪结果以及省下的上下文 Token 数量。
>
> *专为 Kiroween 2026 黑客松（Frankenstein 类别）打造。*

---

## 💡 工作原理
AI 助手同时接多个 MCP 服务器时会"撑到"：每个服务器的全部工具定义都要先塞进模型的上下文再干活，接五个服务器，模型先读 100 多个工具定义。FrankenMCP 在中间放了一个动态路由器：每轮只挑相关的服务器、把其余工具裁掉，模型永远只看到需要的工具。被裁掉的 schema 就是实打实省下的上下文 token，怪物实验室仪表盘上实时可见。

路由器只负责筛选、不负责调用：它决定"让模型看到哪些工具"，选哪个工具、传什么参数、真正调用，还是模型自己来。

---

## ⚡ 极速上手（零配置）

无需任何 API 密钥或外部依赖服务，几分钟内即可在本地完整启动运行：

```bash
# 1. 克隆代码仓库
git clone https://github.com/leethoneid/frankenmcp.git
cd frankenmcp

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000) 即可体验交互界面并查看内置 MCP 服务器的路由效果。

---

## 🌐 在线演示与一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fleethoneid%2Ffrankenmcp)

- **线上演示地址**：[https://frankenmcp.vercel.app](https://frankenmcp.vercel.app)
- **零配置开箱体验**：免注册、免填 API Key、无需准备数据库；启动时自动连接内置的三大演示 MCP 服务器。

---

## 🧩 内置演示 MCP 服务器

FrankenMCP 预配了三个开箱即用、零 Key 依赖的演示 MCP 服务器：

1. **`notes`** — 本地轻量笔记增删改查服务，内含 `[DEMO]` 演示数据。
2. **`tasks`** — 本地待办事项与清单管理服务，支持优先级与完成状态标记。
3. **`calculator`** — 无状态四则运算与多维物理单位换算服务（长度、重量、温度）。

---

## 🚀 双轨部署架构 (Dual-Mode Deployment)

FrankenMCP 采用自适应双轨通信架构，同时支持本地高保真开发与无服务器（Serverless）云端托管：

| 能力维度 | 本地开发环境 (`local`) | Vercel 云端环境 (`vercel`) |
| :--- | :--- | :--- |
| **服务器通信** | Stdio 独立子进程 (`node src/mcp-servers/...`) | 进程内适配器 (`InProcessMCPAdapter`, 初始化 <1ms) |
| **路由决策引擎** | 完整 `mcp-dynamic-router` 进程（TF-IDF 语义匹配） | 进程内规则降级引擎 (`simplifiedRoute()`, <1ms 响应) |
| **状态持久化** | 在 Node.js 服务进程生命周期内持久 | 函数实例级生命周期（函数冷重启后重置为演示种子数据） |
| **超时执行限制** | 无限制 | 10 秒硬性上限约束 (`vercel.json`) |
| **适用场景** | 深度架构评测、自定义 MCP 服务器接入与本地调试 | 评委极速零摩擦体验、即开即用在线试玩 |

### 无服务器环境下的状态持久化说明
在 Vercel Serverless 环境中，新建的笔记与任务保存在函数实例内存中。在热函数（Warm Function）调用期间数据互通；当函数遭遇冷启动重启时，将自动重置为包含 `[DEMO]` 标识的种子数据。生产环境若需跨会话持久化，可无缝对接通过 SSE 或 HTTP 暴露并持久化至云端数据库的外部 MCP 服务器。

### 健康检查接口 (`/api/health`)
FrankenMCP 提供机器可读的健康检查接口，具备按需懒加载唤醒与实时状态诊断能力：

```bash
curl https://frankenmcp.vercel.app/api/health
```

接口响应示例：
```json
{
  "status": "healthy",
  "environment": "vercel",
  "servers": [
    { "id": "notes", "name": "Notes Server", "status": "connected", "transport": "in-process", "toolCount": 5 },
    { "id": "tasks", "name": "Tasks Server", "status": "connected", "transport": "in-process", "toolCount": 5 },
    { "id": "calculator", "name": "Calculator Server", "status": "connected", "transport": "in-process", "toolCount": 5 }
  ],
  "timestamp": "2026-11-07T08:37:01.301Z"
}
```

- **`healthy` (HTTP 200)**：3 个演示服务器全部在线可用。
- **`degraded` (HTTP 200)**：1 或 2 个演示服务器在线。
- **`error` (HTTP 503)**：服务器初始化异常或可用服务器为 0（默认 Fail-Closed 防御）。

### Vercel 部署配置考量 (`vercel.json`)
- **`maxDuration: 10s`**：严格匹配 Vercel Hobby 免费套餐函数执行上限（进程内执行单次往往仅耗时 <50ms）。

### 常见问题与排错 (Troubleshooting)
- **路由器不可用提示**：确保运行环境满足 Node.js ≥20。本地测试时可直接运行 `npx -y github:leethoneid/mcp-dynamic-router serve` 验证子进程权限。
- **本地冷启动较慢**：Stdio 模式下首次启动需创建 Node 子进程通信管道，后续热调用已被连接池复用。
- **工具未加载**：访问 `/api/health` 确认全部服务器状态均为 `connected`。

---

## 📜 既有成果披露 (Prior Work & Disclosure)

严格遵循 Kiroween 2026 赛事关于旧代码复用的披露规则：
- 核心动态路由器以依赖形式引用外部开源项目（`leethoneid/mcp-dynamic-router`），该组件为作者既有的开源成果，在其自身仓库中保留 PolyForm Noncommercial 协议。
- 本仓库内的所有前端界面、Next.js 应用、怪物实验室仪表盘、适配层、演示服务器、自动化测试及文档，均由作者于 2026-10-30 至 2026-12-04 参赛期间从零独立新建。

---

## 🤖 Kiro 深度融合

FrankenMCP 严格遵循并实践 Kiro 开发工作流：
- **Specs 规范 (`.kiro/specs/`)**：涵盖 `router-core`、`monster-lab-dashboard`、`playground-chat`、`deployment` 四大特性的 EARS 需求、架构设计与任务拆解。
- **Steering 定向 (`.kiro/steering/`)**：产品愿景、技术标准与工程结构规范。
- **Hooks 自动化钩子 (`.kiro/hooks/`)**：保存触发类型校验与 Schema 快照自动化。
- **MCP 预配配置 (`.kiro/settings/mcp.json`)**：默认多服务器编排连接描述。
- **Agents 协同角色 (`.kiro/agents/`)**：专业化路由编排 Agent 定义。

---

## 📄 开源许可 (License)

本项目遵循 [MIT 许可证](./LICENSE) 开源。
