# Monster Lab Dashboard — Task Breakdown

> **Feature**: Live dashboard visualizing per-turn routing decisions, schema trimming, and token savings  
> **Status**: Ready for implementation  
> **Author**: Kiro  
> **Date**: 2026-11-06  
> **Requirements**: [requirements.md](./requirements.md)  
> **Design**: [design.md](./design.md)

---

## Overview

This document breaks down the monster-lab-dashboard feature into discrete, testable tasks. Each task includes:
- **Description**: What needs to be built
- **Requirements Traceability**: Which requirements it satisfies
- **Acceptance Criteria**: How to verify completion
- **Dependencies**: Which tasks must be completed first
- **Estimated Effort**: T-shirt sizing (XS/S/M/L/XL)

**Note**: Several tasks involve **additive changes to router-core** (`TurnStatistics` extension, `ServerManifest` extension, `MCPServerManager` changes). These are router-core modifications implemented as part of dashboard work.

---

## Phase 1: Data Layer Extensions (Router-Core Additive Changes)

### Task 1.1: Extend TurnStatistics Type

**Description**: Add `toolFilter` and `reasoning` fields to `TurnStatistics` type in router-core.

**Acceptance Criteria**:
- [x] `src/lib/router/types.ts` updated with two new fields in `TurnStatistics`:
  - `toolFilter: { serverID: string; includedTools: string[] }[]` (required)
  - `reasoning?: string` (optional)
- [x] Type definition matches `RoutingDecision` shape for `toolFilter`
- [x] JSDoc comments added explaining fields
- [x] TypeScript compilation passes with no errors

**Requirements**: FR-1.2 (loaded tools display), FR-1.3 (trimmed tools display), FR-1.4 (reasoning display)

**Dependencies**: None (additive change to router-core)

**Effort**: XS (15 min)

---

### Task 1.2: Update computeTurnStats to Copy New Fields

**Description**: Modify `computeTurnStats` function in `src/lib/router/stats.ts` to copy `toolFilter` and `reasoning` from `RoutingDecision` into `TurnStatistics`.

**Acceptance Criteria**:
- [x] `computeTurnStats` function signature accepts `RoutingDecision` as input (or extracts fields from it)
- [x] Function copies `toolFilter` array from decision to turn stats (deep copy to avoid mutation)
- [x] Function copies optional `reasoning` field from decision to turn stats
- [x] Unit test: call `computeTurnStats` with mock decision → verify output contains both fields
- [x] Integration test: record real turn via `recordTurn` → verify `getSessionStats().turns[0]` contains `toolFilter` and `reasoning`

**Requirements**: FR-1.2, FR-1.3, FR-1.4

**Dependencies**: Task 1.1

**Effort**: S (30 min)

---

### Task 1.3: Extend ServerManifest Type

**Description**: Add `lastStatusChangeAt` and `lastError` fields to `ServerManifest` type in router-core.

**Acceptance Criteria**:
- [x] `src/lib/router/types.ts` updated with two new fields in `ServerManifest`:
  - `lastStatusChangeAt?: number` (timestamp in milliseconds)
  - `lastError?: string` (error message)
- [x] Fields marked as optional (backward compatible)
- [x] JSDoc comments explain purpose
- [x] TypeScript compilation passes

**Requirements**: FR-4.3 (error reason display), FR-4.4 (offline duration)

**Dependencies**: None (additive change to router-core)

**Effort**: XS (10 min)

---

### Task 1.4: Update MCPServerManager to Track Status Changes

**Description**: Modify `MCPServerManager` in `src/lib/mcp/server-manager.ts` to record timestamps and errors when server status changes.

**Acceptance Criteria**:
- [x] Internal server tracking structure stores `lastStatusChangeAt` timestamp
- [x] When server status flips (e.g., connected → error), `lastStatusChangeAt` is set to `Date.now()`
- [x] Internal server tracking structure stores `lastError` string
- [x] When connection or health check fails, `lastError` is set to error message
- [x] `getServerManifests()` method returns manifests with both fields populated
- [x] `runHealthCheckRound()` method is public (or made public if private)
- [x] Unit test: flip server status → verify `lastStatusChangeAt` updated
- [x] Unit test: simulate connection failure → verify `lastError` contains message
- [x] Integration test: kill demo server subprocess → verify manifest reflects error and timestamp

