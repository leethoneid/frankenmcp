# Playground Chat — Task Breakdown

> **Feature**: User-facing chat interface for natural language queries with real-time routing transparency  
> **Status**: Ready for implementation  
> **Author**: Kiro  
> **Date**: 2026-11-06  
> **Requirements**: [requirements.md](./requirements.md)  
> **Design**: [design.md](./design.md)

---

## Overview

This document breaks down the playground-chat feature into discrete, testable tasks. Each task includes:
- **Description**: What needs to be built
- **Requirements Traceability**: Which requirements it satisfies
- **Acceptance Criteria**: How to verify completion
- **Dependencies**: Which tasks must be completed first
- **Estimated Effort**: T-shirt sizing (XS/S/M/L/XL)

**Note**: This feature **reuses existing router-core and stats infrastructure** with no modifications to router-core behavior.

---

## Phase 1: Foundation & Pure Components

### Task 1.1: Define Conversation Types

**Description**: Define TypeScript types for conversation state management.

**Acceptance Criteria**:
- [x] File `src/app/playground/types.ts` created
- [x] `Turn` interface defined with fields: id, timestamp, userQuery, routing, toolResults, error
- [x] `routing` subtype includes: selectedServers, toolsLoaded, toolsTrimmed, estimatedTokensSaved, reasoning
- [x] `toolResults` array type includes: serverID, toolName, status ('success' | 'error'), result, error
- [x] Types exported for use in components
- [x] TypeScript compilation passes

**Requirements**: Infrastructure for FR-4 (conversation history)

**Dependencies**: None

**Effort**: XS (15 min)

---

### Task 1.2: Implement ErrorMessage Component

**Description**: Create error display component for tool failures and routing errors.

**Acceptance Criteria**:
- [x] File `src/app/playground/components/ErrorMessage.tsx` created
- [x] Props: `message: string`
- [x] Renders red-bordered box with error icon and message
- [x] Styling: `border-red-700/50 bg-red-900/10 text-red-300`
- [x] Component test: verify message displayed with correct styling

**Requirements**: NFR-2.1 (error display)

**Dependencies**: None

**Effort**: XS (15 min)

---

### Task 1.3: Implement LoadingIndicator Component

**Description**: Create loading spinner component for async operations.

**Acceptance Criteria**:
- [x] File `src/app/playground/components/LoadingIndicator.tsx` created
- [x] Props: `message?: string` (e.g., "Routing...", "Executing tools...")
- [x] Renders spinning icon + optional message
- [x] Styling: purple accent consistent with Playground theme
- [x] Component test: verify spinner and message displayed

**Requirements**: FR-2.1 (loading indicator during routing)

**Dependencies**: None

**Effort**: XS (20 min)

---

### Task 1.4: Implement RoutingStatsCard Component

**Description**: Create component to display routing decision summary.

**Acceptance Criteria**:
- [x] File `src/app/playground/components/RoutingStatsCard.tsx` created
- [x] Props: `routing` object with selectedServers, toolsLoaded, toolsTrimmed, estimatedTokensSaved, reasoning
- [x] Displays servers (purple), loaded (green), trimmed (purple), saved (cyan) with color coding
- [x] Optional reasoning displayed in italic text
- [x] Component tests: verify all fields displayed, verify color classes
- [x] Component tests: verify reasoning shown when present, hidden when absent

**Requirements**: FR-2.2 to FR-2.6 (routing decision display)

**Dependencies**: Task 1.1 (types)

**Effort**: S (45 min)

---

### Task 1.5: Implement ToolResultCard Component

**Description**: Create component to display individual tool execution result.

**Acceptance Criteria**:
- [x] File `src/app/playground/components/ToolResultCard.tsx` created as Client Component
- [x] Props: `result` object with serverID, toolName, status, result, error
- [x] Success: green border, JSON pretty-printed result
- [x] Error: red border, error message displayed
- [x] Long results (>500 chars): collapsible with "Show more" button
- [x] State: `expanded` boolean for collapse/expand
- [x] Component tests: success result, error result, collapsible behavior
- [x] Component tests: verify border color based on status

