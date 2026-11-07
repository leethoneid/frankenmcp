# Deployment — Task Breakdown

> **Feature**: Production-ready Vercel deployment with in-process MCP adapters  
> **Status**: Draft (awaiting confirmation)  
> **Author**: Kiro  
> **Date**: 2026-11-06  
> **Requirements**: [requirements.md](./requirements.md)  
> **Design**: [design.md](./design.md)

## Overview

This task breakdown implements the dual-mode MCP architecture for Vercel serverless compatibility. Tasks are organized into four phases: investigation & core infrastructure, adapter implementation, deployment configuration, and verification.

**Estimated Total Effort**: 25 hours nominal (28 hours if conditional Task 1.4 triggered)

**Critical Path**: Phase 1 (investigation) → Phase 2 (adapters) → Phase 3 (deployment config) → Phase 4 (verification)

**Parallelization Opportunities**: After Phase 1 completes, Phase 2 tasks (2.1, 2.2, 2.3) can run in parallel.

---

## Phase 1: Investigation & Core Infrastructure

### Task 1.1: Router Vercel Compatibility Investigation

**Priority**: P0 (blocks all subsequent work)

**Description**: Deploy current router-core implementation to Vercel staging to determine if `mcp-dynamic-router` works in serverless environment, including true cold start measurement.

**Dependencies**: None (first task)

**Acceptance Criteria**:
- [ ] Create Vercel staging project linked to feature branch
- [ ] Deploy current implementation with stdio demo servers
- [ ] **Execute true cold start test**:
  - Delete Vercel deployment cache (redeploy to new function)
  - Clear local `~/.npm/_npx` cache to prevent npx caching
  - Invoke function and measure router subprocess spawn time
- [ ] Execute 10 test queries and measure:
  - Success rate (target: 100%)
  - Router invocation latency (target: <2s)
  - Subprocess spawn errors (observe if any)
  - Cold start vs warm function timing
- [ ] Document findings:
  - **If router works on cold start**: Proceed with current architecture (no router changes needed)
  - **If router requires subprocess or fails cold start**: Mark conditional Task 1.4 as required
- [ ] Update requirements.md Open Question 2 with decision

**Estimated Effort**: 2 hours

**Implementation Notes**:
- Use minimal test deployment (no full UI, just API route)
- Check Vercel logs for subprocess-related warnings and npx cache behavior
- Test both cold start (new function) and warm function scenarios
- Verify npx GitHub tarball fetch doesn't timeout on Vercel

---

### Task 1.2: Implement Environment Detection Module

**Priority**: P0

**Description**: Create module to detect runtime environment (local vs Vercel) via environment variables.

**Dependencies**: None

**Files**:
- `src/lib/deployment/env.ts` (new)

**Acceptance Criteria**:
- [ ] `detectEnvironment()` function returns `'vercel'` when `process.env.VERCEL === '1'`
- [ ] `detectEnvironment()` function returns `'local'` when `process.env.VERCEL` is undefined
- [ ] `isVercel()` helper function returns boolean
- [ ] Unit tests verify detection logic with mocked environment variables
- [ ] Module exports TypeScript type `RuntimeEnvironment`

**Estimated Effort**: 0.5 hours

**Implementation Notes**:
```typescript
// src/lib/deployment/env.ts
export type RuntimeEnvironment = 'vercel' | 'local';

export function detectEnvironment(): RuntimeEnvironment {
  return process.env.VERCEL === '1' ? 'vercel' : 'local';
}

export function isVercel(): boolean {
  return detectEnvironment() === 'vercel';
}
```

---

### Task 1.3: Define InProcessMCPAdapter Interface

**Priority**: P0

**Description**: Define TypeScript interface for in-process MCP adapters and common types.

**Dependencies**: Task 1.2

**Files**:
- `src/lib/mcp/in-process-adapter.ts` (new)

**Acceptance Criteria**:
- [ ] `InProcessMCPAdapter` interface includes:
  - `serverID: string`
  - `name: string`
  - `listTools(): ToolDefinition[]` (synchronous)
  - `invokeTool(toolName: string, args: Record<string, any>): Promise<any>`
  - `dispose(): void`
- [ ] `ToolDefinition` interface matches MCP SDK tool schema structure
- [ ] Interface documented with JSDoc comments explaining contracts
- [ ] No implementation code (interface only)

**Estimated Effort**: 0.5 hours

**Implementation Notes**:
- Use MCP SDK types as reference for `ToolDefinition`
- Document that `listTools()` must be synchronous (no subprocess communication)