**Requirements**: FR-4.2 (fast disconnect detection), FR-4.3, FR-4.4, AC-4 (10s detection bound)

**Dependencies**: Task 1.3

**Effort**: M (2 hours)

---

## Phase 2: API Routes

### Task 2.1: Implement /api/lab/session-stats Route

**Description**: Create API route that returns `getSessionStats()` output for client polling.

**Acceptance Criteria**:
- [x] File `src/app/api/lab/session-stats/route.ts` created
- [x] `GET` handler calls `getSessionStats()` and returns JSON response
- [x] Response structure: `{ stats: SessionStatistics }`
- [x] Error handling: if `getSessionStats()` throws, return 500 with error message
- [x] Manual test: `curl http://localhost:3000/api/lab/session-stats` returns valid JSON
- [x] Unit test: mock `getSessionStats()` to return mock data → verify API returns same data
- [x] Unit test: mock `getSessionStats()` to throw error → verify API returns 500

**Requirements**: FR-3.1 to FR-3.6 (session aggregates), Design Decision 2 (polling)

**Dependencies**: Task 1.2 (extended TurnStatistics)

**Effort**: S (30 min)

---

### Task 2.2: Implement /api/lab/server-status Route

**Description**: Create API route that actively checks server health and returns manifests.

**Acceptance Criteria**:
- [x] File `src/app/api/lab/server-status/route.ts` created
- [x] `GET` handler calls `MCPServerManager.getInstance()`
- [x] Handler calls `manager.runHealthCheckRound()` before returning manifests (active health check)
- [x] Handler calls `manager.getServerManifests()` and returns JSON response
- [x] Response structure: `{ manifests: ServerManifest[] }`
- [x] Error handling: if manager throws, return 500 with error message
- [x] Manual test: `curl http://localhost:3000/api/lab/server-status` returns manifests with timestamps
- [x] Integration test: kill demo server → call API → verify manifest shows error + timestamp within 10s

**Requirements**: FR-4.1 (server status display), FR-4.2 (status change detection), AC-4 (10s detection)

**Dependencies**: Task 1.4 (manager status tracking)

**Effort**: S (30 min)

---

## Phase 3: UI Components (Pure/Reusable)

### Task 3.1: Implement MetricCard Component

**Description**: Create reusable metric display component for large numbers with color coding.

**Acceptance Criteria**:
- [x] File `src/app/lab/components/MetricCard.tsx` created
- [x] Props: `label`, `value`, `unit`, `description`, `color`, optional `prefix`
- [x] Color prop supports: `green`, `purple`, `cyan`, `yellow`
- [x] Renders large number (`text-4xl font-bold`) with semantic color
- [x] Renders label, unit, and description with Tailwind classes
- [x] Component tests: verify each color class applied correctly
- [x] Component tests: verify prefix displayed when provided
- [x] Component tests: verify number formatted with `toLocaleString()`

**Requirements**: FR-5.2 (prominent metrics), NFR-3.1 (clarity)

**Dependencies**: None

**Effort**: S (45 min)

---

### Task 3.2: Implement ServerStatusBadge Component

**Description**: Create status indicator component with icon and color coding.

**Acceptance Criteria**:
- [x] File `src/app/lab/components/ServerStatusBadge.tsx` created
- [x] Props: `status: ServerStatus`
- [x] Renders icon + label: 🟢 Connected (green), 🟡 Starting (yellow), 🔴 Error/Offline (red)
- [x] Uses semantic Tailwind color classes
- [x] Component tests: verify each status renders correct icon and color
- [x] Component tests: verify disconnected and error both show red

**Requirements**: FR-4.1 (server status display), FR-5.5 (semantic colors)

**Dependencies**: None

**Effort**: XS (20 min)

---

### Task 3.3: Implement ErrorFallback Component

**Description**: Create graceful error display for statistics failures.