**Requirements**: FR-3.3 (display tool results), FR-3.4 (display tool errors), NFR-3.3 (collapsible long results)

**Dependencies**: Task 1.1 (types)

**Effort**: M (1.5 hours)

---

### Task 1.6: Implement WelcomeMessage Component

**Description**: Create empty state component with example queries.

**Acceptance Criteria**:
- [x] File `src/app/playground/components/WelcomeMessage.tsx` created
- [x] Props: `onExampleClick: (query: string) => void`
- [x] Displays welcome heading and value proposition (one sentence)
- [x] Displays 3 example queries: one for notes, one for tasks, one for calculator
- [x] Each example shows query text and which server it routes to
- [x] Clicking example calls `onExampleClick` with query text (does NOT auto-submit)
- [x] Component tests: verify 3 examples rendered
- [x] Component tests: click example → verify callback called with correct query

**Requirements**: FR-7.1 to FR-7.4 (example queries & onboarding)

**Dependencies**: None

**Effort**: S (1 hour)

---

## Phase 2: Input & Conversation Display

### Task 2.1: Implement InputBar Component

**Description**: Create text input component with validation and submit handling.

**Acceptance Criteria**:
- [x] File `src/app/playground/components/InputBar.tsx` created as Client Component
- [x] Props: `onSubmit: (query: string) => Promise<void>`, `disabled: boolean`
- [x] Controlled input with local state
- [x] Submit on Enter key (Shift+Enter adds newline if multi-line input in future)
- [x] Validation: empty query → show error "Please enter a query"
- [x] Validation: query >1000 chars → show error "Query too long (max 1000 characters)"
- [x] On successful submit: call `onSubmit`, clear input field
- [x] While `disabled=true`: input and button grayed out, not clickable
- [x] Component tests: valid submit, empty submit, long submit, disabled state

**Requirements**: FR-1.1 to FR-1.5 (query submission), AC-1 (input field visible)

**Dependencies**: None

**Effort**: M (1.5 hours)

---

### Task 2.2: Implement TurnDisplay Component

**Description**: Create component to display a single conversation turn.

**Acceptance Criteria**:
- [x] File `src/app/playground/components/TurnDisplay.tsx` created
- [x] Props: `turn: Turn` (from types)
- [x] Displays user query with emoji (🙋) and timestamp
- [x] If `turn.routing` exists: renders `<RoutingStatsCard routing={turn.routing} />`
- [x] If `turn.toolResults` exists: renders list of `<ToolResultCard>` for each result
- [x] If `turn.error` exists: renders `<ErrorMessage message={turn.error} />`
- [x] Visual sections clearly separated (borders or background colors)
- [x] Component tests: turn with routing only, turn with results, turn with error

**Requirements**: FR-4.3 (display turn components), FR-4.5 (visually distinct sections)

**Dependencies**: Task 1.1 (types), Task 1.2 (ErrorMessage), Task 1.4 (RoutingStatsCard), Task 1.5 (ToolResultCard)

**Effort**: M (1.5 hours)

---

### Task 2.3: Implement ConversationHistory Component

**Description**: Create scrollable list of turns with auto-scroll.

**Acceptance Criteria**:
- [x] File `src/app/playground/components/ConversationHistory.tsx` created as Client Component
- [x] Props: `turns: Turn[]`, `onExampleClick: (query: string) => void`
- [x] If `turns.length === 0`: renders `<WelcomeMessage onExampleClick={onExampleClick} />`
- [x] If `turns.length > 0`: renders scrollable list with each `<TurnDisplay turn={turn} />`
- [x] Auto-scroll to bottom when new turn added (using `useEffect` + `scrollIntoView`)
- [x] Scroll container: `overflow-y-auto` with sufficient height
- [x] Component tests: empty state, non-empty state, auto-scroll behavior
- [x] Integration test: add turn programmatically → verify scroll position at bottom

