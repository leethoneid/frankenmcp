# FrankenMCP Router Architecture & Adapter Layer

This directory (`src/lib/router/`) provides the core routing adapter, schema trimming calculations, and statistics aggregation for **FrankenMCP** (Kiroween 2026 Hackathon entry).

---

## 1. Architectural Overview

```
                                      ┌──────────────────────────────────────────────┐
                                      │           mcp-dynamic-router                 │
                                      │  (external stdio dependency via npx)        │
                                      └──────────────────────┬───────────────────────┘
                                                             │ JSON-RPC (stdio)
                                                             ▼
┌──────────────────┐  routeIntent()   ┌──────────────────────────────────────────────┐
│                  ├─────────────────►│                adapter.ts                    │
│   Chat / Lab UI  │                  │  - Router child process lifecycle            │
│                  │◄─────────────────┤  - deriveRoutingDecision() & toolFilter      │
└────────┬─────────┘  RoutingDecision │  - LRU session cache (max 100 entries)       │
         │                            └──────────────────────┬───────────────────────┘
         │                                                   │
         ▼                                                   ▼
┌─────────────────────────────────────┐      ┌───────────────────────────────────────┐
│              stats.ts               │      │            server-manager.ts          │
│  - recordTurn() / computeTurnStats  │      │  - Multi-server process pool          │
│  - toolsLoaded & toolsTrimmed       │      │  - Stdio MCP client transports        │
│  - Token savings estimation         │      │  - Real tool invocation dispatch      │
└─────────────────────────────────────┘      └───────────────────────────────────────┘
```

### Core Principles
1. **Router As Untouched Dependency (Military Rule 2)**:
   The external router (`github:leethoneid/mcp-dynamic-router`) is consumed as a stdio subprocess. Its code, interface, and behavior are never modified within this repository; all adaptations and filtering logic reside cleanly in this adapter.
2. **Fail-Closed & Fail-Loud (Military Rule 1 & Rule 2.7)**:
   If an MCP server is unreachable, the router fails, or no tools match, the system throws explicit, typed errors. It **never** silently injects mock data or reports synthetic success.
3. **Truth-in-Advertising Metrics (Military Rule 2.5)**:
   All statistics (`toolsLoaded`, `toolsTrimmed`, `estimatedTokensSaved`) are computed from real runtime schemas and routing decisions.

---

## 2. Key Modules

| File | Purpose |
| :--- | :--- |
| [`types.ts`](./types.ts) | Canonical TypeScript definitions: `ServerManifest`, `ToolSchema`, `RoutingDecision`, `TurnStatistics`, `SessionStatistics`, and 8 fail-loud error classes. |
| [`adapter.ts`](./adapter.ts) | Manages router stdio child process, queries `mcp_search_tools`, groups results by server, derives tool inclusion filters, and maintains the LRU cache. |
| [`stats.ts`](./stats.ts) | Records turn metrics, calculates token savings (`Math.ceil(charCount / 4)`), aggregates session performance, and formats display strings. |

---

## 3. Tool Trimming Semantics

Trimming semantics are strictly bounded by `design.md`:

- **`toolsLoaded`**: Total count of tools loaded into the LLM context (i.e. `sum(filter.includedTools.length)`).
- **`toolsTrimmed`**: Total count of tools excluded from **selected servers only**:
  $$\text{toolsTrimmed} = \left(\sum_{s \in \text{selectedServers}} |\text{tools}(s)|\right) - \text{toolsLoaded}$$
  *Tools belonging to non-selected servers are never counted in `toolsTrimmed`.*
- **`estimatedTokensSaved`**: Estimated tokens saved by omitting excluded schemas from the selected servers:
  $$\text{tokensSaved} = \left\lceil \frac{\sum_{t \in \text{trimmedTools}} \text{len}(\text{JSON}(t))}{4} \right\rceil$$

---

## 4. Code Examples

### 4.1 Initializing Server Pool & Auto-Registration
```typescript
import path from 'path';
import { MCPServerManager } from '@/lib/mcp/server-manager';

// 1. Initialize manager singleton
const manager = MCPServerManager.getInstance();

// 2. Load and register servers from .kiro/settings/mcp.json
const configPath = path.resolve(process.cwd(), '.kiro/settings/mcp.json');
manager.loadAndRegisterConfig(configPath);

// 3. Connect all enabled servers in parallel
await manager.connectAll();

// 4. Retrieve available server manifests with cached schemas
const manifests = manager.getServerManifests();
console.log(`Connected ${manifests.length} servers with ${manifests.reduce((sum, m) => sum + m.tools.length, 0)} total tools.`);
```

### 4.2 Routing a User Intent
```typescript
import { routeIntent } from '@/lib/router/adapter';

// Route natural language intent to relevant servers & tools
const decision = await routeIntent('Add a note about the meeting', manifests);

console.log('Selected Servers:', decision.selectedServers); // ['notes']
console.log('Tool Filter:', decision.toolFilter);           // [{ serverID: 'notes', includedTools: ['create_note'] }]
console.log('Reasoning:', decision.reasoning);
```

### 4.3 Invoking the Selected Tool
```typescript
// Dispatch tool execution to the connected MCP server child process
const response = await manager.invokeToolCall('notes', 'create_note', {
  title: 'Project Standup',
  content: 'Review Kiroween router-core deliverables',
});

console.log('Tool Result:', response);
```

### 4.4 Accessing Per-Turn & Session Statistics
```typescript
import { getSessionStats } from '@/lib/router/stats';

const stats = getSessionStats();
console.log(`Total Turns: ${stats.turns.length}`);
console.log(`Total Tools Loaded: ${stats.totalToolsLoaded}`);
console.log(`Total Tools Trimmed: ${stats.totalToolsTrimmed}`);
console.log(`Estimated Tokens Saved: ${stats.totalTokensSaved}`);
console.log(`Average Routing Time: ${stats.averageRoutingTimeMs} ms`);
```

---

## 5. Fail-Loud Error Hierarchy

Every error thrown in this package extends `Error` directly and carries diagnostic context:

- `RouterUnavailableError`: The `mcp-dynamic-router` child process failed to spawn or exited abnormally.
- `RoutingTimeoutError`: Router search took longer than 2000ms.
- `InvalidRoutingDecisionError`: Router stdout returned malformed or unparseable JSON-RPC output.
- `NoRelevantToolsError`: Router search returned zero matching tools for the query.
- `ServerConnectionError`: An MCP server failed to connect after 3 exponential backoff retries.
- `ToolInvocationError`: A tool call failed on the MCP server child process.
- `MCPConfigParseError`: `.kiro/settings/mcp.json` is missing or contains invalid schema fields.
- `AllServersUnavailableError`: Zero servers could be reached or all registered servers are disabled.
