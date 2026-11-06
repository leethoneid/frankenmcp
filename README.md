[English](./README.md) | [简体中文](./README.zh-CN.md)

# FrankenMCP

> **FrankenMCP** stitches multiple incompatible MCP servers together through a dynamic router, featuring a live "Monster Lab" dashboard that visualizes per-turn tool routing, schema trimming, and context token savings in real time.
>
> *Built for Kiroween 2026 Hackathon (Frankenstein Category).*

---

## 💡 How it works
Most AI agents choke when you connect several MCP servers at once: every server's full tool list is loaded into the model's context before it does anything — connect five servers and the model reads 100+ tool definitions first. FrankenMCP puts a dynamic router in the middle: for each request it picks only the relevant server(s) and trims the rest, so the model only ever sees the tools it needs. The trimmed schemas are real context tokens saved, shown live in the Monster Lab dashboard.

The router does the triage, not the calling: it decides *which tools the model gets to see*. The model still chooses the tool, supplies the arguments, and makes the call.

---

## ⚡ 60-Second Quickstart (Zero-Config)

You can run the playground locally in under 60 seconds without API keys or external services:

```bash
# 1. Clone the repository
git clone https://github.com/leethoneid/frankenmcp.git
cd frankenmcp

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application and interact with the built-in MCP servers.

---

## 🌐 Live Demo

- **Hosted URL**: *Deployment link pending Vercel configuration*
- **No registration or API key required** to test core routing and the Monster Lab dashboard.

---

## 🧩 Built-in Demo MCP Servers

FrankenMCP comes pre-configured with three standalone stdio MCP servers requiring zero keys or external credentials:

1. **`notes`** — Lightweight local notes store with CRUD capabilities.
2. **`tasks`** — Local to-do and checklist management.
3. **`calculator`** — Basic arithmetic and unit conversion tool for direct execution validation.

---

## 📜 Prior Work & Disclosure

In accordance with Kiroween 2026 rules regarding pre-existing work:
- The core dynamic router is integrated as an external dependency (`leethoneid/mcp-dynamic-router`), which is a pre-existing open-source component by the author (licensed separately under PolyForm Noncommercial in its own repository).
- All application code, Next.js interface, Monster Lab dashboard, adapter layers, demo servers, tests, and documentation in this repository were created from scratch between October 30, 2026 and December 4, 2026 specifically for Kiroween 2026.

---

## 🤖 Kiro Integration

FrankenMCP leverages the Kiro development workflow directly:
- **Specs (`.kiro/specs/`)**: Requirements (EARS syntax), architecture designs, and task breakdowns.
- **Steering (`.kiro/steering/`)**: Product vision, architectural standards, and structural guidelines.
- **Hooks (`.kiro/hooks/`)**: Automated quality checks and schema verification.
- **MCP Settings (`.kiro/settings/mcp.json`)**: Default multi-server orchestration configuration.
- **Agents (`.kiro/agents/`)**: Specialized autonomous workflow definitions.

---

## 📄 License

This repository is licensed under the [MIT License](./LICENSE).