**Requirements**: FR-4.1 (scrollable history), FR-4.2 (append new turns), FR-7.1 (welcome message when empty)

**Dependencies**: Task 1.6 (WelcomeMessage), Task 2.2 (TurnDisplay)

**Effort**: M (1.5 hours)

---

## Phase 3: Server-Side Infrastructure

### Task 3.1: Implement Server Initialization Module

**Description**: Create lazy singleton module for server initialization.

**Acceptance Criteria**:
- [x] File `src/lib/server/init.ts` created (server-only module)
- [x] Function `ensureServersInitialized()` checks `initialized` flag
- [x] If not initialized:
  - Calls `MCPServerManager.getInstance()`
  - Calls `manager.loadAndRegisterConfig('.kiro/settings/mcp.json')`
  - Calls `await manager.connectAll()`
  - Sets `initialized = true`
- [x] If already initialized, returns immediately (no-op)
- [x] Function is idempotent (safe to call multiple times)
- [x] Unit test: first call initializes servers, second call is no-op
- [x] Integration test: call from API route, verify servers connected

**Requirements**: Server initialization, FR-6.2 (verify demo servers connected)

**Dependencies**: router-core Task 2.2 (MCPServerManager), router-core Task 2.3 (loadAndRegisterConfig)

**Effort**: S (1 hour)

---

### Task 3.2: Implement Tool Argument Extraction Module

**Description**: Create server-side module with hardcoded regex patterns for extracting tool arguments from queries.

**Acceptance Criteria**:
- [x] File `src/lib/server/extractToolArguments.ts` created (server-only module)
- [x] Function `extractToolArguments(query: string, toolName: string, serverID: string): Record<string, any> | null`
- [x] **Notes server patterns**:
  - `create_note`: match "Add/create a note about/titled X" → `{title: X, content: X}`
  - `list_notes`: return `{}`
  - Other note tools: return `null` (ID extraction not demo-ready)
- [x] **Tasks server patterns**:
  - `create_task`: match "Add/create task X" → `{title: X, priority: 'medium'}`
  - `list_tasks`: return `{}`
  - Other task tools: return `null`
- [x] **Calculator server patterns**:
  - `add`: match "A + B" → `{a: parseFloat(A), b: parseFloat(B)}`
  - `subtract`: match "A - B" → `{a: parseFloat(A), b: parseFloat(B)}`
  - `multiply`: match "A * B" or "A × B" → `{a, b}`
  - `divide`: match "A / B" or "A ÷ B" → `{a, b}`
- [x] If no pattern matches, return `null`
- [x] Unit tests: each pattern with matching query → verify correct args
- [x] Unit tests: each pattern with non-matching query → verify `null`
- [x] Unit tests: calculator with various number formats (int, float)

**Requirements**: FR-3.1 (derive arguments), FR-3.2 (no pattern match error), AC-2 (note extraction), AC-3 (calculator extraction)

**Dependencies**: None

**Effort**: M (2.5 hours)

---

### Task 3.3: Implement Playground Chat API Route

**Description**: Create server-side API route that performs routing, tool execution, and returns completed turn.

---

**Acceptance Criteria**:
- [x] File `src/app/api/playground/chat/route.ts` created
- [x] `POST` handler accepts `{ query: string }` from request body
- [x] Validation: empty query → return 400 with error message
- [x] Calls `await ensureServersInitialized()` (Task 3.1)
- [x] Calls `MCPServerManager.getInstance().getServerManifests()`
- [x] Filters manifests to `status === 'connected'` only
- [x] If zero connected servers → return 503 with "All servers offline" error
- [x] Tracks disconnected servers for warnings
- [x] Calls `routeIntent(query, connectedManifests)` (auto-records turn internally)
- [x] Calls `getSessionStats()` to retrieve last recorded turn
- [x] For each tool in `decision.toolFilter`:
  - Calls `extractToolArguments(query, toolName, serverID)` (Task 3.2)
  - If args is `null`: records error "Unable to extract arguments for [tool]"
  - If args exists: calls `manager.invokeToolCall(serverID, toolName, args)` (sequential)
  - On success: push `{serverID, toolName, status: 'success', result}` to toolResults
  - On error: push `{serverID, toolName, status: 'error', error: message}` to toolResults
