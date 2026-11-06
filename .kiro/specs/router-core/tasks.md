# Router Core â€?Task Breakdown

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
- [x] Directory `src/lib/router/` exists with placeholder files: `adapter.ts`, `stats.ts`, `types.ts`
- [x] Directory `src/lib/mcp/` exists with placeholder files: `server-manager.ts`, `client.ts`
- [x] Directory `src/mcp-servers/` exists with subdirectories: `notes/`, `tasks/`, `calculator/`
- [x] Directory `tests/unit/`, `tests/integration/`, `tests/pbt/` exist
- [x] File `.kiro/settings/mcp.json` exists with empty `mcpServers` object

**Requirements**: N/A (infrastructure)

**Dependencies**: None

**Effort**: XS (15 min)

---

### Task 1.2: TypeScript Type Definitions

**Description**: Define all TypeScript interfaces and types in `src/lib/router/types.ts`.

**Acceptance Criteria**:
- [x] `RoutingDecision` interface defined (selectedServers, toolFilter, reasoning)
- [x] `SearchResult` interface defined (tool, server, score, description)
- [x] `ServerManifest` interface defined (id, name, transport, tools, status)
- [x] `ToolSchema` interface defined (name, description, inputSchema, outputSchema)
- [x] `JSONSchema` interface defined (type, properties, required)
- [x] `ServerConfig` interface defined (id, name, transport, command, args, endpoint, headers)
- [x] `ServerStatus` type defined ('connected' | 'disconnected' | 'error' | 'starting')
- [x] `TurnStatistics` interface defined with correct `toolsLoaded` semantics (loaded into context, not total from servers)
- [x] `SessionStatistics` interface defined
- [x] All custom error types exported (RouterUnavailableError, RoutingTimeoutError, InvalidRoutingDecisionError, NoRelevantToolsError, ServerConnectionError, ToolInvocationError, MCPConfigParseError, AllServersUnavailableError)

**Requirements**: C-2 (adapter code structure)

**Dependencies**: Task 1.1

**Effort**: S (30 min)

---

## Phase 2: MCP Infrastructure

### Task 2.1: MCP Client Wrapper

**Description**: Implement `src/lib/mcp/client.ts` to wrap `@modelcontextprotocol/sdk` client.

**Acceptance Criteria**:
- [x] `MCPClient` class instantiates with `ServerConfig`
- [x] `connect()` method establishes stdio/SSE/HTTP connection
- [x] `listTools()` method returns array of `ToolSchema`
- [x] `callTool(name, args)` method invokes tool and returns result
- [x] `disconnect()` method closes connection gracefully
- [x] `onNotification(handler)` method registers notification callback
- [x] Error handling: connection failures throw `ServerConnectionError`
- [x] Error handling: tool call failures throw `ToolInvocationError`
- [x] Unit tests: connection lifecycle, tool listing, tool invocation, error cases

**Requirements**: FR-1.6 (retrieve tool schemas), NFR-4.1 (secure transport)

**Dependencies**: Task 1.2

**Effort**: M (2 hours)

---

### Task 2.2: MCP Server Manager

**Description**: Implement `src/lib/mcp/server-manager.ts` to orchestrate multiple MCP servers.

**Acceptance Criteria**:
- [x] `MCPServerManager` class singleton pattern
- [x] `registerServer(config)` method adds server to pool
- [x] `unregisterServer(id)` method removes server and terminates process
- [x] `connectAll()` method spawns all registered servers in parallel
- [x] `invokeToolCall(serverID, toolName, args)` method dispatches to correct server
- [x] `getServerStatus(id)` method returns current status
- [x] `getServerManifests()` method returns array of manifests with cached schemas
- [x] Health check loop: ping each server every 30s, update status
- [x] Reconnection logic: retry failed connections 3x with exponential backoff
- [x] Graceful shutdown: terminate all child processes on `process.exit`
- [x] Error handling: server spawn failure marks as `error`, logs to console
- [x] Error handling: all servers fail â†?throw `AllServersUnavailableError`
- [x] Unit tests: registration, connection, health checks, reconnection, shutdown
- [x] Integration test: spawn real demo server subprocess, verify handshake

**Requirements**: FR-1.1 to FR-1.7 (server registration and lifecycle), NFR-2.1 (handle unavailable servers)

**Dependencies**: Task 2.1

**Effort**: L (4 hours)

---

### Task 2.3: MCP Config Loader