---

### Task 1.4: Router Fallback Implementation (CONDITIONAL — Only if Task 1.1 Fails)

**Priority**: P0 (if triggered)

**Description**: Implement simplified rule-based routing fallback for Vercel if `mcp-dynamic-router` subprocess incompatible with cold start.

**Dependencies**: Task 1.1 (triggered only if router fails)

**Files**:
- `src/lib/router/fallback.ts` (new)
- `src/lib/router/adapter.ts` (modify to use fallback on Vercel)

**Acceptance Criteria**:
- [ ] Implement `simplifiedRoute(intent: string): string[]` function with keyword matching:
  - "note" / "notes" → `['notes']`
  - "task" / "tasks" / "todo" → `['tasks']`
  - Numbers / arithmetic operators → `['calculator']`
  - No match → `['notes', 'tasks', 'calculator']` (all servers)
- [ ] Modify `routeIntent()` to detect Vercel environment and use fallback if router unavailable
- [ ] Log warning when fallback routing is used
- [ ] Unit tests verify keyword matching accuracy (≥90% on common queries)
- [ ] README documents fallback behavior and recommends full router for local dev

**Estimated Effort**: 3 hours (if triggered)

**Implementation Notes**:
```typescript
// src/lib/router/fallback.ts
export function simplifiedRoute(intent: string): string[] {
  const lower = intent.toLowerCase();
  
  if (/note/i.test(lower)) return ['notes'];
  if (/task|todo/i.test(lower)) return ['tasks'];
  if (/\d+\s*[+\-*/×÷]\s*\d+/.test(intent)) return ['calculator'];
  
  // Default: route to all servers
  return ['notes', 'tasks', 'calculator'];
}
```

---

## Phase 2: Demo Server Adapters

### Task 2.1: Implement Notes Core & In-Process Adapter (with Fixtures)

**Priority**: P0

**Description**: Extract notes business logic into `NotesCore` class (`.mjs` format) with pre-seeded fixtures and implement in-process adapter.

**Dependencies**: Task 1.3

**Files**:
- `src/mcp-servers/notes/core.mjs` (new — JavaScript module)
- `src/mcp-servers/notes/adapter.ts` (new — imports `core.mjs`)
- `src/mcp-servers/notes/index.mjs` (refactor to use `core.mjs`)

**Acceptance Criteria**:
- [ ] `NotesCore` class (in `core.mjs`) implements:
  - In-memory note storage (`Map<string, Note>`)
  - `loadFixtures()` method seeding 3 demo notes (matching existing stdio server fixtures):
    - "Project Kickoff"
    - "Architecture Blueprint"
    - "Lab Supply Checklist"
  - CRUD methods: `createNote()`, `listNotes()`, `readNote()`, `updateNote()`, `deleteNote()`
- [ ] Constructor calls `loadFixtures()` automatically (function-instance-scoped initialization)
- [ ] `NotesAdapter` (TypeScript) imports `NotesCore` from `core.mjs` and implements `InProcessMCPAdapter`
- [ ] `NotesAdapter.listTools()` returns 5 tool definitions matching stdio version
- [ ] `NotesAdapter.invokeTool()` delegates to `NotesCore` methods
- [ ] Stdio version (`index.mjs`) refactored to use `NotesCore` (shared logic)
- [ ] Unit tests verify:
  - Fixtures loaded on initialization (3 notes present)
  - User-created notes appear alongside fixtures
  - CRUD operations produce expected results
  - Notes sorted by creation date (newest first)
- [ ] Adapter parity test verifies stdio and in-process produce identical tool lists
- [ ] **If using TypeScript import in `.mjs`**: Document Node.js ≥23.6 requirement in README

**Estimated Effort**: 3 hours

**Implementation Notes**:
- Core written as `.mjs` (JavaScript) for direct import by both `.mjs` stdio and `.ts` adapter
- Alternative: Core as `.ts` requires Node.js ≥23.6; update `package.json` engines field
- Fixture IDs generated with `crypto.randomUUID()`
- State persists across warm invocations (function-instance-scoped)

---

### Task 2.2: Implement Tasks Core & In-Process Adapter (with Fixtures)

**Priority**: P0

**Description**: Extract tasks business logic into `TasksCore` class (`.mjs` format) with pre-seeded fixtures and implement in-process adapter.

**Dependencies**: Task 1.3