- [x] Builds `Turn` response object with routing stats from recorded turn and tool results
- [x] Includes `warnings` array if disconnected servers exist
- [x] Returns JSON response with Turn object
- [x] Error handling: catches all errors, returns 500 with error message
- [x] Unit test: valid query → verify Turn returned with routing + results
- [x] Unit test: empty query → verify 400 error
- [x] Unit test: all servers offline → verify 503 error
- [x] Unit test: no arg pattern match → verify tool error in results
- [x] Integration test: real query with demo servers → verify complete Turn

**Requirements**: FR-2.1 to FR-2.8 (routing), FR-3.1 to FR-3.8 (tool execution), FR-5.1 to FR-5.4 (turn recording), FR-6.4 (disconnected warning)

**Dependencies**: Task 3.1 (server init), Task 3.2 (arg extraction), router-core routing + stats

**Effort**: L (4 hours)

---

### Task 3.4: Implement ChatContainer Component

**Description**: Create client-side orchestration component that submits queries to API and displays conversation.

**Acceptance Criteria**:
- [x] File `src/app/playground/components/ChatContainer.tsx` created as Client Component
- [x] State: `turns: Turn[]`, `isProcessing: boolean`, `currentError: string | null`
- [x] Function `handleSubmit(query: string)`:
  - Set `isProcessing = true`
  - POST to `/api/playground/chat` with `{ query }`
  - If response OK: parse Turn JSON, append to `turns` array
  - If response error: create error turn with error message, append to turns
  - If error includes "Router unavailable": set `currentError` for banner
  - Catch network errors: create error turn
  - Set `isProcessing = false`
- [x] Function `handleExampleClick(query: string)`:
  - Populate input field (via callback to InputBar)
  - Do NOT auto-submit
- [x] Renders: `<ConversationHistory>` and `<InputBar>`
- [x] If `currentError` is set: display prominent red banner at top
- [x] Component tests: successful API response, API error, network error
- [x] Component tests: RouterUnavailable error → verify banner shown
- [x] Integration test: call API route, verify turn appended to state

**Requirements**: FR-2.1 to FR-2.8 (routing flow via API), FR-4.1 to FR-4.5 (conversation history), NFR-2.3 (router crash handling)

**Dependencies**: Task 2.1 (InputBar), Task 2.3 (ConversationHistory), Task 3.3 (API route)

**Effort**: M (2.5 hours)

---

## Phase 4: Page Layout

### Task 4.1: Implement Playground Page

**Description**: Create main Playground page with header and ChatContainer.

**Acceptance Criteria**:
- [x] File `src/app/playground/page.tsx` created as Client Component
- [x] Page structure: header with title (🎮 Playground) and subtitle, main area with `<ChatContainer>`
- [x] Header styling: `border-b border-purple-900/30`, purple accent colors
- [x] Main area height: `h-[calc(100vh-120px)]` to allow full-screen chat
- [x] Dark theme background: `bg-gray-950 text-gray-100`
- [x] Manual test: navigate to `/playground` → page loads with input field and welcome message
- [x] Manual test: verify header and layout on desktop and mobile (375px width)

**Requirements**: FR-6.1 (zero config), AC-1 (navigate to /playground)

**Dependencies**: Task 3.4 (ChatContainer)

**Effort**: S (30 min)

---

## Phase 5: Error Handling & Edge Cases

### Task 5.1: Implement NoRelevantToolsError Handling

**Description**: Ensure `NoRelevantToolsError` from API is displayed gracefully.