**Description**: Load server configurations from `.kiro/settings/mcp.json` at startup.

**Acceptance Criteria**:
- [x] Function `loadMCPConfig(path)` reads and parses JSON file
- [x] Validation: each server has required fields (id, name, transport, and transport-specific fields)
- [x] Validation: transport type is one of 'stdio', 'sse', 'http'
- [x] Error handling: file not found â†?throw `MCPConfigParseError` with path
- [x] Error handling: invalid JSON â†?throw `MCPConfigParseError` with parse error
- [x] Error handling: validation failure â†?throw `MCPConfigParseError` with field name
- [x] Integration with `MCPServerManager`: auto-register servers from config
- [x] Unit tests: valid config, missing file, malformed JSON, invalid schema

**Requirements**: FR-4.1 (pre-configure demo servers), C-4 (config location)

**Dependencies**: Task 2.2

**Effort**: S (1 hour)

---

## Phase 3: Router Adapter

### Task 3.1: Router Process Management

**Description**: Implement router subprocess spawning and lifecycle in `src/lib/router/adapter.ts`.

**Acceptance Criteria**:
- [x] `startRouterProcess()` function spawns `npx -y github:leethoneid/mcp-dynamic-router serve` as child process
- [x] Process stdout/stderr captured and logged for debugging
- [x] Process exit code monitored; non-zero exit throws `RouterUnavailableError`
- [x] MCP client connected to router via stdio
- [x] Graceful shutdown: terminate router process on app exit
- [x] Error handling: spawn failure throws `RouterUnavailableError` with cause
- [x] Unit tests: successful spawn, spawn failure, graceful shutdown
- [x] Integration test: spawn real router, verify MCP handshake completes

**Requirements**: FR-2.1 (invoke router), C-1 (router as dependency)

**Dependencies**: Task 2.1

**Effort**: M (2 hours)

---

### Task 3.2: PBT Strategy Decision â€?Test Wiring

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
- [x] Decision documented in code comment at top of `tests/pbt/` files
- [x] If Option A: helper function `spawnEphemeralServer(schemas)` implemented and tested
- [x] If Option B: `routeIntent(intent, manifests, options?: { searchFn?: ... })` signature added
- [x] Whichever option chosen, sample PBT runs successfully with 10 generated cases

**Requirements**: NFR-3.2, NFR-3.3, NFR-3.4 (PBT testing strategy)

**Dependencies**: Task 3.1

**Effort**: M (2 hours)

---

### Task 3.3: Router Search Integration

**Description**: Implement `searchTools()` and `deriveRoutingDecision()` functions in `src/lib/router/adapter.ts`.

**Acceptance Criteria**:
- [x] `searchTools(query)` function calls router's `mcp_search_tools` tool via MCP client
- [x] Returns array of `SearchResult` objects (tool, server, score, description)
- [x] `deriveRoutingDecision(searchResults, allServers)` function groups results by server
- [x] Derives `selectedServers` as unique server IDs from results
- [x] Derives `toolFilter` array with `serverID` and `includedTools[]` per server
- [x] Optional `reasoning` field populated with top search score
- [x] Error handling: empty search results â†?throw `NoRelevantToolsError`
- [x] Error handling: router timeout (>2s) â†?throw `RoutingTimeoutError`
- [x] Error handling: malformed router response â†?throw `InvalidRoutingDecisionError`
- [x] Unit tests: valid search results, empty results, timeout, malformed response
- [x] Integration test: route real intent ("add a note"), verify decision includes notes server

**Requirements**: FR-2.1 to FR-2.4 (routing and trimming), NFR-1.1 (routing latency <2s)

**Dependencies**: Task 3.1, Task 3.2

**Effort**: M (2.5 hours)

---

### Task 3.4: Main Routing Function

**Description**: Implement `routeIntent()` function as main entry point for routing.

**Acceptance Criteria**:
- [x] `routeIntent(intent, availableServers, options?)` function signature
- [x] Calls `searchTools(intent)` to get search results from router
- [x] Calls `deriveRoutingDecision(results, availableServers)` to build decision
- [x] Records routing statistics via `recordTurn()` (Task 4.1)
- [x] Returns `RoutingDecision` object
- [x] Optional cache bypass via `options.bypassCache` (default false)
- [x] Optional stub search function injection via `options.searchFn` (for testing, per Task 3.2 decision)
- [x] Cache lookup: check if `hash(intent + serverIDs)` exists in cache
- [x] Cache store: save decision to cache (session-scoped, LRU, max 100 entries)
- [x] Cache invalidation: clear cache when server manifests change
- [x] Unit tests: cache hit, cache miss, cache bypass, cache invalidation
- [x] Integration test: full routing flow end-to-end with real router and demo servers

