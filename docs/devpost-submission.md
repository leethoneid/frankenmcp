# FrankenMCP — Devpost Hackathon Submission Copy

> **Category**: Frankenstein (Kiroween 2026)  
> **Tagline**: Stitches heterogeneous MCP servers into a unified dynamic routing nervous center, trimming up to 840 tokens of schema overhead per turn (measured live; savings vary by query) with a live Monster Lab transparency dashboard.  
> **Live Demo**: [https://frankenmcp.vercel.app](https://frankenmcp.vercel.app)  
> **Open Source Repository**: [https://github.com/leethoneid/frankenmcp](https://github.com/leethoneid/frankenmcp)  
> **License**: MIT  

---

## 🧟 Inspiration & The Frankenstein Metaphor

FrankenMCP was born directly out of the spirit of the **Frankenstein category for Kiroween 2026**.

In Mary Shelley's classic, Victor Frankenstein pieced together disparate anatomy to breathe life into a new creation. In the modern agentic ecosystem, developers face a similar challenge: we want a single AI assistant to seamlessly orchestrate our entire workflow, yet every Model Context Protocol (MCP) server lives in complete isolation with incompatible domains, distinct schemas, and disparate runtime requirements.

FrankenMCP stitches three fundamentally isolated and heterogeneous MCP server domains — **documentation note management (`notes`)**, **project task tracking (`tasks`)**, and **mathematical calculation / unit conversion (`calculator`)** (totaling 3 distinct servers and 15 tool schemas) — into a single unified body under an intelligent dynamic routing nervous center (`mcp-dynamic-router`). To make this anatomical fusion visible to developers and judges, FrankenMCP provides the **Monster Lab Dashboard (`/lab`)**, an interactive control room visualizing per-turn tool routing, schema trimming, and context token savings in real time, alongside a zero-LLM deterministic **Playground Chat (`/playground`)** that guarantees instant, verifiable execution without external API keys.

---

## 💡 The Problem: The MCP Schema Bloat Tax

Every solo developer dreams of commanding their entire business stack — git repositories, issue trackers, databases, communication channels, and calculation engines — from a single AI chat interface. 

However, connecting multiple MCP servers introduces a massive, hidden overhead known as the **MCP Schema Bloat Tax**:
- When an AI agent connects to 3–5 real-world MCP servers (e.g., GitHub, PostgreSQL, Slack, Filesystem, Docker), the agent host routinely dumps the entire tool definitions of all connected servers into the system prompt before the user types a single word.
- In production agent workflows, this injects **30,000–60,000+ tokens** of verbose JSON schemas into every conversational turn — devouring **20% to 35% of the LLM context window** immediately (based on industry benchmark heuristic estimates from synthetic enterprise schemas).
- This bloat slows down prompt processing, inflates token costs, and distracts the model's attention mechanism with dozens of irrelevant parameters.

FrankenMCP solves this bottleneck: **the router performs the triage, not the calling**. It inspects user query intent before the model sees the tools, dynamically loads only the precise tool schema required, and aggressively trims away everything else. The model still retains complete agency over argument extraction and execution, but operates in a clean, focused context.

---

## 📊 Verified Live Metrics (Zero Synthetic Inflation)

In strict adherence to the *Truth-in-Advertising* and *No-Fake-Success* engineering principles, every metric displayed in FrankenMCP and reported here is computed dynamically from real execution passes rather than hard-coded placeholders:

- **3 Built-in Demo MCP Servers**: `notes` (5 tools), `tasks` (5 tools), and `calculator` (5 tools) — total 15 tools.
- **Aggressive Schema Trimming**: In the built-in 15-tool environment, each valid routing turn loads only **1 target tool** (and **0 tools** for out-of-bounds queries), trimming away **4 to 12 irrelevant tools** from the selected server set.
- **Measured Context Token Savings**: Real-time token savings are computed on the fly using character-level schema overhead (`Math.ceil(charCount / 4)`) of excluded tools:
  - `"Convert 100 meters to feet"`: Trims 4 tools, saving **232 tokens** (`calculator:convert_units` loaded).
  - `"47474乘87587等于多少"`: Trims 4 tools, saving **282 tokens** (`calculator:multiply` loaded).
  - `"What is 42 + 58?"`: Trims 4 tools, saving **284 tokens** (`calculator:add` loaded).
  - `"Show my tasks"`: Trims 4 tools, saving **298 tokens** (`tasks:list_tasks` loaded).
  - Out-of-bounds queries like `"What is the capital of France?"`: Hits the protective fallback wall, loading **0 tools** and trimming 12 tools, saving **840 tokens** with zero hallucinated tool calls.
  - Savings vary by query: `"Create a note titled Hello"` saves 220 tokens — below the old 232 floor, which is why the tagline no longer states a range.
- **Comprehensive Quality Fence**: The entire codebase passes **322 automated unit, integration, and property-based tests**, including 3 suites of 100 fast-check random runs each.

---

## 🚀 Dual-Mode Routing Architecture Truth

FrankenMCP is designed for friction-free hackathon evaluation while preserving enterprise-grade architecture fidelity through an adaptive dual-mode transport pipeline:

```
                  ┌────────────────────────┐
                  │    User / Playground   │
                  └───────────┬────────────┘
                              │
                    Query /api/playground/chat
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
    [Local / CLI Mode]             [Vercel Serverless Mode]
    • Child Process (stdio)        • In-Process Adapters
    • mcp-dynamic-router (TF-IDF)  • Fallback Regex / Keyword
    • Stdio MCP Subprocesses       • In-Memory Cores (<1ms)
    • Persistent Process State     • Client sessionStorage Merge
               │                             │
               └──────────────┬──────────────┘
                              ▼
                  ┌────────────────────────┐
                  │ Monster Lab Dashboard  │
                  │ (/lab live telemetry)  │
                  └────────────────────────┘
```

1. **Local / CLI Mode (`local`)**:
   - Spawns the external dynamic router child process (`mcp-dynamic-router`) over `stdio`, utilizing full-text TF-IDF vector indexing for tool semantic retrieval.
   - Communicates with independent MCP server child processes over standard I/O streams, matching real-world developer machine deployments.
2. **Vercel Serverless Mode (`vercel`, `VERCEL=1`)**:
   - To provide hackathon judges with a **zero-config, 60-second time-to-value experience** (no cloning, no API keys, no installation), the production deployment utilizes high-performance in-process adapters (`NotesCore`, `TasksCore`, `CalculatorCore`) paired with a deterministic keyword/regex routing engine (`src/lib/router/fallback.ts`).
   - Yields sub-millisecond initialization with 100% schema and behavioral contract parity with the local stdio servers.
   - Solves the serverless statelessness challenge across isolated Vercel Lambda invocations by combining `force-dynamic` API endpoints with browser `sessionStorage` (`frankenmcp_session_turns`) deduplication and client-side telemetry merging, ensuring real-time statistics in Monster Lab remain continuous and truthful.

---

## 🤖 How We Used Kiro (The 6 Engineering Dimensions)

Kiro was not merely an editor; Kiro served as the architectural brain of this project, driving every specification, verification harness, and orchestration workflow:

### 1. Specs (`.kiro/specs/`)
Every major capability (`router-core`, `monster-lab-dashboard`, `playground-chat`, and `deployment`) was formally specified inside `.kiro/specs/` using EARS (Easy Approach to Requirements Syntax). Requirements flowed systematically:
`requirements.md` (formal requirement IDs like `FR-1.1`, `NFR-3.2`) $\rightarrow$ `design.md` $\rightarrow$ `tasks.md` (with `acceptance-validation.md` for `monster-lab-dashboard` only).
These numbered requirements directly governed our error classification matrix, timeout boundaries, and deterministic token calculation formulas.

### 2. Steering (`.kiro/steering/`)
We anchored our engineering constraints within `.kiro/steering/`:
- `product.md`: Defined the Frankenstein product ethos and user value proposition.
- `tech.md`: Fixed the stack and standards: TypeScript strict mode, Next.js App Router, Node ≥20, Vitest with fast-check for the three PBT invariants (≥100 cases each), and fail-closed security defaults (no default API keys, header-only tokens, no wildcard CORS).
- `structure.md`: Enforced strict directory boundaries, physical isolation between demo fixtures and core logic, mandatory `[DEMO]` prefix labeling for synthetic data, and the absolute *Fail-Loud (No Fake Success)* mandate. For instance, when given unsupported units like `"100厘米等于多少英寸"`, the system immediately fails loudly with `Unable to extract arguments for convert_units` rather than silently forging plausible-looking fake numbers.

### 3. Hooks (`.kiro/hooks/`)
Hook definitions were authored and configured in `.kiro/hooks/`:
- `.kiro/hooks/schema-snapshot-on-mcp-change.json`: Configured to trigger when `.kiro/settings/mcp.json` changes. Its command only prints the expected tool count and does not write a snapshot file.
- `.kiro/hooks/typescript-typecheck-on-save.json`: Configured to run `tsc --noEmit` on `PostFileSave` for TypeScript files. Verified 2026-11-10: the trigger fires only when the Kiro Agent's tools write a file (confirmed via `ContextualHookInvoked` in Kiro Logs right after an Agent-created temp `.ts` file); manual Ctrl+S in the editor does not invoke it — the extension's `onDidSaveTextDocument` listeners handle UI state and spec validation only. Command-hook output is suppressed (`sendStdout:false`, `sendStderr:false`), so `tsc` errors are silent there; manual-save coverage is provided by a VS Code `tsc --noEmit --watch` background task (`.vscode/tasks.json`, auto-starts on folder open; VS Code asks for permission on first folder open before auto-starting it), with errors in the Problems panel.
- **Verification Status (Verified 2026-11-10)**: Kiro IDE validated the hook JSON formats and confirmed in startup logs that both hooks are read and registered on new session initialization (`hooks.reload.loaded read:2 / registered:2`; an earlier `read:3` count included a temporary `test-session-start.json` hook since removed). Runtime trigger execution was confirmed: an Agent-created temp `.ts` file produced `ContextualHookInvoked` in Kiro Logs immediately after the write. Reading the `kiro-agent` extension source (v1.1.787) confirmed `PostFileSave` is only reachable from the Agent tool executor (`firePostFileHooks`) — manual Ctrl+S never reaches the hooks.

### 4. MCP Settings (`.kiro/settings/mcp.json`)
The central nervous configuration for the project resides in `.kiro/settings/mcp.json`. It pre-configures the `notes`, `tasks`, and `calculator` MCP servers over `stdio`. This file serves a dual purpose: it allows the Kiro IDE to mount and debug the servers directly during development, while acting as the single source of truth for the application's runtime `MCPServerManager`.

### 5. Agents (`.kiro/agents/router-orchestrator.json`)
We put `router-orchestrator` to real work: it audited `src/lib/router/fallback.ts` against the 15 tools in `.kiro/settings/mcp.json`. The online keyword/regex fallback reaches 10 of 15 tools — all 5 calculator tools plus `create_note`, `list_notes`, `create_task`, `list_tasks`, and `update_task`. Five tools are never selected online — `read_note`, `update_note`, `delete_note`, `read_task`, `delete_task` — because they need an explicit ID that a query cannot supply. `update_task` works when the query names the ID, e.g. "Mark task 1 as done". One honest limitation surfaced: "Write a note about X" routes to `create_note`, but argument extraction only recognizes add/create, so it fails loudly instead of guessing; left as a documented limitation.

### 6. Property-Based Testing (`tests/pbt/`) & Bug Hunting Stories
Rather than relying solely on happy-path unit tests, we used `fast-check` to implement 3 comprehensive Property-Based Testing (PBT) suites (100 randomized test iterations each), directly tagged to their corresponding EARS requirement numbers:
1. **Trimming Completeness Invariant** (`trimming.test.ts` $\rightarrow$ `FR-2.3, NFR-3.2`): Proves that trimmed schemas never drop required input parameters for any selected tool.
2. **Determinism & Order-Invariance** (`determinism.test.ts` $\rightarrow$ `FR-2.6, NFR-3.3`): Proves that identical user queries and server sets always generate the exact same routing decision, completely invariant to the order in which servers were registered.
3. **Roundtrip Schema Fidelity** (`fidelity.test.ts` $\rightarrow$ `FR-2.7, NFR-3.4`): Proves that schema filtering never mutates original tool schemas in place.

**What the suites actually caught**:
During testing of compound multilingual queries, we discovered that queries like `"47474乘87587等于多少"` triggered a branch collision: the Chinese character `"等于"` (equals) was being greedily captured by the unit conversion parser, causing the router to misroute arithmetic multiplication to `convert_units` and fail. An integration regression test caught it (`Step 9 Regression: prioritizes arithmetic over unit conversion when queries contain 等于`, commit `850efe7`, `fix(router): check arithmetic branches before unit conversion`). The three PBT invariant suites held throughout development with 0 failures — they guard the invariants; this bug was caught by the integration suite.

---

## 📜 Prior Work & MIT License Disclosure

FrankenMCP strictly complies with Kiroween 2026 hackathon guidelines regarding pre-existing work and open-source licensing:
- **MIT License**: The FrankenMCP repository is licensed 100% under the standard, permissive MIT License.
- **Prior Work Disclosure**: The underlying core routing algorithm is derived from `leethoneid/mcp-dynamic-router`, an existing open-source repository created by the author prior to the hackathon (licensed under PolyForm Noncommercial in its own upstream repository).
- **New Work Verification**: In accordance with the New Project Rule, all application code, Next.js 16 App Router web interfaces, the Monster Lab telemetry dashboard, serverless adapters, the 3 standalone demo MCP servers (`notes`, `tasks`, `calculator`), the comprehensive test suites (322 tests), and all documentation were conceived, designed, and built completely from scratch during the hackathon period (October 30, 2026 to December 4, 2026).

---

## 🔮 What's Next for FrankenMCP

- **Hierarchical Clustering for 100+ Servers**: Extend the router engine with two-tier hierarchical clustering to support enterprise environments connecting hundreds of MCP servers simultaneously.
- **Streaming Telemetry over MCP SSE**: Provide a real-time Server-Sent Events (SSE) telemetry feed directly to external agent frameworks (LangChain, LlamaIndex, AutoGen).
- **Semantic Caching & Token Arbitrage**: Intelligently cache routing decisions across user sessions to reduce routing latency to under 0.1ms while maximizing LLM token efficiency.