**Files**:
- `src/mcp-servers/tasks/core.mjs` (new — JavaScript module)
- `src/mcp-servers/tasks/adapter.ts` (new — imports `core.mjs`)
- `src/mcp-servers/tasks/index.mjs` (refactor to use `core.mjs`)

**Acceptance Criteria**:
- [ ] `TasksCore` class (in `core.mjs`) implements:
  - In-memory task storage (`Map<string, Task>`)
  - `loadFixtures()` method seeding 5 demo tasks (matching existing stdio server fixtures):
    - "[DEMO] Assemble server stitches"
    - "[DEMO] Secure lightning rod"
    - "[DEMO] Calibrate dynamic router"
    - "[DEMO] Trim schema overhead"
    - "[DEMO] Record hackathon demo video"
  - CRUD methods: `createTask()`, `listTasks()`, `readTask()`, `updateTask()`, `deleteTask()`
- [ ] Constructor calls `loadFixtures()` automatically (function-instance-scoped initialization)
- [ ] `TasksAdapter` (TypeScript) imports `TasksCore` from `core.mjs` and implements `InProcessMCPAdapter`
- [ ] `TasksAdapter.listTools()` returns 5 tool definitions matching stdio version
- [ ] `TasksAdapter.invokeTool()` delegates to `TasksCore` methods
- [ ] Stdio version (`index.mjs`) refactored to use `TasksCore` (shared logic)
- [ ] Unit tests verify:
  - Fixtures loaded on initialization (5 tasks present)
  - User-created tasks appear alongside fixtures
  - Default priority is `'medium'` when not specified
  - Tasks can be marked completed/incomplete
  - Invalid IDs throw errors
- [ ] Adapter parity test verifies stdio and in-process produce identical tool lists

**Estimated Effort**: 3 hours

**Implementation Notes**:
- Core written as `.mjs` (JavaScript) for direct import by both `.mjs` stdio and `.ts` adapter
- Priority enum: `'low' | 'medium' | 'high'`
- Task interface includes `completed: boolean` field (defaults to `false`)
- State persists across warm invocations (function-instance-scoped)

---

### Task 2.3: Implement Calculator Core & In-Process Adapter

**Priority**: P0

**Description**: Extract calculator logic into `CalculatorCore` class (`.mjs` format) and implement in-process adapter.

**Dependencies**: Task 1.3

**Files**:
- `src/mcp-servers/calculator/core.mjs` (new — JavaScript module)
- `src/mcp-servers/calculator/adapter.ts` (new — imports `core.mjs`)
- `src/mcp-servers/calculator/index.mjs` (refactor to use `core.mjs`)

**Acceptance Criteria**:
- [ ] `CalculatorCore` class (in `core.mjs`) implements stateless methods:
  - `add(a, b): number`
  - `subtract(a, b): number`
  - `multiply(a, b): number`
  - `divide(a, b): number` (throws on divide-by-zero)
  - `convertUnits(value, from, to): number` (temperature, length, weight)
- [ ] `CalculatorAdapter` (TypeScript) imports `CalculatorCore` from `core.mjs` and implements `InProcessMCPAdapter`
- [ ] `CalculatorAdapter.listTools()` returns 5 tool definitions matching stdio version
- [ ] `CalculatorAdapter.invokeTool()` delegates to `CalculatorCore` methods
- [ ] Stdio version (`index.mjs`) refactored to use `CalculatorCore` (shared logic)
- [ ] Unit tests verify:
  - Arithmetic operations produce correct results
  - Divide-by-zero throws error
  - Unit conversions are accurate (e.g., 0°C = 32°F, 1m = 3.28084ft)
- [ ] Adapter parity test verifies stdio and in-process produce identical tool lists

**Estimated Effort**: 2.5 hours

**Implementation Notes**:
- Core written as `.mjs` (JavaScript) for direct import by both `.mjs` stdio and `.ts` adapter
- Unit conversions: support Celsius/Fahrenheit, meters/feet, kg/lbs
- Use constant conversion factors (no external libraries)
- No state (stateless calculator)

---

### Task 2.4: Extend MCPServerManager for Dual-Mode Operation

**Priority**: P0

**Description**: Modify `MCPServerManager` to detect environment and load adapters or spawn subprocesses accordingly.

**Dependencies**: Task 1.2, Task 2.1, Task 2.2, Task 2.3

**Files**:
- `src/lib/mcp/server-manager.ts` (modify)

**Acceptance Criteria**:
- [ ] `MCPServerManager` constructor calls `detectEnvironment()` and logs runtime mode
- [ ] `connectAll()` method branches on environment:
  - **Vercel**: Calls `loadInProcessAdapters()`
  - **Local**: Calls `spawnStdioServers()` (existing logic)