**Requirements**: FR-2.5 (no servers selected), FR-2.6 (determinism)

**Dependencies**: Task 3.3, Task 2.2

**Effort**: M (2 hours)

---

## Phase 4: Statistics Tracking

### Task 4.1: Statistics Calculation

**Description**: Implement `src/lib/router/stats.ts` for per-turn and session-wide statistics.

**Acceptance Criteria**:
- [x] `recordTurn(stats)` function stores `TurnStatistics` in memory array
- [x] `getSessionStats()` function returns aggregated `SessionStatistics`
- [x] `estimateTokenSavings(trimmedSchemas)` function calculates `Math.ceil(charCount / 4)`
- [x] `toolsLoaded` semantics enforced: count of tools included in routing decision (loaded into context)
- [x] `toolsTrimmed` calculated as: `(tools in selected servers) - toolsLoaded`
  - Example: notes server selected (5 tools total), router chooses 2 tools â†?toolsTrimmed = 3
  - NOT calculated as `(all 15 tools from all servers) - toolsLoaded`
  - "Trimmed" means excluded by router from selected servers, not excluded by server selection
- [x] `estimatedTokensSaved` calculated from character count of excluded tool schemas (from selected servers only)
- [x] Session aggregation: sum all turns' `totalToolsLoaded`, `totalToolsTrimmed`, `totalTokensSaved`
- [x] Session aggregation: calculate `averageRoutingTimeMs`
- [x] Statistics never show placeholder/hard-coded values; if calculation fails, return `null` or throw error
- [x] Unit tests: single turn recording, multi-turn aggregation, token estimation formula, verify trimmed calculation formula
- [x] Integration test: route 3 intents, verify session stats match expected sums and trimmed formula

**Requirements**: FR-3.1 to FR-3.6 (statistics tracking), NFR-3.1 (test real behavior)

**Dependencies**: Task 1.2

**Effort**: S (1.5 hours)

---

### Task 4.2: Statistics Display Fail-Safe

**Description**: Ensure statistics display gracefully handles calculation failures.

**Acceptance Criteria**:
- [x] When `getSessionStats()` throws error, UI displays "Stats unavailable" (not "0" or placeholders)
- [x] When `estimateTokenSavings()` returns `null` (e.g., schema fetch failed), display "Token savings unavailable"
- [x] All statistics display components check for `null`/`undefined` before rendering numbers
- [x] Error logged to console with diagnostic info when statistics calculation fails
- [x] Unit tests: verify UI component renders "Stats unavailable" when calculation throws

**Requirements**: FR-3.4 (no hard-coded numbers), 2.7 from AGENTS.md (fail loud)

**Dependencies**: Task 4.1

**Effort**: S (1 hour)

---

## Phase 5: Demo MCP Servers

### Task 5.1: Notes Server

**Description**: Implement `src/mcp-servers/notes/index.mjs` as stdio MCP server.

**Acceptance Criteria**:
- [x] File is pure ES module (`.mjs`), no TypeScript compilation required
- [x] Implements MCP stdio protocol using `@modelcontextprotocol/sdk`
- [x] Tools exposed:
  - `create_note(title: string, content: string)` â†?`{ id: string }`
  - `read_note(id: string)` â†?`{ id: string, title: string, content: string, created: number }`
  - `update_note(id: string, title?: string, content?: string)` â†?`{ id: string }`
  - `delete_note(id: string)` â†?`{ success: boolean }`
  - `list_notes()` â†?`{ notes: Array<{ id: string, title: string }> }`
- [x] Storage: in-memory Map, optionally persist to `notes.json` in temp directory
- [x] Fixtures: 3 pre-populated demo notes with `[DEMO]` marker in content
- [x] Input validation: missing required parameters return error
- [x] Error handling: invalid ID returns error (not silent failure)
- [x] Manual test: run `node src/mcp-servers/notes/index.mjs` and verify MCP handshake via stdin/stdout
- [x] Integration test: spawn server, connect via `MCPClient`, call each tool, verify responses

**Requirements**: FR-4.3 (notes server tools), FR-4.7 (fail loud), 2.7 from AGENTS.md (demo data labeled)

