# Playground Chat — Requirements Specification

> **Feature**: User-facing chat interface for natural language queries with real-time routing transparency  
> **Status**: Draft (awaiting confirmation)  
> **Author**: Kiro  
> **Date**: 2026-11-06

## Overview

The Playground Chat is the primary user interface for FrankenMCP, where users submit natural language queries and see the complete routing → tool execution → result flow in real-time. Each interaction demonstrates the core value proposition: context-efficient routing with full transparency.

This specification uses **EARS (Easy Approach to Requirements Syntax)** format for clarity and traceability.

---

## Functional Requirements

### FR-1: Query Submission

**FR-1.1** — WHEN a user types a natural language query in the input field, THEN the input SHALL accept text up to 1000 characters.

**FR-1.2** — WHEN a user presses Enter or clicks the Submit button with non-empty input, THEN the system SHALL submit the query and clear the input field.

**FR-1.3** — WHEN a user submits an empty query (whitespace only), THEN the system SHALL NOT submit and SHALL display a validation message: "Please enter a query".

**FR-1.4** — WHEN a query is submitted, THEN the system SHALL disable the input field and submit button until processing completes.

**FR-1.5** — WHEN query processing completes (success or failure), THEN the system SHALL re-enable the input field and submit button and focus the input field.

### FR-2: Routing Decision Display

**FR-2.1** — WHEN a query is submitted, THEN the system SHALL call `routeIntent()` with the query and display a loading indicator.

**FR-2.2** — WHEN `routeIntent()` returns a routing decision, THEN the system SHALL display which servers were selected for the query.

**FR-2.3** — WHEN a routing decision is displayed, THEN the system SHALL show how many tools were loaded into context.

**FR-2.4** — WHEN a routing decision is displayed, THEN the system SHALL show how many tools were trimmed from selected servers.

**FR-2.5** — WHEN a routing decision is displayed, THEN the system SHALL show estimated token savings.

**FR-2.6** — WHEN a routing decision includes reasoning, THEN the system SHALL display the reasoning text.

**FR-2.7** — WHEN `routeIntent()` throws `NoRelevantToolsError`, THEN the system SHALL display: "No relevant tools found for this query" and NOT proceed to tool execution.

**FR-2.8** — WHEN `routeIntent()` throws other errors, THEN the system SHALL display the error message and NOT proceed to tool execution.

### FR-3: Tool Execution Display

**FR-3.1** — WHEN a routing decision includes tools, THEN the system SHALL derive arguments for each tool from the user query using hardcoded extraction patterns.

**FR-3.2** — WHEN tool arguments cannot be derived (no pattern matches), THEN the system SHALL display an error: "Unable to extract arguments for [tool]" and NOT execute that tool.

**FR-3.2a** — WHEN the routed tool is `subtract` AND the query has the form "subtract X from Y", THEN the system SHALL derive `a = Y` and `b = X` (so "Subtract 5 from 20" computes 20 − 5 = 15). Queries in written order ("20 minus 5", "20 - 5", "20减5") SHALL keep `a` = first number, `b` = second number.

**FR-3.3** — WHEN tool arguments are derived successfully, THEN the system SHALL execute tool calls via server-side invocation for each selected tool.

**FR-3.4** — WHEN tool execution starts, THEN the system SHALL display a loading indicator with the tool name and server ID.

**FR-3.5** — WHEN a tool call completes successfully, THEN the system SHALL display the result in a readable format (JSON pretty-printed or structured display).

**FR-3.6** — WHEN a tool call fails, THEN the system SHALL display the error message with the tool name and server ID, and NOT crash the UI.

**FR-3.7** — WHEN multiple tools are executed, THEN the system SHALL display results in the order they were submitted for execution (sequential execution order).

**FR-3.8** — WHEN tool execution completes (all tools succeed or fail), THEN the turn SHALL already be recorded by the routing layer for Monster Lab dashboard visibility.

### FR-4: Conversation History Display

**FR-4.1** — WHEN the Playground page loads, THEN the system SHALL display a scrollable conversation history area showing all previous turns in the current session.

**FR-4.2** — WHEN a new turn completes, THEN the system SHALL append the turn to the conversation history (user query, routing decision, tool results).

**FR-4.3** — WHEN displaying a turn in history, THEN the system SHALL show: user query, selected servers, tools loaded/trimmed, tool execution results, and timestamp.

**FR-4.4** — WHEN the conversation history exceeds 10 turns, THEN older turns SHALL remain scrollable (no pagination or truncation).

**FR-4.5** — WHEN a turn is displayed in history, THEN routing statistics (loaded/trimmed/saved) SHALL be visually distinct from tool results (e.g., different background colors or sections).

### FR-5: Integration with Monster Lab Dashboard

**FR-5.1** — WHEN a query is routed, THEN the routing layer SHALL automatically record a turn with complete statistics (handled by `routeIntent` internals).

**FR-5.2** — WHEN a turn is recorded, THEN it SHALL include: turnID, timestamp, intent, selectedServers, toolsLoaded, toolsTrimmed, estimatedTokensSaved, routingTimeMs, toolFilter, and reasoning.

**FR-5.3** — WHEN a user navigates to `/lab` after submitting queries in Playground, THEN the Monster Lab dashboard SHALL display statistics for all Playground turns.

**FR-5.4** — WHEN tool execution completes, THEN the Playground SHALL retrieve the recorded turn statistics for display (not re-record).

### FR-6: Zero-Config Demo Experience

**FR-6.1** — WHEN a user first visits the Playground, THEN the system SHALL work with zero API keys or configuration (demo servers only).