**Acceptance Criteria**:
- [x] File `src/app/lab/components/ErrorFallback.tsx` created
- [x] Props: optional `error: Error`
- [x] Renders "⚠️ Stats Unavailable" heading with red styling
- [x] Renders user-friendly message: "Unable to load routing statistics. Please check server logs."
- [x] In development mode (`process.env.NODE_ENV === 'development'`), shows error details in collapsible `<details>`
- [x] In production mode, hides error details
- [x] Component tests: verify "Stats unavailable" always displayed
- [x] Component tests: verify error details shown only in dev mode

**Requirements**: FR-2.6 (stats failure display), NFR-2.1 (error handling)

**Dependencies**: None

**Effort**: S (30 min)

---

## Phase 4: Dashboard Layout & Main Page

### Task 4.1: Implement Lab Page Layout

**Description**: Create main dashboard page with server-side initial data fetch.

**Acceptance Criteria**:
- [x] File `src/app/lab/page.tsx` created as Server Component
- [x] Server-side calls `getSessionStats()` and `MCPServerManager.getInstance().getServerManifests()`
- [x] Try/catch wrapper handles `getSessionStats()` errors gracefully
- [x] If stats error, renders `<ErrorFallback error={error} />`
- [x] If stats succeed, passes `initialStats` to `<StatsPanel>` and `initialTurns` to `<TurnHistoryPanel>`
- [x] Always renders `<ServerHealthPanel initialManifests={manifests} />`
- [x] Header: "🧪 Monster Lab Dashboard" with green accent
- [x] Dark theme background (`bg-gray-950`)
- [ ] Manual test: navigate to `/lab` → page loads without crash
- [x] Integration test: mock `getSessionStats()` error → verify ErrorFallback shown

**Requirements**: FR-5.1 (dark theme), AC-1 (navigate to /lab), NFR-2.1 (error handling)

**Dependencies**: Task 3.3 (ErrorFallback)

**Effort**: S (1 hour)

---

## Phase 5: Statistics Display Components

### Task 5.1: Implement StatsPanel Component

**Description**: Create client component that displays session aggregates with auto-refresh.

**Acceptance Criteria**:
- [x] File `src/app/lab/components/StatsPanel.tsx` created as Client Component (`"use client"`)
- [x] Props: `initialStats: SessionStatistics`
- [x] State: `stats` initialized from `initialStats`
- [x] `useEffect` polls `/api/lab/session-stats` every 5 seconds
- [x] On poll success, updates `stats` state
- [x] On poll failure, sets `pollError` state and displays warning banner
- [x] Renders 4 `<MetricCard>` components: Tools Loaded, Tools Trimmed, Tokens Saved, Avg Time
- [x] Responsive grid: 1 col mobile, 2 col tablet, 4 col desktop
- [x] Component test: verify initial stats displayed correctly
- [x] Component test: mock fetch to return updated stats → verify state updated
- [x] Component test: mock fetch error → verify warning banner shown

**Requirements**: FR-3.1 to FR-3.6 (session aggregates), NFR-1.2 (updates within 500ms of poll)

**Dependencies**: Task 2.1 (API route), Task 3.1 (MetricCard), Task 4.1 (Lab page)

**Effort**: M (1.5 hours)

---

### Task 5.2: Implement TurnHistoryPanel Component

**Description**: Create client component that displays scrollable turn list with auto-refresh.

**Acceptance Criteria**:
- [x] File `src/app/lab/components/TurnHistoryPanel.tsx` created as Client Component
- [x] Props: `initialTurns: TurnStatistics[]`
- [x] State: `turns` initialized from `initialTurns`
- [x] `useEffect` polls `/api/lab/session-stats` every 5 seconds, updates `turns` from `stats.turns`
- [x] Displays most recent 20 turns, newest first (reverse slice)
- [x] If `turns.length === 0`, shows empty state message: "No routing decisions yet..."
- [x] Renders each turn as `<TurnCard>` in scrollable container (`max-h-[600px] overflow-y-auto`)
- [x] Header shows total turn count with correct singular/plural label
- [x] Component test: empty turns → verify empty state message
- [x] Component test: 25 turns → verify only 20 displayed
- [x] Component test: 1 turn → verify "1 turn" not "1 turns"

**Requirements**: FR-6.1 to FR-6.5 (turn history), NFR-3.2 (empty state)