**Dependencies**: Task 2.1

**Effort**: M (2.5 hours)

---

### Task 5.2: Tasks Server

**Description**: Implement `src/mcp-servers/tasks/index.mjs` as stdio MCP server.

**Acceptance Criteria**:
- [x] File is pure ES module (`.mjs`), no TypeScript compilation required
- [x] Implements MCP stdio protocol using `@modelcontextprotocol/sdk`
- [x] Tools exposed:
  - `create_task(title: string, priority?: 'low'|'medium'|'high')` â†?`{ id: string }`
  - `read_task(id: string)` â†?`{ id: string, title: string, priority: string, completed: boolean }`
  - `update_task(id: string, title?: string, priority?: string, completed?: boolean)` â†?`{ id: string }`
  - `delete_task(id: string)` â†?`{ success: boolean }`
  - `list_tasks(filter?: { completed?: boolean })` â†?`{ tasks: Array<...> }`
- [x] Storage: in-memory Map, optionally persist to `tasks.json`
- [x] Fixtures: 5 pre-populated demo tasks (mix of completed/incomplete) with `[DEMO]` marker
- [x] Input validation and error handling per notes server pattern
- [x] Manual and integration tests per notes server pattern

**Requirements**: FR-4.4 (tasks server tools)

**Dependencies**: Task 5.1

**Effort**: M (2.5 hours)

---

### Task 5.3: Calculator Server

**Description**: Implement `src/mcp-servers/calculator/index.mjs` as stdio MCP server.

**Acceptance Criteria**:
- [x] File is pure ES module (`.mjs`), no TypeScript compilation required
- [x] Implements MCP stdio protocol using `@modelcontextprotocol/sdk`
- [x] Tools exposed:
  - `add(a: number, b: number)` â†?`{ result: number }`
  - `subtract(a: number, b: number)` â†?`{ result: number }`
  - `multiply(a: number, b: number)` â†?`{ result: number }`
  - `divide(a: number, b: number)` â†?`{ result: number }` (error if b=0)
  - `convert_units(value: number, from: string, to: string)` â†?`{ result: number }`
- [x] Unit conversions supported: length (m, ft, in), weight (kg, lb), temperature (C, F)
- [x] Storage: none (stateless)
- [x] Input validation: non-numeric inputs return error
- [x] Error handling: divide by zero returns error with clear message
- [x] Manual and integration tests per notes server pattern

**Requirements**: FR-4.5 (calculator server tools)

**Dependencies**: Task 5.1

**Effort**: S (1.5 hours)

---

### Task 5.4: Demo Server Pre-Configuration

**Description**: Configure demo servers in `.kiro/settings/mcp.json` for auto-start.

**Acceptance Criteria**:
- [x] File `.kiro/settings/mcp.json` contains entries for notes, tasks, calculator
- [x] Each entry specifies: `command: "node"`, `args: ["src/mcp-servers/<name>/index.mjs"]`, `disabled: false`
- [x] MCPServerManager reads config at startup and spawns all three servers
- [x] Startup test: run app, verify all three servers connect and report `status: 'connected'`
- [x] Startup test: verify `getServerManifests()` returns 15 total tools (5 per server)
- [x] Error handling test: rename a server file, restart, verify `MCPConfigParseError` or `ServerConnectionError` thrown

**Requirements**: FR-4.1 (pre-configure demo servers), FR-4.6 (auto-register), AC-4 (demo servers functional on first start)

**Dependencies**: Task 5.1, Task 5.2, Task 5.3, Task 2.3

**Effort**: S (1 hour)

---

## Phase 6: Property-Based Testing

### Task 6.1: PBT Invariant 1 â€?Required Parameter Preservation

**Description**: Implement property-based test for schema trimming invariant.

**Acceptance Criteria**:
- [x] Test file `tests/pbt/trimming.test.ts` created
- [x] Custom generator `toolSchemaGen` defined (valid MCP `ToolSchema` format with `inputSchema.required[]`)
- [x] Test wiring strategy from Task 3.2 implemented (ephemeral servers OR stub search function)
- [x] Property: for all generated schemas, routing decision includes tools â†?all `required[]` parameters preserved in loaded schemas
- [x] Test runs â‰?00 iterations via `{ numRuns: 100 }`
- [x] Test annotated with comment: `// Validates FR-2.3, NFR-3.2`
- [x] Test passes consistently (no flakes)
- [x] If test fails, shrinks to minimal failing case