- [ ] `loadInProcessAdapters()` method:
  - Instantiates `NotesAdapter`, `TasksAdapter`, `CalculatorAdapter`
  - Calls `listTools()` on each adapter
  - Stores connections with `connectionType: 'in-process'`
  - Logs successful load with tool count
  - Handles errors gracefully (mark server as unavailable, continue with others)
- [ ] `invokeToolCall()` method branches on connection type:
  - **in-process**: Calls `adapter.invokeTool(toolName, args)`
  - **stdio**: Uses existing client invocation
- [ ] `getServerManifests()` includes transport type in manifest (`'stdio'` or `'in-process'`)
- [ ] Integration test verifies:
  - With `process.env.VERCEL=1`, loads adapters (no subprocesses)
  - With `process.env.VERCEL` undefined, spawns subprocesses
  - Tool invocation works correctly in both modes
- [ ] Performance test verifies adapter initialization <100ms

**Estimated Effort**: 4 hours

**Implementation Notes**:
- Add `connectionType` field to `ServerConnection` interface
- Log initialization time for performance monitoring

---

## Phase 3: Deployment Configuration & Health Check

### Task 3.1: Create Vercel Configuration

**Priority**: P0

**Description**: Define `vercel.json` to configure function timeout, memory, and build settings.

**Dependencies**: None (can run in parallel with Phase 2)

**Files**:
- `vercel.json` (new)

**Acceptance Criteria**:
- [ ] `vercel.json` configures:
  - Function memory: 1024MB
  - Function max duration: 10 seconds
  - Build command: `npm run build`
  - Install command: `npm install`
- [ ] Deployment to Vercel staging succeeds with configuration
- [ ] Vercel deployment logs show correct timeout/memory settings applied

**Estimated Effort**: 0.5 hours

**Implementation Notes**:
```json
{
  "functions": {
    "app/api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 10
    }
  },
  "buildCommand": "npm run build",
  "installCommand": "npm install"
}
```

---

### Task 3.2: Implement Health Check API Route

**Priority**: P1

**Description**: Create `/api/health` endpoint to report server connection status; must call `ensureServersInitialized()` first.

**Dependencies**: Task 2.4

**Files**:
- `src/app/api/health/route.ts` (new)

**Acceptance Criteria**:
- [ ] `GET /api/health` calls `ensureServersInitialized()` before reading manifests
- [ ] Returns JSON with:
  - `status`: `'healthy'` | `'degraded'` | `'error'`
  - `environment`: `'vercel'` | `'local'`
  - `servers`: Array of `{ id, name, status, transport, toolCount }`
  - `timestamp`: ISO 8601 string
- [ ] `status: 'healthy'` **requires at least 3 demo servers online** (notes, tasks, calculator all connected)
- [ ] `status: 'degraded'` when 1-2 demo servers unavailable
- [ ] `status: 'error'` when manager fails to initialize or all servers offline
- [ ] HTTP status codes:
  - 200 for healthy/degraded
  - 503 for error
- [ ] Response time <100ms (after initialization)
- [ ] Unit test verifies response schema
- [ ] Integration test verifies:
  - Health check triggers server initialization
  - Actual server status reported correctly
  - Healthy requires ≥3 demo servers

**Estimated Effort**: 1.5 hours

**Implementation Notes**:
```typescript
const demoServers = ['notes', 'tasks', 'calculator'];
const onlineDemoServers = manifests.filter(
  m => demoServers.includes(m.serverID) && m.status === 'connected'
);
const allHealthy = onlineDemoServers.length >= 3;
```

---

### Task 3.3: (DELETED — Merged into Task 2.1 and 2.2)

**Note**: Fixture data seeding is now required (not optional) and integrated into Phase 2 adapter implementation tasks (Task 2.1 for notes, Task 2.2 for tasks).

---

## Phase 4: Verification & Documentation

### Task 4.1: End-to-End Vercel Deployment Test

**Priority**: P0

**Description**: Deploy full application to Vercel production and verify all acceptance criteria.

**Dependencies**: Task 2.4, Task 3.1, Task 3.2

**Acceptance Criteria**:
- [ ] Deploy to Vercel production from `main` branch
- [ ] Deployment succeeds without errors in build logs
- [ ] `/api/health` returns `status: 'healthy'` with 3 connected servers
- [ ] Playground chat successfully executes queries:
  - "Add a note about testing" → Creates note
  - "List my notes" → Returns notes (including fixtures)
  - "What is 42 + 58?" → Returns 100