**Acceptance Criteria**:
- [x] API route (Task 3.3) already catches `NoRelevantToolsError` and returns error response
- [x] `ChatContainer.handleSubmit` creates error turn from API error response
- [x] Integration test: mock `routeIntent` in API to throw `NoRelevantToolsError` → verify error displayed in turn

**Requirements**: FR-2.7 (no relevant tools error), AC-6 (query with no tools)

**Dependencies**: Task 3.3 (API route), Task 3.4 (ChatContainer)

**Effort**: XS (15 min - verification only, logic in API route)

---

### Task 5.2: Implement RouterUnavailableError Handling

**Description**: Handle `RouterUnavailableError` by displaying prominent banner and disabling input.

**Acceptance Criteria**:
- [x] API route returns 500 with "Router unavailable" error message
- [x] `ChatContainer.handleSubmit` checks error message for "Router unavailable"
- [x] If detected, sets `currentError` state
- [x] Banner displayed at top of page: red background, prominent text, "Router unavailable. Please restart the application."
- [x] While `currentError` is set, `<InputBar>` receives `disabled={true}`
- [x] Component test: simulate API error with "Router unavailable" → verify banner and disabled input
- [x] Integration test: mock API to return RouterUnavailable → verify UI response

**Requirements**: FR-2.8 (routing errors), NFR-2.3 (router crash handling)

**Dependencies**: Task 3.4 (ChatContainer)

**Effort**: S (1 hour)

---

### Task 5.3: Implement Tool Execution Timeout

**Description**: Add timeout logic to API route tool execution to prevent indefinite hangs.

**Acceptance Criteria**:
- [x] In API route `POST` handler (Task 3.3):
  - Wrap each `invokeToolCall` with `Promise.race` against 10-second timeout
  - If timeout occurs, push error: `{status: 'error', error: 'Tool execution timed out'}`
  - Continue executing remaining tools sequentially
- [x] Unit test: mock `invokeToolCall` to hang indefinitely → verify timeout after 10s, error recorded in results

**Requirements**: NFR-2.2 (tool timeout)

**Dependencies**: Task 3.3 (API route)

**Effort**: S (45 min)

---

### Task 5.4: Verify Server Disconnection Warning Flow

**Description**: Ensure disconnected servers are filtered and warnings displayed.

**Acceptance Criteria**:
- [x] API route (Task 3.3) already filters manifests to `status === 'connected'`
- [x] API route includes `warnings` array in Turn response for disconnected servers
- [x] `TurnDisplay` component displays warnings prominently (e.g., yellow banner)
- [x] Component test: Turn with warnings → verify warnings displayed
- [x] Integration test: mock one server as disconnected → submit query → verify warning in Turn response and UI

**Requirements**: FR-6.4 (server disconnection warning), AC-5 (manual disconnect test)

**Dependencies**: Task 2.2 (TurnDisplay), Task 3.3 (API route), router-core Task 1.4 (server status tracking)

**Effort**: S (1 hour)

---

## Phase 6: Integration & Testing

### Task 6.1: Full Query Flow Integration Test

**Description**: End-to-end test from query submission to turn recording.

**Acceptance Criteria**:
- [x] Test file `tests/integration/playground-e2e.test.ts` created
- [x] Test spawns 3 demo MCP servers (notes, tasks, calculator)
- [x] Test submits query: "Add a note about the meeting"
- [x] Test verifies:
  - Routing decision displayed with notes server selected
  - Tool result displayed (success or error)
  - Turn recorded via `recordTurn`
  - Turn appears in `getSessionStats().turns`
- [x] Test submits 3 queries total
- [x] Test verifies 3 turns in `getSessionStats()` with matching intents
- [x] Test teardown: terminate all subprocesses

**Requirements**: AC-2 (submit query and see result), AC-4 (/lab integration)

**Dependencies**: Task 3.3 (API route), Task 3.4 (ChatContainer), Task 4.1 (Playground page), router-core E2E test

