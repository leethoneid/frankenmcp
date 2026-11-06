# Router Core — Task Breakdown

> **Feature**: Dynamic MCP router with schema trimming and per-turn statistics  
> **Status**: Ready for implementation  
> **Author**: Kiro  
> **Date**: 2026-11-05  
> **Requirements**: [requirements.md](./requirements.md)  
> **Design**: [design.md](./design.md)

---

## Overview

This document breaks down the router-core feature into discrete, testable tasks. Each task includes:
- **Description**: What needs to be built
- **Requirements Traceability**: Which requirements it satisfies
- **Acceptance Criteria**: How to verify completion
- **Dependencies**: Which tasks must be completed first
- **Estimated Effort**: T-shirt sizing (XS/S/M/L/XL)

---

## Phase 1: Foundation (No Dependencies)

### Task 1.1: Project Structure Setup

**Description**: Create the directory structure for router-core components.

**Acceptance Criteria**:
- [ ] Directory `src/lib/router/` exists with placeholder files: `adapter.ts`, `stats.ts`, `types.ts`
- [ ] Directory `src/lib/mcp/` exists with placeholder files: `server-manager.ts`, `client.ts`
- [ ] Directory `src/mcp-servers/` exists with subdirectories: `notes/`, `tasks/`, `calculator/`
- [ ] Directory `tests/unit/`, `tests/integration/`, `tests/pbt/` exist
- [ ] File `.kiro/settings/mcp.json` exists with empty `mcpServers` object

**Requirements**: N/A (infrastructure)

**Dependencies**: None

**Effort**: XS (15 min)

---

### Task 1.2: TypeScript Type Definitions

**Description**: Define all TypeScript interfaces and types in `src/lib/router/types.ts`.

**Acceptance Criteria**:
- [ ] `RoutingDecision` interface defined (selectedServers, toolFilter, reasoning)
- [ ] `SearchResult` interface defined (tool, server, score, description)
- [ ] `ServerManifest` interface defined (id, name, transport, tools, status)
- [ ] `ToolSchema` interface defined (name, description, inputSchema, outputSchema)
- [ ] `JSONSchema` interface defined (type, properties, required)
- [ ] `ServerConfig` interface defined (id, name, transport, command, args, endpoint, headers)
- [ ] `ServerStatus` type defined ('connected' | 'disconnected' | 'error' | 'starting')
- [ ] `TurnStatistics` interface defined with correct `toolsLoaded` semantics (loaded into context, not total from servers)
- [ ] `SessionStatistics` interface defined
- [ ] All custom error types exported (RouterUnavailableError, RoutingTimeoutError, InvalidRoutingDecisionError, NoRelevantToolsError, ServerConnectionError, ToolInvocationError, MCPConfigParseError, AllServersUnavailableError)

**Requirements**: C-2 (adapter code structure)

**Dependencies**: Task 1.1

**Effort**: S (30 min)

---

## Phase 2: MCP Infrastructure

### Task 2.1: MCP Client Wrapper

**Description**: Implement `src/lib/mcp/client.ts` to wrap `@modelcontextprotocol/sdk` client.

**Acceptance Criteria**:
- [ ] `MCPClient` class instantiates with `ServerConfig`
- [ ] `connect()` method establishes stdio/SSE/HTTP connection
- [ ] `listTools()` method returns array of `ToolSchema`
- [ ] `callTool(name, args)` method invokes tool and returns result
- [ ] `disconnect()` method closes connection gracefully
- [ ] `onNotification(handler)` method registers notification callback
- [ ] Error handling: connection failures throw `ServerConnectionError`
- [ ] Error handling: tool call failures throw `ToolInvocationError`
- [ ] Unit tests: connection lifecycle, tool listing, tool invocation, error cases

**Requirements**: FR-1.6 (retrieve tool schemas), NFR-4.1 (secure transport)

**Dependencies**: Task 1.2

**Effort**: M (2 hours)

---

### Task 2.2: MCP Server Manager

**Description**: Implement `src/lib/mcp/server-manager.ts` to orchestrate multiple MCP servers.