**Dependencies**: Task 2.1 (API route), Task 4.1 (Lab page)

**Effort**: M (1.5 hours)

---

### Task 5.3: Implement TurnCard Component

**Description**: Create expandable turn detail component with tool lists and reasoning.

**Acceptance Criteria**:
- [x] File `src/app/lab/components/TurnCard.tsx` created as Client Component
- [x] Props: `turn: TurnStatistics`, optional `allServerTools: Map<string, string[]>`
- [x] State: `expanded` boolean for expand/collapse
- [x] Collapsed view shows: timestamp, intent preview (first 50 chars), selected servers, key metrics
- [x] Click toggles `expanded` state
- [x] Expanded view shows: full intent, per-server tool lists (loaded + trimmed), reasoning
- [x] For each server in `turn.toolFilter`:
  - Display server ID
  - Display loaded tools (✓ green) from `includedTools`
  - Compute trimmed tools: `allServerTools.get(serverID)` minus `includedTools`
  - Display trimmed tools (✗ purple, line-through, opacity-60)
- [x] If `turn.reasoning` exists, display reasoning text in italic
- [x] Component test: click to expand → verify expanded content shown
- [x] Component test: intent >50 chars → verify truncated in collapsed view
- [x] Component test: turn with `toolFilter` → verify loaded/trimmed lists rendered correctly
- [x] Component test: turn with `reasoning` → verify reasoning displayed
- [x] Component test: turn without `toolFilter` or `reasoning` → no crash, graceful fallback

**Requirements**: FR-1.1 to FR-1.6 (per-turn visualization), FR-6.2 to FR-6.4 (turn details)

**Dependencies**: Task 1.2 (extended TurnStatistics), Task 5.2 (TurnHistoryPanel)

**Effort**: M (2 hours)

---

## Phase 6: Server Health Monitoring

### Task 6.1: Implement ServerHealthPanel Component

**Description**: Create client component that displays real-time server health with active polling.

**Acceptance Criteria**:
- [ ] File `src/app/lab/components/ServerHealthPanel.tsx` created as Client Component
- [ ] Props: `initialManifests: ServerManifest[]`
- [ ] State: `manifests` initialized from `initialManifests`, `pollError` for errors
- [ ] `useEffect` polls `/api/lab/server-status` every 5 seconds
- [ ] On poll success, updates `manifests` state
- [ ] On poll failure, sets `pollError` and displays yellow warning banner
- [ ] Function `formatOfflineDuration(lastChangeAt)` computes "Xm Ys" from timestamp
- [ ] For each manifest:
  - Renders `<ServerStatusBadge status={manifest.status} />`
  - Renders server name (monospace font)
  - If connected: shows tool count
  - If error/disconnected: shows `lastError || 'Connection failed'` + offline duration
  - If starting: shows "Starting..."
- [ ] If all servers offline: shows red warning banner "⚠️ All servers offline — cannot route requests"
- [ ] Component test: all servers offline → verify warning banner shown
- [ ] Component test: manifest with `lastStatusChangeAt` → verify offline duration computed correctly
- [ ] Component test: manifest with `lastError` → verify error message displayed
- [ ] Component test: poll error → verify error banner shown, last known state preserved

**Requirements**: FR-4.1 to FR-4.6 (server health), AC-4 (10s detection), NFR-2.2 (poll retry)

**Dependencies**: Task 2.2 (API route), Task 3.2 (ServerStatusBadge), Task 4.1 (Lab page)

**Effort**: L (2.5 hours)

---

## Phase 7: Integration & Testing

### Task 7.1: Real-Data Integration Test

**Description**: End-to-end test that records real turns and verifies dashboard displays exact matching numbers.