**Requirements**: FR-2.3 (preserve required params), NFR-3.2 (PBT â‰?00 cases)

**Dependencies**: Task 3.4, Task 3.2

**Effort**: M (2.5 hours)

---

### Task 6.2: PBT Invariant 2 â€?Routing Determinism

**Description**: Implement property-based test for routing consistency.

**Acceptance Criteria**:
- [x] Test file `tests/pbt/determinism.test.ts` created
- [x] Generator: random intent strings + random sets of tool schemas
- [x] Property: same intent + same server set â†?two calls to `routeIntentNoCache()` return identical `selectedServers` and `toolFilter`
- [x] Helper `routeIntentNoCache()` implemented to bypass cache (uses `options.bypassCache: true`)
- [x] Test annotated with comment: `// Validates FR-2.6, NFR-3.3`
- [x] Test runs â‰?00 iterations
- [x] Test passes consistently

**Requirements**: FR-2.6 (determinism), NFR-3.3 (PBT â‰?00 cases)

**Dependencies**: Task 3.4, Task 3.2

**Effort**: M (2.5 hours)

---

### Task 6.3: PBT Invariant 3 â€?Schema Round-Trip Fidelity

**Description**: Implement property-based test for schema immutability.

**Acceptance Criteria**:
- [x] Test file `tests/pbt/fidelity.test.ts` created
- [x] Generator: random valid tool schemas
- [x] Property: register schemas â†?route intent (uses cached schemas) â†?force refresh from servers â†?reloaded schemas match originals
- [x] Deep clone used to compare original vs. reloaded schemas (detects mutation)
- [x] Test annotated with comment: `// Validates FR-2.7, NFR-3.4`
- [x] Test runs â‰?00 iterations
- [x] Test passes consistently

**Requirements**: FR-2.7 (round-trip fidelity), NFR-3.4 (PBT â‰?00 cases)

**Dependencies**: Task 3.4, Task 2.2

**Effort**: M (2 hours)

---

## Phase 7: Integration & End-to-End Testing

### Task 7.1: Full Routing Flow Integration Test

**Description**: Test complete routing flow from user intent to tool invocation.

**Acceptance Criteria**:
- [x] Test file `tests/integration/routing-e2e.test.ts` created
- [x] Test spawns all three demo servers as real subprocesses
- [x] Test spawns router as real subprocess
- [x] Test intent: "Add a note about the meeting" â†?verify router selects notes server + `create_note` tool
- [x] Test intent: "Show my tasks" â†?verify router selects tasks server + `list_tasks` tool
- [x] Test intent: "Calculate 15 + 27" â†?verify router selects calculator server + `add` tool
- [x] Test verifies `toolsLoaded` and `toolsTrimmed` statistics are non-zero and accurate
- [x] Test verifies `estimatedTokensSaved` > 0
- [x] Test teardown: terminate all subprocesses, verify clean shutdown
- [x] Test passes in CI environment (no leftover processes)

**Requirements**: AC-2 (route intent and get response), NFR-1.1 (latency <2s), NFR-3.1 (test real behavior)

**Dependencies**: Task 3.4, Task 4.1, Task 5.4

**Effort**: L (3 hours)

---

### Task 7.2: Error Handling Integration Tests

**Description**: Test fail-loud behavior for error scenarios.

**Acceptance Criteria**:
- [x] Test file `tests/integration/error-handling.test.ts` created
- [x] Test: router process spawn failure â†?verify `RouterUnavailableError` thrown, no silent fallback
- [x] Test: all demo servers disabled in config â†?verify `AllServersUnavailableError` thrown at startup
- [x] Test: malformed `.kiro/settings/mcp.json` â†?verify `MCPConfigParseError` thrown at startup
- [x] Test: disconnect server mid-session â†?verify server marked `disconnected`, excluded from routing
- [x] Test: router returns empty search results â†?verify `NoRelevantToolsError` thrown
- [x] Test: tool call to disconnected server â†?verify `ToolInvocationError` thrown with server ID
- [x] All tests verify no mock data silently substituted

**Requirements**: FR-1.7 (fail on connection), FR-2.5 (no servers selected), NFR-2.1 (handle unavailable), 2.7 from AGENTS.md (fail loud)

**Dependencies**: Task 3.4, Task 2.2, Task 2.3

**Effort**: M (2.5 hours)

---

### Task 7.3: Acceptance Criteria Validation

**Description**: Verify all acceptance criteria from requirements.md are met.