- [ ] Monster Lab dashboard displays server status with `transport: 'in-process'`
- [ ] Cold start completes within 3 seconds (first request after deploy)
- [ ] Warm function completes within 500ms (subsequent requests)
- [ ] No subprocess-related errors in Vercel logs
- [ ] Verify with fresh browser (no cache) that demo works without configuration

**Estimated Effort**: 2 hours

**Implementation Notes**:
- Use Vercel deployment URL, not preview URL
- Test from multiple networks (verify no VPN requirement)
- Capture timing metrics via browser DevTools

---

### Task 4.2: Dual-Mode Integration Tests

**Priority**: P1

**Description**: Implement test suite verifying behavioral parity between stdio and in-process modes.

**Dependencies**: Task 2.4

**Files**:
- `tests/integration/adapter-parity.test.ts` (new)
- `tests/integration/vercel-mode.test.ts` (new)

**Acceptance Criteria**:
- [ ] `adapter-parity.test.ts` verifies:
  - Tool lists match between stdio and in-process
  - `create_note` produces identical structure (stdio vs in-process)
  - `list_notes` returns arrays with same schema
  - Error cases throw identical error messages
- [ ] `vercel-mode.test.ts` verifies:
  - With `VERCEL=1`, manager loads in-process adapters
  - With `VERCEL=undefined`, manager spawns stdio servers
  - Tool invocation succeeds in both modes
  - Initialization time <100ms for in-process mode
- [ ] All tests pass in CI
- [ ] Coverage report shows ≥90% coverage for adapter code

**Estimated Effort**: 2 hours

**Implementation Notes**:
- Use Vitest `beforeEach` to set/unset environment variables
- Reset `MCPServerManager` singleton between tests
- Spawn real stdio servers for parity tests (not mocks)

---

### Task 4.3: Update Documentation

**Priority**: P0

**Description**: Document deployment architecture, Vercel configuration, and troubleshooting in README.

**Dependencies**: Task 4.1

**Files**:
- `README.md` (modify — add Deployment section)
- `README.zh-CN.md` (modify — synchronize changes)

**Acceptance Criteria**:
- [ ] README includes Deployment section with:
  - Architecture explanation (dual-mode, in-process adapters)
  - State persistence behavior (ephemeral on Vercel)
  - "Deploy to Vercel" button
  - Troubleshooting steps (router unavailable, slow cold starts)
- [ ] Chinese README synchronized with English version
- [ ] Documentation explains when to use external MCP servers (production persistence)
- [ ] Example health check response included
- [ ] Vercel configuration rationale documented

**Estimated Effort**: 1.5 hours

**Implementation Notes**:
- Use Vercel's deploy button generator: https://vercel.com/docs/deploy-button
- Include link to Vercel Analytics for performance monitoring

---

### Task 4.4: Performance Benchmarking & Optimization

**Priority**: P2

**Description**: Measure and optimize cold start and warm function performance.

**Dependencies**: Task 4.1

**Acceptance Criteria**:
- [ ] Benchmark script measures:
  - Cold start latency (first request after deploy)
  - Warm function latency (10 consecutive requests)
  - Adapter initialization time (from logs)
  - Total query execution time (routing + tools)
- [ ] Results logged to `docs/performance.md`
- [ ] If p95 latency >5 seconds, investigate and optimize:
  - Lazy-load adapters only when needed
  - Cache router manifests across warm function invocations
  - Parallelize tool execution where possible
- [ ] Final results meet NFR-1 targets:
  - Cold start <3s
  - Warm function <500ms
  - Adapter init <100ms

**Estimated Effort**: 2 hours

**Implementation Notes**:
- Use `console.time()` / `console.timeEnd()` for internal timing
- Vercel Analytics provides p95 metrics; export and document
- If optimization needed, focus on adapter initialization first

---

## Summary

### Phase Overview

| Phase | Tasks | Estimated Effort | Critical Path |
|-------|-------|------------------|---------------|
| Phase 1: Investigation & Infrastructure | 3 (+ 1 conditional) | 3 hours (+ 3h if conditional) | Yes |
| Phase 2: Demo Server Adapters | 4 | 12.5 hours | Yes |
| Phase 3: Deployment Config & Health Check | 2 | 2 hours | Yes |
| Phase 4: Verification & Documentation | 4 | 7.5 hours | Partial (4.1, 4.3) |
| **Total (nominal)** | **13** | **25 hours** | - |
| **Total (if conditional Task 1.4 triggered)** | **14** | **28 hours** | - |

