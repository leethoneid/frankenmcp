# Acceptance Criteria Validation Checklist

**Project**: FrankenMCP (`leethoneid/frankenmcp`)  
**Specification**: `.kiro/specs/router-core/requirements.md`  
**Phase**: Phase 7 Integration & End-to-End Testing (Task 7.3)  
**Date**: 2026-11-06  
**Status**: All Criteria Passed (100% Green)

---

## 1. Acceptance Criteria Verification Matrix

| Criterion | Requirement Description | Verification Mechanism | Status | Evidence / Test Location |
| :--- | :--- | :--- | :---: | :--- |
| **AC-1** | User can add a new stdio MCP server by providing a command and arguments, and the system successfully connects and retrieves tool schemas. | Programmatic & Integration Tests | **PASS** | `tests/integration/acceptance.test.ts` (`validates AC-1`), `MCPServerManager.registerServer()` + `connectServer()` |
| **AC-2** | User can submit a natural language intent (e.g., "Add a note about the meeting"), and the system routes to the notes server, loads only relevant tools, and returns a response. | End-to-End Integration Test | **PASS** | `tests/integration/routing-e2e.test.ts` (`routes "Add a note about the meeting"`) |
| **AC-3** | User can view routing statistics showing the number of tools loaded, tools trimmed, and estimated token savings for the current turn. | Integration & Unit Tests | **PASS** | `tests/integration/routing-e2e.test.ts` (`validates AC-3`), `tests/unit/stats.test.ts`, `src/lib/router/stats.ts` |
| **AC-4** | The three demo servers (notes, tasks, calculator) are pre-configured and functional on first application start with no additional setup. | Config Loader & Integration Tests | **PASS** | `tests/integration/demo-servers.integration.test.ts`, `.kiro/settings/mcp.json` (15 tools total across 3 servers) |
| **AC-5** | All property-based tests for trimming, determinism, and fidelity pass with ≥100 generated test cases each. | Fast-Check Property-Based Tests | **PASS** | `tests/pbt/trimming.test.ts` (100 runs), `tests/pbt/determinism.test.ts` (100 runs), `tests/pbt/fidelity.test.ts` (100 runs) |
| **AC-6** | When a server connection fails, the system displays an error message and does NOT generate synthetic success responses. | Fail-Loud Error Handling Tests | **PASS** | `tests/integration/error-handling.test.ts` (6 tests asserting fail-loud errors without mock fallback) |

---

## 2. Detailed Verification Summaries

### AC-1: Dynamic Server Addition & Schema Discovery
- **Verified Behavior**: Calling `manager.registerServer({ id, command, args })` adds a stdio MCP server to the registry. Calling `manager.connectServer(id)` spawns the process, completes the MCP JSON-RPC handshake, and retrieves tool schemas via `client.listTools()`. Discovered tools are queryable via `manager.getServerManifests()` and executable via `manager.invokeToolCall()`.
- **Test File**: `tests/integration/acceptance.test.ts`

### AC-2: Natural Language Routing & Tool Execution
- **Verified Behavior**: 
  - Intent `"Add a note about the meeting"` routes to `notes` server with `create_note` loaded into context; invoking `create_note` creates a real note with ID.
  - Intent `"Show my tasks"` routes to `tasks` server with `list_tasks` loaded into context; returns 5 demo tasks.
  - Intent `"Calculate 15 + 27"` routes to `calculator` server with `add` loaded into context; returns `{ result: 42 }`.
- **Test File**: `tests/integration/routing-e2e.test.ts`

### AC-3: Real Per-Turn & Session Statistics
- **Verified Behavior**: 
  - `toolsLoaded`: Count of tools included in context by the router.
  - `toolsTrimmed`: Exact formula `(tools in selected servers) - toolsLoaded` (excluded tools from non-selected servers are never counted).
  - `estimatedTokensSaved`: Calculated via `Math.ceil(charCount / 4)` from excluded schemas.
  - Fail-safe UI rendering: returns `"Stats unavailable"` / `"Token savings unavailable"` if data is corrupted or null.
- **Test File**: `tests/integration/routing-e2e.test.ts`, `tests/unit/stats.test.ts`

### AC-4: Zero-Config Demo Servers
- **Verified Behavior**: `.kiro/settings/mcp.json` contains native ES module configurations for `notes`, `tasks`, and `calculator`. Application startup auto-discovers all 3 servers and exposes 15 total tools without requiring compilation or API keys.
- **Test File**: `tests/integration/demo-servers.integration.test.ts`

### AC-5: Property-Based Testing Invariants (≥100 Runs Each)
- **Invariant 1 (Trimming Preserves Required Parameters)**:
  - File: `tests/pbt/trimming.test.ts`
  - Validates: `FR-2.3`, `NFR-3.2`
  - Runs: 100 fast-check iterations across single-server and multi-server routing.
- **Invariant 2 (Routing Determinism)**:
  - File: `tests/pbt/determinism.test.ts`
  - Validates: `FR-2.6`, `NFR-3.3`
  - Runs: 100 fast-check iterations across uncached, cached, and order-inverted inputs.
- **Invariant 3 (Schema Round-Trip Fidelity)**:
  - File: `tests/pbt/fidelity.test.ts`
  - Validates: `FR-2.7`, `NFR-3.4`
  - Runs: 100 fast-check iterations verifying zero in-place mutation and 100% reload fidelity.

### AC-6: Fail-Loud Error Handling (No Silent Mock Fallback)
- **Verified Behavior**:
  - Router spawn failure → throws `RouterUnavailableError`.
  - All servers disabled in config → throws `AllServersUnavailableError`.
  - Malformed config file → throws `MCPConfigParseError`.
  - Mid-session disconnection → server excluded from routing pool; disconnected tool invocation throws `ToolInvocationError`.
  - Empty search results → throws `NoRelevantToolsError`.
  - Zero synthetic data substitution permitted under any failure condition.
- **Test File**: `tests/integration/error-handling.test.ts`

---

## 3. Test Suite Execution Summary

```
Test Files  17 passed (17)
     Tests  78 passed (78)
```
- Integration Tests: 5 files, 16 tests (all real subprocesses, 0 mocks in e2e)
- Property-Based Tests: 4 files, 8 tests (all ≥100 fast-check runs)
- Unit Tests: 8 files, 54 tests