**Effort**: L (3.5 hours)

---

### Task 6.2: Component Unit Tests

**Description**: Comprehensive unit tests for all Playground components.

**Acceptance Criteria**:
- [x] Test file `tests/unit/playground-components.test.ts` created
- [x] InputBar tests: valid submit, empty submit, long submit, disabled state
- [x] ConversationHistory tests: empty state (shows WelcomeMessage), non-empty state (shows turns), auto-scroll
- [x] TurnDisplay tests: turn with routing, turn with results, turn with error, turn with warnings
- [x] RoutingStatsCard tests: all fields displayed, reasoning present/absent
- [x] ToolResultCard tests: success result, error result, collapsible long result
- [x] WelcomeMessage tests: click example → verify callback
- [x] ErrorMessage tests: verify message and styling
- [x] LoadingIndicator tests: verify spinner and message
- [x] ChatContainer tests: API success, API error, banner display
- [x] All tests pass with ≥85% coverage on component logic

**Requirements**: NFR-4.1 (component tests with real outputs)

**Dependencies**: All Phase 1-2 tasks (all components), Task 3.4 (ChatContainer)

**Effort**: L (3.5 hours)

---

### Task 6.3: Error Scenario Integration Tests

**Description**: Test all error handling paths end-to-end.

**Acceptance Criteria**:
- [x] Test file `tests/integration/playground-errors.test.ts` created
- [x] Test: mock API route to return `NoRelevantToolsError` → verify error displayed in turn
- [x] Test: mock API route to return "Router unavailable" error → verify banner shown, input disabled
- [x] Test: mock API route's `invokeToolCall` to throw error → verify error in tool result, turn still returned
- [x] Test: mock all demo servers offline → API returns 503 → verify error displayed
- [x] Test: simulate tool timeout in API route → verify timeout error in tool results
- [x] Test: mock API route to return arg extraction error → verify "Unable to extract arguments" in results
- [x] All tests pass consistently

**Requirements**: NFR-4.2 (error state testing), AC-6 (no relevant tools), FR-3.2 (arg extraction failure)

**Dependencies**: Task 5.1, Task 5.2, Task 5.3 (error handling tasks), Task 3.3 (API route)

**Effort**: M (2.5 hours)

---

### Task 6.4: Dashboard Integration Validation

**Description**: Verify Playground turns appear in Monster Lab dashboard.

**Acceptance Criteria**:
- [x] Test file `tests/integration/playground-lab-integration.test.ts` created
- [x] Test submits 2 queries via API route (spawn real servers, real routing)
- [x] Test calls `getSessionStats()` server-side
- [x] Test verifies:
  - `stats.turns.length === 2` (not 4 — each query auto-records once)
  - First turn's intent matches first query
  - Second turn's intent matches second query
  - Tool counts match expected values
  - Turn statistics include `toolFilter` and `reasoning` fields
- [x] Manual test: submit 3 queries in `/playground`, navigate to `/lab`, verify exactly 3 turns displayed (not 6)

**Requirements**: AC-4 (dashboard integration), NFR-4.3 (integration test), FR-5.3 (no double recording)

**Dependencies**: Task 6.1 (E2E test), Task 3.3 (API route), monster-lab-dashboard implementation

**Effort**: M (2 hours)

---

### Task 6.5: Acceptance Criteria Validation

**Description**: Verify all acceptance criteria from requirements.md are met.

**Acceptance Criteria**:
- [x] AC-1: Navigate to `/playground` → see input field and examples → manual test
- [x] AC-2: Submit "Add a note" → see routing + result → manual test or automated (Task 6.1)
- [x] AC-3: Submit "What's 42 + 58?" → see calculator result → manual test
- [x] AC-4: Submit 3 queries → refresh `/lab` → see 3 turns → manual test (Task 6.4)
- [x] AC-5: Disconnect server → submit query → see warning → manual test (Task 5.4)
- [x] AC-6: Submit "What is the weather?" → see no tools error → automated test (Task 6.3)
- [x] AC-7: View on mobile (375px) → verify usable → manual visual test
- [x] Checklist document created summarizing validation results