**Acceptance Criteria**:
- [ ] Test file `tests/integration/lab-real-data.test.ts` created
- [ ] Test spawns 3 demo MCP servers (notes, tasks, calculator)
- [ ] Test records 3 real routing turns using actual `routeIntent` and `recordTurn` (or `computeTurnStats`)
- [ ] Test does NOT use mocks; uses real `getSessionStats()` output
- [ ] Test renders `/lab` page (or calls API routes)
- [ ] Test extracts displayed numbers from rendered output
- [ ] Test asserts: `displayedToolsLoaded === getSessionStats().totalToolsLoaded`
- [ ] Test asserts: `displayedToolsTrimmed === getSessionStats().totalToolsTrimmed`
- [ ] Test asserts: `displayedTokensSaved === getSessionStats().totalTokensSaved`
- [ ] Test asserts: `displayedAvgTime === getSessionStats().averageRoutingTimeMs`
- [ ] Test passes consistently (no flakes)
- [ ] Test teardown: terminate all subprocesses, verify clean shutdown

**Requirements**: NFR-4.1 (real data test), AC-7 (displayed numbers match source)

**Dependencies**: Task 5.1 (StatsPanel), Task 1.2 (extended TurnStatistics), router-core Task 7.1 (E2E routing)

**Effort**: L (3 hours)

---

### Task 7.2: Component Unit Tests

**Description**: Comprehensive unit tests for all dashboard components.

**Acceptance Criteria**:
- [ ] Test file `tests/unit/lab-components.test.ts` created (or separate files per component)
- [ ] MetricCard tests: verify color classes, prefix, number formatting
- [ ] ServerStatusBadge tests: verify each status icon and color
- [ ] ErrorFallback tests: verify "Stats unavailable" shown, dev/prod mode handling
- [ ] StatsPanel tests: verify initial stats, polling updates, error banner
- [ ] TurnHistoryPanel tests: verify empty state, 20-turn limit, singular/plural labels
- [ ] TurnCard tests: verify expand/collapse, tool lists, reasoning, truncation
- [ ] ServerHealthPanel tests: verify offline warning, duration formatting, error display
- [ ] All tests pass with ≥90% coverage on component logic

**Requirements**: NFR-4.2 (failure state testing), NFR-4.3 (server status testing)

**Dependencies**: All Phase 3-6 tasks (all components)

**Effort**: L (3 hours)

---

### Task 7.3: API Route Tests

**Description**: Unit tests for both API routes.

**Acceptance Criteria**:
- [ ] Test file `tests/unit/lab-api-routes.test.ts` created
- [ ] Test `/api/lab/session-stats`:
  - Mock `getSessionStats()` to return mock data → verify JSON response matches
  - Mock `getSessionStats()` to throw error → verify 500 response with error message
- [ ] Test `/api/lab/server-status`:
  - Mock `MCPServerManager` methods → verify `runHealthCheckRound()` called before `getServerManifests()`
  - Mock `runHealthCheckRound()` to simulate status changes → verify manifests reflect changes
  - Mock manager to throw error → verify 500 response
- [ ] All tests pass consistently

**Requirements**: FR-3.6 (real aggregates), FR-4.6 (real server status)

**Dependencies**: Task 2.1, Task 2.2 (both API routes)

**Effort**: M (1.5 hours)

---

### Task 7.4: Acceptance Criteria Validation

**Description**: Verify all acceptance criteria from requirements.md are met.

**Acceptance Criteria**:
- [ ] AC-1: User can navigate to `/lab` and see dashboard (even with zero turns) → manual test
- [ ] AC-2: After submitting query in Playground, refresh `/lab` shows new turn stats → manual test
- [ ] AC-3: Dashboard displays accurate server health (3 demo servers "connected" on first load) → manual test
- [ ] AC-4: Manually disconnect server → dashboard shows "disconnected" or "error" within 10s → manual test with stopwatch
- [ ] AC-5: Simulate `getSessionStats()` error → dashboard shows "Stats unavailable" → unit test (Task 7.2)
- [ ] AC-6: Visual design uses dark theme with lab aesthetics → manual visual inspection
- [ ] AC-7: Displayed numbers match `getSessionStats()` output → integration test (Task 7.1)
- [ ] Checklist document created summarizing validation results

**Requirements**: All AC-* from requirements.md

**Dependencies**: Task 7.1, Task 7.2 (all tests), all implementation tasks

**Effort**: S (1 hour)

---

## Phase 8: Documentation & Polish

### Task 8.1: Component Documentation

**Description**: Add JSDoc comments and usage examples to all components.