**Acceptance Criteria**:
- [x] AC-1: User can add stdio MCP server â†?manual test or UI test (if UI implemented)
- [x] AC-2: User can submit intent and get response â†?validated by Task 7.1
- [x] AC-3: User can view routing statistics â†?validated by Task 7.1
- [x] AC-4: Demo servers pre-configured and functional â†?validated by Task 5.4
- [x] AC-5: All PBT tests pass with â‰?00 cases â†?validated by Tasks 6.1, 6.2, 6.3
- [x] AC-6: Connection failures display errors, no mock fallback â†?validated by Task 7.2
- [x] Checklist document created summarizing validation results

**Requirements**: All AC-* from requirements.md

**Dependencies**: Task 7.1, Task 7.2, Task 6.1, Task 6.2, Task 6.3

**Effort**: S (1 hour)

---

## Phase 8: Documentation & Polish

### Task 8.1: API Documentation

**Description**: Document public APIs for router-core components.

**Acceptance Criteria**:
- [x] JSDoc comments added to all exported functions and classes
- [x] `README.md` in `src/lib/router/` explains adapter architecture
- [x] `README.md` in `src/mcp-servers/` explains how to add new demo servers
- [x] Code examples included for common use cases (register server, route intent, get stats)

**Requirements**: Military Rule 3 (exhaustive docs)

**Dependencies**: All implementation tasks

**Effort**: S (1.5 hours)

---

### Task 8.2: Performance Validation

**Description**: Verify NFR-1 performance targets are met.

**Acceptance Criteria**:
- [x] Benchmark test: route 10 intents with 10 registered servers â†?average routing time <2s (NFR-1.1)
- [x] Benchmark test: retrieve schemas from each demo server â†?each <1s (NFR-1.2)
- [x] Benchmark results logged to console (not hard-coded in docs)
- [x] If targets not met, document actual performance and file issue for optimization

**Requirements**: NFR-1.1, NFR-1.2 (performance targets)

**Dependencies**: Task 7.1

**Effort**: S (1 hour)

---

## Summary

**Total Tasks**: 23  
**Total Estimated Effort**: ~40 hours  
**Critical Path**: 1.1 â†?1.2 â†?2.1 â†?2.2 â†?2.3 â†?3.1 â†?3.2 â†?3.3 â†?3.4 â†?5.4 â†?7.1 â†?7.3

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
| 1.1 | C-2, C-3 | â€?| â€?|
| 1.2 | C-2 | â€?| â€?|
| 2.1 | FR-1.6, NFR-4.1 | â€?| â€?|
| 2.2 | FR-1.1â€“FR-1.7, NFR-2.1 | â€?| â€?|
| 2.3 | FR-4.1, C-4 | â€?| â€?|
| 3.1 | FR-2.1, C-1 | â€?| â€?|
| 3.2 | NFR-3.2, NFR-3.3, NFR-3.4 | All | â€?|
| 3.3 | FR-2.1â€“FR-2.4, NFR-1.1 | â€?| â€?|
| 3.4 | FR-2.5, FR-2.6 | PBT-2 | AC-2 |
| 4.1 | FR-3.1â€“FR-3.6, NFR-3.1 | â€?| AC-3 |
| 4.2 | FR-3.4, 2.7 (AGENTS.md) | â€?| â€?|
| 5.1 | FR-4.3, FR-4.7, 2.7 (AGENTS.md) | â€?| â€?|
| 5.2 | FR-4.4 | â€?| â€?|
| 5.3 | FR-4.5 | â€?| â€?|
| 5.4 | FR-4.1, FR-4.6 | â€?| AC-4 |
| 6.1 | FR-2.3, NFR-3.2 | PBT-1 | AC-5 |
| 6.2 | FR-2.6, NFR-3.3 | PBT-2 | AC-5 |
| 6.3 | FR-2.7, NFR-3.4 | PBT-3 | AC-5 |
| 7.1 | AC-2, NFR-1.1, NFR-3.1 | â€?| AC-2, AC-3 |
| 7.2 | FR-1.7, FR-2.5, NFR-2.1, 2.7 (AGENTS.md) | â€?| AC-6 |
| 7.3 | All AC-* | â€?| All AC-* |
| 8.1 | Military Rule 3 | â€?| â€?|
| 8.2 | NFR-1.1, NFR-1.2 | â€?| â€?|

---

## Changes from Previous Versions

_Initial version._