**Requirements**: All AC-* from requirements.md

**Dependencies**: All implementation tasks, Task 6.1 to 6.4 (all tests)

**Effort**: S (1 hour)

---

## Phase 7: Responsive Design & Polish

### Task 7.1: Mobile Responsiveness

**Description**: Ensure Playground works on mobile devices.

**Acceptance Criteria**:
- [ ] InputBar: full-width input, submit button below input on narrow screens (<640px)
- [ ] ConversationHistory: full-width turns, readable text sizes (min 14px)
- [ ] TurnDisplay: stacked layout, no horizontal overflow
- [ ] RoutingStatsCard: metrics stack vertically on mobile
- [ ] ToolResultCard: long results wrap, horizontal scroll for code blocks
- [ ] Manual test on Chrome DevTools device emulation: iPhone SE (375px), iPad (768px)
- [ ] Manual test: verify input field, submit button, and results all usable with touch

**Requirements**: AC-7 (mobile usability), NFR-3.2 (responsive layout)

**Dependencies**: Task 4.1 (Playground page), all component tasks

**Effort**: M (2 hours)

---

### Task 7.2: Loading State Improvements

**Description**: Add loading indicators for routing and tool execution phases.

**Acceptance Criteria**:
- [ ] While routing: display `<LoadingIndicator message="Routing your query..." />` in conversation area
- [ ] While executing tools: display `<LoadingIndicator message="Executing tools..." />` below routing stats
- [ ] Loading indicators styled consistently with Playground theme (purple accent)
- [ ] Component test: verify loading indicators shown during async operations

**Requirements**: FR-2.1 (routing loading), FR-3.2 (tool loading), NFR-1.2 (fast feedback)

**Dependencies**: Task 1.3 (LoadingIndicator), Task 3.4 (ChatContainer)

**Effort**: S (45 min)

---

### Task 7.3: Auto-Focus Input After Submit

**Description**: Automatically focus input field after query completes for quick follow-up queries.

**Acceptance Criteria**:
- [ ] In `ChatContainer.handleSubmit`:
  - After `setIsProcessing(false)`, call `inputRef.current?.focus()`
- [ ] Pass `inputRef` from ChatContainer to InputBar via prop
- [ ] Manual test: submit query → wait for result → verify cursor in input field without clicking

**Requirements**: FR-1.5 (re-enable and focus input), NFR-3.1 (usability)

**Dependencies**: Task 2.1 (InputBar), Task 3.4 (ChatContainer)

**Effort**: S (30 min)

---

## Phase 8: Documentation

### Task 8.1: Component Documentation

**Description**: Add JSDoc comments and usage examples to all components.

**Acceptance Criteria**:
- [ ] JSDoc comments added to all component props interfaces
- [ ] Each component file includes brief purpose comment at top
- [ ] README file `src/app/playground/components/README.md` created with component overview
- [ ] Code examples included for reusable components (ErrorMessage, LoadingIndicator, RoutingStatsCard, ToolResultCard)

**Requirements**: Military Rule 3 (exhaustive docs)

**Dependencies**: All component tasks

**Effort**: S (1 hour)

---

### Task 8.2: Performance Validation

**Description**: Verify NFR-1 performance targets are met.

**Acceptance Criteria**:
- [ ] Manual test: submit query → measure time to routing decision display → ≤2s (NFR-1.1, same as router-core)
- [ ] Manual test: measure time from tool result received to displayed → ≤500ms (NFR-1.2)
- [ ] Benchmark test: create conversation with 50 turns → verify smooth scrolling (no lag >100ms frame time)
- [ ] Benchmark results logged to console (not hard-coded in docs)
- [ ] If targets not met, document actual performance and file issue for optimization