**Acceptance Criteria**:
- [ ] JSDoc comments added to all component props interfaces
- [ ] Each component file includes brief purpose comment at top
- [ ] README file `src/app/lab/components/README.md` created with overview of all components
- [ ] Code examples included for MetricCard, ServerStatusBadge, ErrorFallback (reusable components)

**Requirements**: Military Rule 3 (exhaustive docs)

**Dependencies**: All Phase 3-6 tasks

**Effort**: S (1 hour)

---

### Task 8.2: Performance Validation

**Description**: Verify NFR-1 performance targets are met.

**Acceptance Criteria**:
- [ ] Benchmark test: call `getSessionStats()` with 1000 turns → completes within 100ms (NFR-1.1)
- [ ] Manual test: submit query in Playground → measure time until `/lab` shows new turn after next poll → ≤500ms after poll (NFR-1.2)
- [ ] Benchmark results logged to console (not hard-coded in docs)
- [ ] If targets not met, document actual performance and file issue for optimization

**Requirements**: NFR-1.1 (stats computation speed), NFR-1.2 (UI update latency)

**Dependencies**: Task 5.1, Task 5.2 (polling components)

**Effort**: S (1 hour)

---

## Summary

**Total Tasks**: 20  
**Total Estimated Effort**: ~25 hours  
**Critical Path**: 1.1 → 1.2 → 2.1 → 4.1 → 5.1 → 5.2 → 7.1 → 7.4

**Parallelization Opportunities**:
- Phase 1 tasks (1.1, 1.3) can be done in parallel (both are type definitions)
- Phase 3 tasks (3.1, 3.2, 3.3) can be done in parallel (independent components)
- Phase 2 tasks (2.1, 2.2) can be done in parallel (independent API routes)
- Phase 5 tasks (5.1, 5.2) can start as soon as their direct dependencies are done

**Risk Areas**:
1. **Task 1.4 (MCPServerManager changes)**: Modifying router-core's server manager is complex; ensure backward compatibility
2. **Task 7.1 (Real-data integration test)**: Requires full router-core + dashboard stack; may uncover integration issues late
3. **Task 6.1 (ServerHealthPanel)**: Polling logic + offline duration computation has edge cases (clock skew, rapid status flips)

---

## Traceability Matrix

| Task | Requirements | Acceptance Criteria | Router-Core Additive? |
|------|--------------|---------------------|----------------------|
| 1.1 | FR-1.2, FR-1.3, FR-1.4 | — | Yes (types.ts) |
| 1.2 | FR-1.2, FR-1.3, FR-1.4 | — | Yes (stats.ts) |
| 1.3 | FR-4.3, FR-4.4 | — | Yes (types.ts) |
| 1.4 | FR-4.2, FR-4.3, FR-4.4, AC-4 | — | Yes (server-manager.ts) |
| 2.1 | FR-3.1–FR-3.6, Design Decision 2 | — | No |
| 2.2 | FR-4.1, FR-4.2, AC-4 | — | No |
| 3.1 | FR-5.2, NFR-3.1 | — | No |
| 3.2 | FR-4.1, FR-5.5 | — | No |
| 3.3 | FR-2.6, NFR-2.1 | — | No |
| 4.1 | FR-5.1, AC-1, NFR-2.1 | AC-1 | No |
| 5.1 | FR-3.1–FR-3.6, NFR-1.2 | — | No |
| 5.2 | FR-6.1–FR-6.5, NFR-3.2 | — | No |
| 5.3 | FR-1.1–FR-1.6, FR-6.2–FR-6.4 | — | No |
| 6.1 | FR-4.1–FR-4.6, AC-4, NFR-2.2 | AC-3, AC-4 | No |
| 7.1 | NFR-4.1, AC-7 | AC-2, AC-7 | No |
| 7.2 | NFR-4.2, NFR-4.3 | AC-5 | No |
| 7.3 | FR-3.6, FR-4.6 | — | No |
| 7.4 | All AC-* | All AC-* | No |
| 8.1 | Military Rule 3 | — | No |
| 8.2 | NFR-1.1, NFR-1.2 | — | No |

---

## Changes from Previous Versions

_Initial version._
