[English](./README.md) | [简体中文](./README.zh-CN.md)

# FrankenMCP

> **FrankenMCP** 通过动态路由器将多个原本不兼容的 MCP 服务器缝合为一个有机整体，并提供实时的“怪物实验室（Monster Lab）”仪表盘，逐轮展示工具路由决策、Schema 裁剪结果以及省下的上下文 Token 数量。
>
> *专为 Kiroween 2026 黑客松（Frankenstein 类别）打造。*

---

## 💡 工作原理
AI 助手同时接多个 MCP 服务器时会"撑到"：每个服务器的全部工具定义都要先塞进模型的上下文再干活，接五个服务器，模型先读 100 多个工具定义。FrankenMCP 在中间放了一个动态路由器：每轮只挑相关的服务器、把其余工具裁掉，模型永远只看到需要的工具。被裁掉的 schema 就是实打实省下的上下文 token，怪物实验室仪表盘上实时可见。

路由器只负责筛选、不负责调用：它决定"让模型看到哪些工具"，选哪个工具、传什么参数、真正调用，还是模型自己来。

---

## ⚡ 60 秒极速上手（零配置）

无需任何 API 密钥或外部依赖服务，60 秒内即可在本地启动运行：

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

## 🌐 在线演示 (Live Demo)

- **线上演示地址**：*待 Vercel 部署完成后更新*
- **免注册、无需配置密钥**，即可完整体验核心路由机制与怪物实验室仪表盘。

---

## 🧩 内置演示 MCP 服务器

FrankenMCP 预配了三个开箱即用、零 Key 依赖的 Stdio MCP 服务器：

1. **`notes`** — 本地轻量笔记增删改查服务。
2. **`tasks`** — 本地待办事项与清单管理服务。
3. **`calculator`** — 基础四则运算与单位换算服务，用于验证工具执行。

---

## 🚀 双轨部署架构 (Dual-Mode Deployment)

FrankenMCP 采用双轨通信架构，同时支持本地高保真开发与无服务器（Serverless）云端托管：

- **本地开发**：MCP 服务器以真实 stdio 子进程运行（`node src/mcp-servers/...`），通过完整动态路由器进程进行智能语义检索与上下文裁剪。推荐在本地运行以体验完整路由特性。
- **Vercel 云端部署**：在禁止长期驻留子进程、冷启动禁止大体积网络拉取的 Serverless 环境下，演示服务器通过高性能进程内适配器（In-Process Adapters）提供服务，路由自动切换至毫秒级规则降级引擎（`simplifiedRoute()`，耗时 <1ms），确保在 Vercel 10 秒超时硬性约束下实现 100% 稳定运行。

---

## 📜 既有成果披露 (Prior Work & Disclosure)

严格遵循 Kiroween 2026 赛事关于旧代码复用的披露规则：
- 核心动态路由器以依赖形式引用外部开源项目（`leethoneid/mcp-dynamic-router`），该组件为作者既有的开源成果，在其自身仓库中保留 PolyForm Noncommercial 协议。
- 本仓库内的所有前端界面、Next.js 应用、怪物实验室仪表盘、适配层、演示服务器、自动化测试及文档，均由作者于 2026-10-30 至 2026-12-04 参赛期间从零独立新建。

---

## 🤖 Kiro 深度融合

FrankenMCP 严格遵循并实践 Kiro 开发工作流：
- **Specs 规范 (`.kiro/specs/`)**：涵盖 EARS 格式的需求定义、系统设计与任务清单。
- **Steering 定向 (`.kiro/steering/`)**：产品愿景、技术标准与工程结构规范。
- **Hooks 自动化钩子 (`.kiro/hooks/`)**：保存触发类型校验与 Schema 快照自动化。
- **MCP 预配配置 (`.kiro/settings/mcp.json`)**：默认多服务器编排连接描述。
- **Agents 协同角色 (`.kiro/agents/`)**：专业化路由编排 Agent 定义。

---

## 📄 开源许可 (License)

本项目遵循 [MIT 许可证](./LICENSE) 开源。