**Requirements**: NFR-1.1 (routing speed), NFR-1.2 (result display), NFR-1.3 (scroll performance)

**Dependencies**: Task 4.1 (Playground page), Task 6.1 (E2E test)

**Effort**: S (1 hour)

---

## Summary

**Total Tasks**: 28  
**Total Estimated Effort**: ~38 hours  
**Critical Path**: 1.1 → 3.1 → 3.2 → 3.3 → 3.4 → 4.1 → 6.1 → 6.5

**Parallelization Opportunities**:
- Phase 1 tasks (1.2 to 1.6) can be done in parallel (independent components)
- Phase 2 tasks (2.1, 2.2, 2.3) can partially overlap
- Phase 3: Task 3.1 and 3.2 can be done in parallel (independent server modules)
- Phase 5 tasks (5.1 to 5.4) are verification tasks, can be done quickly in sequence
- Phase 6 tasks (6.2, 6.3, 6.4) can be done in parallel after E2E test (6.1)

**Risk Areas**:
1. **Task 3.2 (extractToolArguments)**: Hardcoded patterns may not cover all demo query variations; requires thorough testing
2. **Task 3.3 (API route)**: Complex server-side orchestration; integration with router-core auto-recording must be verified
3. **Task 6.1 (E2E test)**: Full stack integration including server boundary; may uncover cross-boundary issues late
4. **Task 6.4 (Dashboard integration)**: Must verify no double-recording (AC-4: 3 queries → 3 turns, not 6)

---

## Traceability Matrix

| Task | Requirements | Acceptance Criteria | Router-Core Dependency? |
|------|--------------|---------------------|-------------------------|
| 1.1 | Infrastructure | — | No |
| 1.2 | NFR-2.1 | — | No |
| 1.3 | FR-2.1 | — | No |
| 1.4 | FR-2.2–FR-2.6 | — | No |
| 1.5 | FR-3.3, FR-3.4, NFR-3.3 | — | No |
| 1.6 | FR-7.1–FR-7.4 | — | No |
| 2.1 | FR-1.1–FR-1.5, AC-1 | — | No |
| 2.2 | FR-4.3, FR-4.5 | — | No |
| 2.3 | FR-4.1, FR-4.2, FR-7.1 | — | No |
| 3.1 | Server initialization | — | Yes (MCPServerManager) |
| 3.2 | FR-3.1, FR-3.2, AC-2, AC-3 | — | No |
| 3.3 | FR-2.1–FR-2.8, FR-3.1–FR-3.8, FR-5.1–FR-5.4, FR-6.4 | — | Yes (routeIntent auto-records, MCPServerManager) |
| 3.4 | FR-2.1–FR-2.8, FR-4.1–FR-4.5, NFR-2.3 | — | No (client-side, calls API) |
| 4.1 | FR-6.1, AC-1 | AC-1 | No |
| 5.1 | FR-2.7, AC-6 | AC-6 | No |
| 5.2 | FR-2.8, NFR-2.3 | — | No |
| 5.3 | NFR-2.2 | — | Yes (server-side timeout) |
| 5.4 | FR-6.4, AC-5 | AC-5 | Yes (server status) |
| 6.1 | AC-2, AC-4 | AC-2, AC-4 | Yes (full stack + API) |
| 6.2 | NFR-4.1 | — | No |
| 6.3 | NFR-4.2, AC-6 | AC-6 | No |
| 6.4 | AC-4, NFR-4.3 | AC-4 | Yes (getSessionStats) |
| 6.5 | All AC-* | All AC-* | No |
| 7.1 | AC-7, NFR-3.2 | AC-7 | No |
| 7.2 | FR-2.1, FR-3.2, NFR-1.2 | — | No |
| 7.3 | FR-1.5, NFR-3.1 | — | No |
| 8.1 | Military Rule 3 | — | No |
| 8.2 | NFR-1.1, NFR-1.2, NFR-1.3 | — | No |

---

## Changes from Previous Versions

_Initial version._