**Acceptance Criteria**:
- [ ] `MCPServerManager` class singleton pattern
- [ ] `registerServer(config)` method adds server to pool
- [ ] `unregisterServer(id)` method removes server and terminates process
- [ ] `connectAll()` method spawns all registered servers in parallel
- [ ] `invokeToolCall(serverID, toolName, args)` method dispatches to correct server
- [ ] `getServerStatus(id)` method returns current status
- [ ] `getServerManifests()` method returns array of manifests with cached schemas
- [ ] Health check loop: ping each server every 30s, update status
- [ ] Reconnection logic: retry failed connections 3x with exponential backoff
- [ ] Graceful shutdown: terminate all child processes on `process.exit`
- [ ] Error handling: server spawn failure marks as `error`, logs to console
- [ ] Error handling: all servers fail → throw `AllServersUnavailableError`
- [ ] Unit tests: registration, connection, health checks, reconnection, shutdown
- [ ] Integration test: spawn real demo server subprocess, verify handshake

**Requirements**: FR-1.1 to FR-1.7 (server registration and lifecycle), NFR-2.1 (handle unavailable servers)

**Dependencies**: Task 2.1

**Effort**: L (4 hours)

---

### Task 2.3: MCP Config Loader

**Description**: Load server configurations from `.kiro/settings/mcp.json` at startup.

**Acceptance Criteria**:
- [ ] Function `loadMCPConfig(path)` reads and parses JSON file
- [ ] Validation: each server has required fields (id, name, transport, and transport-specific fields)
- [ ] Validation: transport type is one of 'stdio', 'sse', 'http'
- [ ] Error handling: file not found → throw `MCPConfigParseError` with path
- [ ] Error handling: invalid JSON → throw `MCPConfigParseError` with parse error
- [ ] Error handling: validation failure → throw `MCPConfigParseError` with field name
- [ ] Integration with `MCPServerManager`: auto-register servers from config
- [ ] Unit tests: valid config, missing file, malformed JSON, invalid schema

**Requirements**: FR-4.1 (pre-configure demo servers), C-4 (config location)

**Dependencies**: Task 2.2

**Effort**: S (1 hour)

---

## Phase 3: Router Adapter

### Task 3.1: Router Process Management

**Description**: Implement router subprocess spawning and lifecycle in `src/lib/router/adapter.ts`.

**Acceptance Criteria**:
- [ ] `startRouterProcess()` function spawns `npx -y github:leethoneid/mcp-dynamic-router serve` as child process
- [ ] Process stdout/stderr captured and logged for debugging
- [ ] Process exit code monitored; non-zero exit throws `RouterUnavailableError`
- [ ] MCP client connected to router via stdio
- [ ] Graceful shutdown: terminate router process on app exit
- [ ] Error handling: spawn failure throws `RouterUnavailableError` with cause
- [ ] Unit tests: successful spawn, spawn failure, graceful shutdown
- [ ] Integration test: spawn real router, verify MCP handshake completes

**Requirements**: FR-2.1 (invoke router), C-1 (router as dependency)

**Dependencies**: Task 2.1

**Effort**: M (2 hours)

---

### Task 3.2: PBT Strategy Decision — Test Wiring

**Description**: Decide and implement strategy for wiring PBT tests to real router with generated schemas.