**FR-6.2** — WHEN the Playground loads, THEN the system SHALL verify that demo servers (notes, tasks, calculator) are connected.

**FR-6.3** — WHEN all demo servers are disconnected, THEN the system SHALL display a prominent error: "All servers offline. Please check server configuration."

**FR-6.4** — WHEN a demo server is disconnected mid-session, THEN subsequent queries SHALL exclude that server from available manifests before routing and display a warning: "Server '[name]' unavailable".

**FR-6.5** — WHEN the Playground displays server status, THEN it SHALL NOT require the user to manually register or configure servers.

### FR-7: Example Queries & Onboarding

**FR-7.1** — WHEN the Playground loads with zero conversation history, THEN the system SHALL display a welcome message with example queries.

**FR-7.2** — WHEN example queries are displayed, THEN they SHALL include at least one query for each demo server (notes, tasks, calculator).

**FR-7.3** — WHEN a user clicks an example query, THEN the system SHALL populate the input field with that query (not auto-submit).

**FR-7.4** — WHEN example queries are displayed, THEN they SHALL explain the routing transparency value proposition in one sentence.

---

## Non-Functional Requirements

### NFR-1: Performance

**NFR-1.1** — WHEN a user submits a query, THEN the routing decision SHALL be displayed within 2 seconds (same as router-core NFR-1.1).

**NFR-1.2** — WHEN tool execution completes, THEN results SHALL be displayed within 500ms of receiving the response.

**NFR-1.3** — WHEN the conversation history grows to 50 turns, THEN scrolling and rendering SHALL remain smooth (no lag).

### NFR-2: Reliability

**NFR-2.1** — WHEN any step fails (routing, tool execution, recording), THEN the UI SHALL display the error and remain functional for subsequent queries.

**NFR-2.2** — WHEN a tool call times out (>10s), THEN the system SHALL display a timeout error and allow retrying the query.

**NFR-2.3** — WHEN the router process crashes, THEN the Playground SHALL display: "Router unavailable. Please restart the application."

### NFR-3: Usability

**NFR-3.1** — WHEN a first-time user views the Playground, THEN they SHALL understand how to submit a query and what to expect from visual cues alone (no external documentation required).

**NFR-3.2** — WHEN the Playground is viewed on mobile, THEN the input field, submit button, and conversation history SHALL remain usable (responsive layout).

**NFR-3.3** — WHEN long tool results (>500 characters) are displayed, THEN they SHALL be collapsible or scrollable to avoid overwhelming the UI.

### NFR-4: Testability

**NFR-4.1** — WHEN testing the Playground, THEN component tests SHALL verify that routing decisions and tool results are displayed from real function outputs, NOT hard-coded mock data.

**NFR-4.2** — WHEN testing error states, THEN tests SHALL simulate routing failures, tool failures, and server disconnects and verify correct error messages.

**NFR-4.3** — WHEN testing `/lab` integration, THEN tests SHALL verify that turns recorded in Playground appear in `getSessionStats()` output.

---

## Constraints

**C-1** — The Playground SHALL be implemented as a Next.js App Router page at `/playground` (e.g., `src/app/playground/page.tsx`).

**C-2** — The Playground SHALL reuse existing `routeIntent()` from `src/lib/router/adapter.ts` WITHOUT modifying router-core behavior.

**C-3** — The Playground SHALL reuse existing `recordTurn()` or `computeTurnStats()` from `src/lib/router/stats.ts` WITHOUT adding new statistics tracking logic.

**C-4** — The Playground SHALL use `MCPServerManager.invokeToolCall()` for tool execution WITHOUT spawning new server processes.

**C-5** — The Playground SHALL only support stdio demo servers (notes, tasks, calculator); SSE and HTTP transports are out of scope for initial release.

**C-6** — The Playground SHALL NOT require user authentication, API keys, or external service configuration.

**C-7** — The Playground SHALL use Tailwind CSS 4 for styling; no external UI component libraries (e.g., Material-UI, Ant Design) SHALL be added.

**C-8** — The Playground SHALL NOT store conversation history in a database; history is session-scoped (in-memory or client-side state).

---

## Acceptance Criteria

**AC-1** — A user can navigate to `/playground` and see the chat interface with an input field and example queries.

**AC-2** — A user can type "Add a note about the meeting" and submit; the UI shows: notes server selected, 1 tool loaded, 4 tools trimmed, and the tool execution result.

**AC-3** — A user can type "What's 42 + 58?" and submit; the UI shows: calculator server selected, tool result "100", and estimated token savings.

**AC-4** — After submitting 3 queries in Playground, the user refreshes `/lab` and sees 3 turns in the dashboard with matching statistics.

**AC-5** — When a demo server is manually disconnected, the next query shows: "Server 'notes' unavailable" and routes to remaining servers.

**AC-6** — When the user submits a query with no relevant tools (e.g., "What is the weather?"), the UI shows: "No relevant tools found for this query" and does NOT crash.

**AC-7** — The Playground works on mobile (viewport width 375px) with usable input field and readable results.

---

## Open Questions

1. Should conversation history persist across page refreshes (LocalStorage), or remain session-scoped?
2. ~~Should tool execution be sequential or parallel when multiple tools are selected?~~ **Decided: Sequential** (simple, predictable, results in submission order)
3. Should the Playground auto-scroll to the latest turn, or let the user control scroll position?

---

## Changes from Previous Versions

- 2026-11-10: Added FR-3.2a. Bug found during polish review: "Subtract 5 from 20" returned −15 with status success, because subtract took the first two numbers in written order.