### Critical Path

1. Task 1.1 (Router investigation) — **MUST complete first** to determine if conditional Task 1.4 required
2. **IF Task 1.1 fails**: Task 1.4 (Router fallback) — **MUST complete before Phase 2**
3. Task 1.2, 1.3 (Env detection, adapter interface)
4. Tasks 2.1, 2.2, 2.3 (Adapter implementations with fixtures) — **Can parallelize**
5. Task 2.4 (Dual-mode manager)
6. Task 3.1, 3.2 (Vercel config, health check) — **Can parallelize with Task 2.4**
7. Task 4.1 (E2E deployment test) — **Critical blocker for submission**
8. Task 4.3 (Documentation) — **Critical blocker for submission**

### Parallelization Opportunities

- **After Task 1.3 completes**: Run Tasks 2.1, 2.2, 2.3 in parallel (3 separate adapter implementations)
- **While Phase 2 is in progress**: Run Task 3.1 (Vercel config) in parallel
- **After Task 2.4 completes**: Run Task 3.2 (health check) and Task 4.2 (tests) in parallel

### Risk Areas

1. **Router Vercel compatibility (Task 1.1)**: If router requires subprocess or fails cold start, **Task 1.4 becomes required** (+3 hours). **Mitigation**: Investigate early in Phase 1; allocate buffer time for fallback implementation.

2. **Cold start latency exceeding 3s target (Task 4.4)**: If adapter initialization + Next.js cold start combined >3s, may need further optimization. **Mitigation**: Profile early in Task 4.1; optimize adapter loading if needed.

3. **`.mjs` / TypeScript interop issues (Task 2.1-2.3)**: If TypeScript import of `.ts` from `.mjs` fails on Node.js <23.6, must document version requirement. **Mitigation**: Recommend `.mjs` core modules for maximum compatibility; verify local Node.js version.

4. **Adapter behavioral parity (Task 4.2)**: If in-process adapters produce different results than stdio versions, violates core design principle. **Mitigation**: Shared business logic (`*Core` classes in `.mjs`) enforces parity; extensive parity tests catch divergence.

5. **Vercel function timeout (10s)**: If routing + tool execution exceeds timeout, requests fail. **Mitigation**: Per-tool timeout guards (3s max), router timeout (2s), total budget 8s (2s buffer).

6. **Function-instance state confusion**: Users may expect state to persist across all requests, but it only persists within warm instance lifecycle. **Mitigation**: Document clearly in README; acceptable trade-off for demo purposes.

### Dependencies on Other Specs

- **router-core**: `MCPServerManager` base class must support dual-mode initialization (Task 2.4 extends this)
- **playground-chat**: API route must call `ensureServersInitialized()` before routing (inherits from existing design)
- **monster-lab-dashboard**: Health check data feeds dashboard (Task 3.2 provides `/api/health` endpoint)

---

## Traceability Matrix

| Task | Requirements Coverage | Design Components |
|------|----------------------|-------------------|
| Task 1.1 | Open Question 2 | Router compatibility investigation |
| Task 1.2 | FR-2.1 | `env.ts` environment detection |
| Task 1.3 | FR-1.2 | `InProcessMCPAdapter` interface |
| Task 1.4 | FR-7.1–7.3 (conditional) | Simplified routing fallback |
| Task 2.1 | FR-1.1–FR-1.7, FR-5.1–5.4 | `NotesCore` (.mjs), `NotesAdapter`, fixtures |
| Task 2.2 | FR-1.1–FR-1.7, FR-5.1–5.4 | `TasksCore` (.mjs), `TasksAdapter`, fixtures |
| Task 2.3 | FR-1.1–FR-1.7 | `CalculatorCore` (.mjs), `CalculatorAdapter` |
| Task 2.4 | FR-2.1–FR-2.6, FR-3.3 | `MCPServerManager` dual-mode |
| Task 3.1 | FR-4.1–FR-4.2 | `vercel.json` |
| Task 3.2 | FR-4.4 | `GET /api/health` (with init + ≥3 servers check) |
| Task 4.1 | NFR-4.1–NFR-4.3 | E2E deployment verification |
| Task 4.2 | NFR-3.3 | Adapter parity tests, Vercel mode tests |
| Task 4.3 | FR-6.1–FR-6.5 | README deployment section |
| Task 4.4 | NFR-1.1–NFR-1.3 | Performance benchmarking |