**Problem**: PBT tests generate random schemas, but real router subprocess doesn't know about generated schemas registered in mock manager. This causes:
- PBT-1 to assert on non-existent tools (router won't find them)
- PBT-2 to pass vacuously (empty routing decisions)

**Decision Required**: Choose one strategy and implement:

**Option A: Spawn Ephemeral Test Servers**
- For each PBT run, spawn temporary MCP servers that expose generated schemas
- Pass these servers to router via manifest registration
- Pros: Tests real router end-to-end with full protocol
- Cons: Slower (subprocess overhead per test case), complex teardown

**Option B: Inject Stub Search Function**
- Add optional `searchFunction` parameter to `routeIntent()` for testing
- In tests, inject function that returns pre-computed `SearchResult[]` based on generated schemas
- Router subprocess not used in PBT; only integration tests use real router
- Pros: Fast, deterministic, no subprocess management
- Cons: Doesn't test real router integration (but integration tests do)

**Acceptance Criteria**:
- [ ] Decision documented in code comment at top of `tests/pbt/` files
- [ ] If Option A: helper function `spawnEphemeralServer(schemas)` implemented and tested
- [ ] If Option B: `routeIntent(intent, manifests, options?: { searchFn?: ... })` signature added
- [ ] Whichever option chosen, sample PBT runs successfully with 10 generated cases

**Requirements**: NFR-3.2, NFR-3.3, NFR-3.4 (PBT testing strategy)

**Dependencies**: Task 3.1

**Effort**: M (2 hours)

---

### Task 3.3: Router Search Integration

**Description**: Implement `searchTools()` and `deriveRoutingDecision()` functions in `src/lib/router/adapter.ts`.

**Acceptance Criteria**:
- [ ] `searchTools(query)` function calls router's `mcp_search_tools` tool via MCP client
- [ ] Returns array of `SearchResult` objects (tool, server, score, description)
- [ ] `deriveRoutingDecision(searchResults, allServers)` function groups results by server
- [ ] Derives `selectedServers` as unique server IDs from results
- [ ] Derives `toolFilter` array with `serverID` and `includedTools[]` per server
- [ ] Optional `reasoning` field populated with top search score
- [ ] Error handling: empty search results → throw `NoRelevantToolsError`
- [ ] Error handling: router timeout (>2s) → throw `RoutingTimeoutError`
- [ ] Error handling: malformed router response → throw `InvalidRoutingDecisionError`
- [ ] Unit tests: valid search results, empty results, timeout, malformed response
- [ ] Integration test: route real intent ("add a note"), verify decision includes notes server

**Requirements**: FR-2.1 to FR-2.4 (routing and trimming), NFR-1.1 (routing latency <2s)

**Dependencies**: Task 3.1, Task 3.2

**Effort**: M (2.5 hours)

---

### Task 3.4: Main Routing Function

**Description**: Implement `routeIntent()` function as main entry point for routing.

**Acceptance Criteria**:
- [ ] `routeIntent(intent, availableServers, options?)` function signature
- [ ] Calls `searchTools(intent)` to get search results from router
- [ ] Calls `deriveRoutingDecision(results, availableServers)` to build decision
- [ ] Records routing statistics via `recordTurn()` (Task 4.1)
- [ ] Returns `RoutingDecision` object
- [ ] Optional cache bypass via `options.bypassCache` (default false)
- [ ] Optional stub search function injection via `options.searchFn` (for testing, per Task 3.2 decision)
- [ ] Cache lookup: check if `hash(intent + serverIDs)` exists in cache
- [ ] Cache store: save decision to cache (session-scoped, LRU, max 100 entries)
- [ ] Cache invalidation: clear cache when server manifests change
- [ ] Unit tests: cache hit, cache miss, cache bypass, cache invalidation
- [ ] Integration test: full routing flow end-to-end with real router and demo servers

**Requirements**: FR-2.5 (no servers selected), FR-2.6 (determinism)

**Dependencies**: Task 3.3, Task 2.2

**Effort**: M (2 hours)

---

## Phase 4: Statistics Tracking

### Task 4.1: Statistics Calculation

**Description**: Implement `src/lib/router/stats.ts` for per-turn and session-wide statistics.

**Acceptance Criteria**:
- [ ] `recordTurn(stats)` function stores `TurnStatistics` in memory array
- [ ] `getSessionStats()` function returns aggregated `SessionStatistics`
- [ ] `estimateTokenSavings(trimmedSchemas)` function calculates `Math.ceil(charCount / 4)`
- [ ] `toolsLoaded` semantics enforced: count of tools included in routing decision (loaded into context)
- [ ] `toolsTrimmed` calculated as: `(tools in selected servers) - toolsLoaded`
  - Example: notes server selected (5 tools total), router chooses 2 tools → toolsTrimmed = 3
  - NOT calculated as `(all 15 tools from all servers) - toolsLoaded`
  - "Trimmed" means excluded by router from selected servers, not excluded by server selection
- [ ] `estimatedTokensSaved` calculated from character count of excluded tool schemas (from selected servers only)
- [ ] Session aggregation: sum all turns' `totalToolsLoaded`, `totalToolsTrimmed`, `totalTokensSaved`
- [ ] Session aggregation: calculate `averageRoutingTimeMs`
- [ ] Statistics never show placeholder/hard-coded values; if calculation fails, return `null` or throw error
- [ ] Unit tests: single turn recording, multi-turn aggregation, token estimation formula, verify trimmed calculation formula
- [ ] Integration test: route 3 intents, verify session stats match expected sums and trimmed formula

**Requirements**: FR-3.1 to FR-3.6 (statistics tracking), NFR-3.1 (test real behavior)

**Dependencies**: Task 1.2

**Effort**: S (1.5 hours)

---

### Task 4.2: Statistics Display Fail-Safe

**Description**: Ensure statistics display gracefully handles calculation failures.

**Acceptance Criteria**:
- [ ] When `getSessionStats()` throws error, UI displays "Stats unavailable" (not "0" or placeholders)
- [ ] When `estimateTokenSavings()` returns `null` (e.g., schema fetch failed), display "Token savings unavailable"
- [ ] All statistics display components check for `null`/`undefined` before rendering numbers
- [ ] Error logged to console with diagnostic info when statistics calculation fails
- [ ] Unit tests: verify UI component renders "Stats unavailable" when calculation throws

**Requirements**: FR-3.4 (no hard-coded numbers), 2.7 from AGENTS.md (fail loud)

**Dependencies**: Task 4.1

**Effort**: S (1 hour)

---

## Phase 5: Demo MCP Servers

### Task 5.1: Notes Server

**Description**: Implement `src/mcp-servers/notes/index.mjs` as stdio MCP server.

**Acceptance Criteria**:
- [ ] File is pure ES module (`.mjs`), no TypeScript compilation required
- [ ] Implements MCP stdio protocol using `@modelcontextprotocol/sdk`
- [ ] Tools exposed:
  - `create_note(title: string, content: string)` → `{ id: string }`
  - `read_note(id: string)` → `{ id: string, title: string, content: string, created: number }`
  - `update_note(id: string, title?: string, content?: string)` → `{ id: string }`
  - `delete_note(id: string)` → `{ success: boolean }`
  - `list_notes()` → `{ notes: Array<{ id: string, title: string }> }`
- [ ] Storage: in-memory Map, optionally persist to `notes.json` in temp directory
- [ ] Fixtures: 3 pre-populated demo notes with `[DEMO]` marker in content
- [ ] Input validation: missing required parameters return error
- [ ] Error handling: invalid ID returns error (not silent failure)
- [ ] Manual test: run `node src/mcp-servers/notes/index.mjs` and verify MCP handshake via stdin/stdout
- [ ] Integration test: spawn server, connect via `MCPClient`, call each tool, verify responses

**Requirements**: FR-4.3 (notes server tools), FR-4.7 (fail loud), 2.7 from AGENTS.md (demo data labeled)

**Dependencies**: Task 2.1

**Effort**: M (2.5 hours)

---

### Task 5.2: Tasks Server

**Description**: Implement `src/mcp-servers/tasks/index.mjs` as stdio MCP server.

**Acceptance Criteria**:
- [ ] File is pure ES module (`.mjs`), no TypeScript compilation required
- [ ] Implements MCP stdio protocol using `@modelcontextprotocol/sdk`
- [ ] Tools exposed:
  - `create_task(title: string, priority?: 'low'|'medium'|'high')` → `{ id: string }`
  - `read_task(id: string)` → `{ id: string, title: string, priority: string, completed: boolean }`
  - `update_task(id: string, title?: string, priority?: string, completed?: boolean)` → `{ id: string }`
  - `delete_task(id: string)` → `{ success: boolean }`
  - `list_tasks(filter?: { completed?: boolean })` → `{ tasks: Array<...> }`
- [ ] Storage: in-memory Map, optionally persist to `tasks.json`
- [ ] Fixtures: 5 pre-populated demo tasks (mix of completed/incomplete) with `[DEMO]` marker
- [ ] Input validation and error handling per notes server pattern
- [ ] Manual and integration tests per notes server pattern

**Requirements**: FR-4.4 (tasks server tools)

**Dependencies**: Task 5.1

**Effort**: M (2.5 hours)

---

### Task 5.3: Calculator Server

**Description**: Implement `src/mcp-servers/calculator/index.mjs` as stdio MCP server.

**Acceptance Criteria**:
- [ ] File is pure ES module (`.mjs`), no TypeScript compilation required
- [ ] Implements MCP stdio protocol using `@modelcontextprotocol/sdk`
- [ ] Tools exposed:
  - `add(a: number, b: number)` → `{ result: number }`
  - `subtract(a: number, b: number)` → `{ result: number }`
  - `multiply(a: number, b: number)` → `{ result: number }`
  - `divide(a: number, b: number)` → `{ result: number }` (error if b=0)
  - `convert_units(value: number, from: string, to: string)` → `{ result: number }`
- [ ] Unit conversions supported: length (m, ft, in), weight (kg, lb), temperature (C, F)
- [ ] Storage: none (stateless)
- [ ] Input validation: non-numeric inputs return error
- [ ] Error handling: divide by zero returns error with clear message
- [ ] Manual and integration tests per notes server pattern

**Requirements**: FR-4.5 (calculator server tools)

**Dependencies**: Task 5.1

**Effort**: S (1.5 hours)

---

### Task 5.4: Demo Server Pre-Configuration

**Description**: Configure demo servers in `.kiro/settings/mcp.json` for auto-start.

**Acceptance Criteria**:
- [ ] File `.kiro/settings/mcp.json` contains entries for notes, tasks, calculator
- [ ] Each entry specifies: `command: "node"`, `args: ["src/mcp-servers/<name>/index.mjs"]`, `disabled: false`
- [ ] MCPServerManager reads config at startup and spawns all three servers
- [ ] Startup test: run app, verify all three servers connect and report `status: 'connected'`
- [ ] Startup test: verify `getServerManifests()` returns 15 total tools (5 per server)
- [ ] Error handling test: rename a server file, restart, verify `MCPConfigParseError` or `ServerConnectionError` thrown

**Requirements**: FR-4.1 (pre-configure demo servers), FR-4.6 (auto-register), AC-4 (demo servers functional on first start)

**Dependencies**: Task 5.1, Task 5.2, Task 5.3, Task 2.3

**Effort**: S (1 hour)

---

## Phase 6: Property-Based Testing

### Task 6.1: PBT Invariant 1 — Required Parameter Preservation

**Description**: Implement property-based test for schema trimming invariant.

**Acceptance Criteria**:
- [ ] Test file `tests/pbt/trimming.test.ts` created
- [ ] Custom generator `toolSchemaGen` defined (valid MCP `ToolSchema` format with `inputSchema.required[]`)
- [ ] Test wiring strategy from Task 3.2 implemented (ephemeral servers OR stub search function)
- [ ] Property: for all generated schemas, routing decision includes tools → all `required[]` parameters preserved in loaded schemas
- [ ] Test runs ≥100 iterations via `{ numRuns: 100 }`
- [ ] Test annotated with comment: `// Validates FR-2.3, NFR-3.2`
- [ ] Test passes consistently (no flakes)
- [ ] If test fails, shrinks to minimal failing case

**Requirements**: FR-2.3 (preserve required params), NFR-3.2 (PBT ≥100 cases)

**Dependencies**: Task 3.4, Task 3.2

**Effort**: M (2.5 hours)

---

### Task 6.2: PBT Invariant 2 — Routing Determinism

**Description**: Implement property-based test for routing consistency.

**Acceptance Criteria**:
- [ ] Test file `tests/pbt/determinism.test.ts` created
- [ ] Generator: random intent strings + random sets of tool schemas
- [ ] Property: same intent + same server set → two calls to `routeIntentNoCache()` return identical `selectedServers` and `toolFilter`
- [ ] Helper `routeIntentNoCache()` implemented to bypass cache (uses `options.bypassCache: true`)
- [ ] Test annotated with comment: `// Validates FR-2.6, NFR-3.3`
- [ ] Test runs ≥100 iterations
- [ ] Test passes consistently

**Requirements**: FR-2.6 (determinism), NFR-3.3 (PBT ≥100 cases)

**Dependencies**: Task 3.4, Task 3.2

**Effort**: M (2.5 hours)

---

### Task 6.3: PBT Invariant 3 — Schema Round-Trip Fidelity

**Description**: Implement property-based test for schema immutability.

**Acceptance Criteria**:
- [ ] Test file `tests/pbt/fidelity.test.ts` created
- [ ] Generator: random valid tool schemas
- [ ] Property: register schemas → route intent (uses cached schemas) → force refresh from servers → reloaded schemas match originals
- [ ] Deep clone used to compare original vs. reloaded schemas (detects mutation)
- [ ] Test annotated with comment: `// Validates FR-2.7, NFR-3.4`
- [ ] Test runs ≥100 iterations
- [ ] Test passes consistently

**Requirements**: FR-2.7 (round-trip fidelity), NFR-3.4 (PBT ≥100 cases)

**Dependencies**: Task 3.4, Task 2.2

**Effort**: M (2 hours)

---

## Phase 7: Integration & End-to-End Testing

### Task 7.1: Full Routing Flow Integration Test

**Description**: Test complete routing flow from user intent to tool invocation.

**Acceptance Criteria**:
- [ ] Test file `tests/integration/routing-e2e.test.ts` created
- [ ] Test spawns all three demo servers as real subprocesses
- [ ] Test spawns router as real subprocess
- [ ] Test intent: "Add a note about the meeting" → verify router selects notes server + `create_note` tool
- [ ] Test intent: "Show my tasks" → verify router selects tasks server + `list_tasks` tool
- [ ] Test intent: "Calculate 15 + 27" → verify router selects calculator server + `add` tool
- [ ] Test verifies `toolsLoaded` and `toolsTrimmed` statistics are non-zero and accurate
- [ ] Test verifies `estimatedTokensSaved` > 0
- [ ] Test teardown: terminate all subprocesses, verify clean shutdown
- [ ] Test passes in CI environment (no leftover processes)

**Requirements**: AC-2 (route intent and get response), NFR-1.1 (latency <2s), NFR-3.1 (test real behavior)

**Dependencies**: Task 3.4, Task 4.1, Task 5.4

**Effort**: L (3 hours)

---

### Task 7.2: Error Handling Integration Tests

**Description**: Test fail-loud behavior for error scenarios.

**Acceptance Criteria**:
- [ ] Test file `tests/integration/error-handling.test.ts` created
- [ ] Test: router process spawn failure → verify `RouterUnavailableError` thrown, no silent fallback
- [ ] Test: all demo servers disabled in config → verify `AllServersUnavailableError` thrown at startup
- [ ] Test: malformed `.kiro/settings/mcp.json` → verify `MCPConfigParseError` thrown at startup
- [ ] Test: disconnect server mid-session → verify server marked `disconnected`, excluded from routing
- [ ] Test: router returns empty search results → verify `NoRelevantToolsError` thrown
- [ ] Test: tool call to disconnected server → verify `ToolInvocationError` thrown with server ID
- [ ] All tests verify no mock data silently substituted

**Requirements**: FR-1.7 (fail on connection), FR-2.5 (no servers selected), NFR-2.1 (handle unavailable), 2.7 from AGENTS.md (fail loud)

**Dependencies**: Task 3.4, Task 2.2, Task 2.3

**Effort**: M (2.5 hours)

---

### Task 7.3: Acceptance Criteria Validation

**Description**: Verify all acceptance criteria from requirements.md are met.

**Acceptance Criteria**:
- [ ] AC-1: User can add stdio MCP server → manual test or UI test (if UI implemented)
- [ ] AC-2: User can submit intent and get response → validated by Task 7.1
- [ ] AC-3: User can view routing statistics → validated by Task 7.1
- [ ] AC-4: Demo servers pre-configured and functional → validated by Task 5.4
- [ ] AC-5: All PBT tests pass with ≥100 cases → validated by Tasks 6.1, 6.2, 6.3
- [ ] AC-6: Connection failures display errors, no mock fallback → validated by Task 7.2
- [ ] Checklist document created summarizing validation results

**Requirements**: All AC-* from requirements.md

**Dependencies**: Task 7.1, Task 7.2, Task 6.1, Task 6.2, Task 6.3

**Effort**: S (1 hour)

---

## Phase 8: Documentation & Polish

### Task 8.1: API Documentation

**Description**: Document public APIs for router-core components.

**Acceptance Criteria**:
- [ ] JSDoc comments added to all exported functions and classes
- [ ] `README.md` in `src/lib/router/` explains adapter architecture
- [ ] `README.md` in `src/mcp-servers/` explains how to add new demo servers
- [ ] Code examples included for common use cases (register server, route intent, get stats)

**Requirements**: Military Rule 3 (exhaustive docs)

**Dependencies**: All implementation tasks

**Effort**: S (1.5 hours)

---

### Task 8.2: Performance Validation

**Description**: Verify NFR-1 performance targets are met.

**Acceptance Criteria**:
- [ ] Benchmark test: route 10 intents with 10 registered servers → average routing time <2s (NFR-1.1)
- [ ] Benchmark test: retrieve schemas from each demo server → each <1s (NFR-1.2)
- [ ] Benchmark results logged to console (not hard-coded in docs)
- [ ] If targets not met, document actual performance and file issue for optimization

**Requirements**: NFR-1.1, NFR-1.2 (performance targets)

**Dependencies**: Task 7.1

**Effort**: S (1 hour)

---

## Summary

**Total Tasks**: 23  
**Total Estimated Effort**: ~40 hours  
**Critical Path**: 1.1 → 1.2 → 2.1 → 2.2 → 2.3 → 3.1 → 3.2 → 3.3 → 3.4 → 5.4 → 7.1 → 7.3

**Parallelization Opportunities**:
- Phase 2 (Tasks 2.1, 2.2, 2.3) can partially overlap with Phase 4 (Task 4.1)
- Phase 5 (Tasks 5.1, 5.2, 5.3) can be done in parallel once 2.1 is complete
- Phase 6 (Tasks 6.1, 6.2, 6.3) can be done in parallel once 3.4 is complete

**Risk Areas**:
1. **Task 3.2 (PBT wiring strategy)**: Decision required before PBT implementation; wrong choice = significant rework
2. **Task 7.1 (E2E test)**: Subprocess management in tests can be flaky; robust teardown critical
3. **Vercel deployment**: Subprocess dependency not addressed in this spec (deferred to `deployment` spec)

---

## Traceability Matrix

| Task | Requirements | PBT Invariant | Acceptance Criteria |
|------|--------------|---------------|---------------------|
| 1.1 | C-2, C-3 | — | — |
| 1.2 | C-2 | — | — |
| 2.1 | FR-1.6, NFR-4.1 | — | — |
| 2.2 | FR-1.1–FR-1.7, NFR-2.1 | — | — |
| 2.3 | FR-4.1, C-4 | — | — |
| 3.1 | FR-2.1, C-1 | — | — |
| 3.2 | NFR-3.2, NFR-3.3, NFR-3.4 | All | — |
| 3.3 | FR-2.1–FR-2.4, NFR-1.1 | — | — |
| 3.4 | FR-2.5, FR-2.6 | PBT-2 | AC-2 |
| 4.1 | FR-3.1–FR-3.6, NFR-3.1 | — | AC-3 |
| 4.2 | FR-3.4, 2.7 (AGENTS.md) | — | — |
| 5.1 | FR-4.3, FR-4.7, 2.7 (AGENTS.md) | — | — |
| 5.2 | FR-4.4 | — | — |
| 5.3 | FR-4.5 | — | — |
| 5.4 | FR-4.1, FR-4.6 | — | AC-4 |
| 6.1 | FR-2.3, NFR-3.2 | PBT-1 | AC-5 |
| 6.2 | FR-2.6, NFR-3.3 | PBT-2 | AC-5 |
| 6.3 | FR-2.7, NFR-3.4 | PBT-3 | AC-5 |
| 7.1 | AC-2, NFR-1.1, NFR-3.1 | — | AC-2, AC-3 |
| 7.2 | FR-1.7, FR-2.5, NFR-2.1, 2.7 (AGENTS.md) | — | AC-6 |
| 7.3 | All AC-* | — | All AC-* |
| 8.1 | Military Rule 3 | — | — |
| 8.2 | NFR-1.1, NFR-1.2 | — | — |

---

## Changes from Previous Versions

_Initial version._
