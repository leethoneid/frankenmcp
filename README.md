[English](./README.md) | [简体中文](./README.zh-CN.md)

# FrankenMCP

🌐 **Live Demo**: [https://frankenmcp.vercel.app](https://frankenmcp.vercel.app)

> **FrankenMCP** stitches multiple incompatible MCP servers together through a dynamic router, featuring a live "Monster Lab" dashboard that visualizes per-turn tool routing, schema trimming, and context token savings in real time.
>
> *Built for Kiroween 2026 Hackathon (Frankenstein Category).*

---

## 💡 How it works
Most AI agents choke when you connect several MCP servers at once: every server's full tool list is loaded into the model's context before it does anything — connect five servers and the model reads 100+ tool definitions first. FrankenMCP puts a dynamic router in the middle: for each request it picks only the relevant server(s) and trims the rest, so the model only ever sees the tools it needs. The trimmed schemas are real context tokens saved, shown live in the Monster Lab dashboard.

The router does the triage, not the calling: it decides *which tools the model gets to see*. The model still chooses the tool, supplies the arguments, and makes the call.

---

## ⚡ Quickstart (Zero-Config)

You can get the playground up and running locally in a few minutes without API keys or external services:

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

## 🌐 Live Demo & One-Click Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fleethoneid%2Ffrankenmcp)

- **Hosted URL**: [https://frankenmcp.vercel.app](https://frankenmcp.vercel.app)
- **Zero Configuration**: No signup, no API keys, and no database credentials required. The demo connects three built-in MCP servers on startup.

---

## 🧩 Built-in Demo MCP Servers

FrankenMCP comes pre-configured with three standalone MCP servers requiring zero keys or external credentials:

1. **`notes`** — Lightweight local notes store with CRUD capabilities and `[DEMO]` pre-seeded fixtures.
2. **`tasks`** — Local to-do and checklist management with priority levels and completion tracking.
3. **`calculator`** — Stateless arithmetic operations and unit conversion (length, weight, temperature).

---

## 🤖 Use the Router in Your Agent

The demo above shows routing in a browser. The part you install into your own agent is the router itself — [`mcp-dynamic-router`](https://github.com/leethoneid/mcp-dynamic-router) — a stdio MCP server that sits between your agent and your MCP servers, exposing only the relevant tools each turn.

Why it matters: connecting 3–5 MCP servers (GitHub, Postgres, Slack, Filesystem, Docker) routinely injects 30,000–60,000+ tokens of tool schemas into every prompt turn — 20–35% of your context window — before you type a word. (Figures from the router repo, measured as heuristic token estimates on a synthetic fixture; see the router README for the method.)

Install it once, then add it to your agent:

```bash
# Import your existing editor MCP configs, then install globally
npx -y github:leethoneid/mcp-dynamic-router import --editor all
npm install -g github:leethoneid/mcp-dynamic-router
```

Claude Code:
```bash
claude mcp add mcp-router -- mcp-router serve
```

Codex:
```bash
codex mcp add mcp-router -- npx -y github:leethoneid/mcp-dynamic-router serve
```
Verify with `/mcp` inside Codex.

Other MCP clients (Cursor, Antigravity, Windsurf, Cline, Continue, Zed): add this to your client's MCP settings file:
```json
{
  "mcpServers": {
    "mcp-router": {
      "command": "mcp-router",
      "args": ["serve"]
    }
  }
}
```

Full per-editor guide: [mcp-dynamic-router README](https://github.com/leethoneid/mcp-dynamic-router).

---

## 🚀 Dual-Mode Deployment Architecture

FrankenMCP employs an adaptive dual-mode transport architecture to support both high-fidelity local development and serverless cloud deployment:

| Capability | Local Development (`local`) | Vercel Serverless (`vercel`) |
| :--- | :--- | :--- |
| **Server Transports** | Stdio child processes (`node src/mcp-servers/...`) | In-process adapters (`InProcessMCPAdapter`, <1ms init) |
| **Router Engine** | Full `mcp-dynamic-router` subprocess with TF-IDF | In-process fallback rule engine (`simplifiedRoute()`) |
| **State Persistence** | Persistent across server process lifetime | Function-instance scoped (ephemeral across cold starts) |
| **Timeout Constraints** | Unbounded | Strict 10-second ceiling (`vercel.json`) |
| **Audience** | Architecture evaluation & custom MCP server dev | Instant frictionless hackathon judge evaluation |

### State Persistence Behavior on Serverless
In Vercel serverless functions, newly created notes and tasks reside in function-instance memory. Warm function invocations share state; cold restarts reset to pre-seeded demo fixtures. For production environments requiring cross-session persistence, configure external MCP servers over SSE or HTTP backed by persistent databases.

### Health Check Endpoint (`/api/health`)
FrankenMCP exposes a machine-readable health endpoint that performs on-demand server initialization and reports operational status:

```bash
curl https://frankenmcp.vercel.app/api/health
```

Example response:
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

- **`healthy` (HTTP 200)**: All 3 demo servers online and responsive.
- **`degraded` (HTTP 200)**: 1 or 2 demo servers connected.
- **`error` (HTTP 503)**: Server initialization failure or 0 servers reachable (Fail-Closed).

### Vercel Configuration Rationale (`vercel.json`)
- **`maxDuration: 10s`**: Respects Vercel Hobby plan execution ceilings. In-process execution typically completes in <50ms.

### Troubleshooting
- **Router unavailable error**: Ensure Node.js ≥20 is installed. When testing locally, run `npx -y github:leethoneid/mcp-dynamic-router serve` to confirm subprocess permissions.
- **Slow cold starts on local dev**: Stdio mode spawns real child processes; subsequent warm calls are cached.
- **Missing tools**: Check `/api/health` to ensure all servers report `connected`.

---

## 📜 Prior Work & Disclosure

In accordance with Kiroween 2026 rules regarding pre-existing work:
- The core dynamic router is integrated as an external dependency (`leethoneid/mcp-dynamic-router`), which is a pre-existing open-source component by the author (licensed separately under PolyForm Noncommercial in its own repository).
- All application code, Next.js interface, Monster Lab dashboard, adapter layers, demo servers, tests, and documentation in this repository were created from scratch between October 30, 2026 and December 4, 2026 specifically for Kiroween 2026.

---

## 🤖 Kiro Integration

FrankenMCP leverages the Kiro development workflow directly:
- **Specs (`.kiro/specs/`)**: Requirements (EARS syntax), architecture designs, and task breakdowns for `router-core`, `monster-lab-dashboard`, `playground-chat`, and `deployment`.
- **Steering (`.kiro/steering/`)**: Product vision, architectural standards, and structural guidelines.
- **Hooks (`.kiro/hooks/`)**: Automated quality checks and schema verification.
- **MCP Settings (`.kiro/settings/mcp.json`)**: Default multi-server orchestration configuration.
- **Agents (`.kiro/agents/`)**: Specialized autonomous workflow definitions.

---

## 📄 License

This repository is licensed under the [MIT License](./LICENSE).
