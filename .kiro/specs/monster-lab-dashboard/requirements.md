# Monster Lab Dashboard — Requirements Specification

> **Feature**: Live dashboard visualizing per-turn routing decisions, schema trimming, and token savings  
> **Status**: Draft (awaiting confirmation)  
> **Author**: Kiro  
> **Date**: 2026-11-06

## Overview

The Monster Lab Dashboard is the transparency layer of FrankenMCP, providing real-time visualization of routing decisions, tool loading/trimming statistics, and server health. It transforms abstract "context efficiency" into concrete, verifiable numbers that demonstrate the core value proposition.

This specification uses **EARS (Easy Approach to Requirements Syntax)** format for clarity and traceability.

---

## Functional Requirements

### FR-1: Per-Turn Routing Visualization

**FR-1.1** — WHEN a user submits an intent and routing completes, THEN the dashboard SHALL display which servers were selected for that turn.

**FR-1.2** — WHEN a routing decision is displayed, THEN the dashboard SHALL show which tools were loaded into context from each selected server.

**FR-1.3** — WHEN a routing decision is displayed, THEN the dashboard SHALL show which tools were trimmed (excluded from context) from each selected server.

**FR-1.4** — WHEN a routing decision includes reasoning from the router, THEN the dashboard SHALL display the reasoning text.

**FR-1.5** — WHEN no servers are selected by the router, THEN the dashboard SHALL display "No relevant tools found" WITHOUT showing zero values as if routing succeeded.

**FR-1.6** — WHEN the dashboard displays per-turn statistics, THEN each turn SHALL be timestamped and labeled with the user's original intent.

### FR-2: Real-Time Statistics Display

**FR-2.1** — WHEN a routing decision completes, THEN the dashboard SHALL display the count of tools loaded into context for that turn.

**FR-2.2** — WHEN a routing decision completes, THEN the dashboard SHALL display the count of tools trimmed from selected servers (calculated as: tools in selected servers minus tools loaded).

**FR-2.3** — WHEN a routing decision completes, THEN the dashboard SHALL display estimated token savings calculated from character count of trimmed tool schemas divided by 4.

**FR-2.4** — WHEN a routing decision completes, THEN the dashboard SHALL display the routing decision time in milliseconds.

**FR-2.5** — WHEN statistics are displayed, THEN all numbers SHALL be computed from real routing data stored in `stats.ts`, NOT hard-coded or synthetic values.

**FR-2.6** — WHEN statistics calculation fails, THEN the dashboard SHALL display "Stats unavailable" with an error icon, NOT zero or placeholder values.

### FR-3: Session-Wide Aggregation

**FR-3.1** — WHEN the dashboard is viewed, THEN it SHALL display total tools loaded across all turns in the current session.

**FR-3.2** — WHEN the dashboard is viewed, THEN it SHALL display total tools trimmed across all turns in the current session.

**FR-3.3** — WHEN the dashboard is viewed, THEN it SHALL display total estimated token savings across all turns in the current session.

**FR-3.4** — WHEN the dashboard is viewed, THEN it SHALL display average routing time across all turns in the current session.

**FR-3.5** — WHEN the dashboard is viewed, THEN it SHALL display the total number of routing turns completed in the current session.

**FR-3.6** — WHEN session aggregation is displayed, THEN all aggregates SHALL be calculated by summing/averaging per-turn statistics from `getSessionStats()`, NOT pre-computed or hard-coded.

### FR-4: Server Health Monitoring

**FR-4.1** — WHEN the dashboard loads, THEN it SHALL display the status of all registered MCP servers (connected, disconnected, error, starting).

**FR-4.2** — WHEN a server's status changes, THEN the dashboard SHALL update the display within 5 seconds without requiring a page refresh.

**FR-4.3** — WHEN a server is marked as "error", THEN the dashboard SHALL display the error reason or "Connection failed" if no specific reason is available.

**FR-4.4** — WHEN a server is marked as "disconnected", THEN the dashboard SHALL indicate how long it has been disconnected (e.g., "Offline for 2m 34s").

**FR-4.5** — WHEN all servers are unavailable, THEN the dashboard SHALL display a prominent warning: "All servers offline — cannot route requests".

**FR-4.6** — WHEN displaying server health, THEN the dashboard SHALL retrieve status from `MCPServerManager.getServerStatus()`, NOT from mock data or hard-coded states.

### FR-5: Visual Design Theme

**FR-5.1** — WHEN the dashboard is rendered, THEN it SHALL use a dark color scheme with experimental lab aesthetics (dark backgrounds, neon green/purple accents).

**FR-5.2** — WHEN statistics are displayed, THEN numeric metrics SHALL be prominently styled (large font, high contrast) to emphasize transparency.

**FR-5.3** — WHEN the dashboard displays tool trimming, THEN trimmed tools SHALL be visually distinct from loaded tools (e.g., strikethrough, faded color, or "excluded" badge).

**FR-5.4** — WHEN the dashboard is viewed on mobile, THEN it SHALL remain readable and usable (responsive layout, collapsible sections).

**FR-5.5** — WHEN the dashboard displays server health, THEN status indicators SHALL use semantic colors: green for connected, yellow for starting, red for error/disconnected.

### FR-6: Turn History

**FR-6.1** — WHEN the dashboard is viewed, THEN it SHALL display a scrollable list of recent routing turns (most recent first).

**FR-6.2** — WHEN a turn is displayed in the history, THEN it SHALL show: timestamp, intent excerpt (first 50 chars), selected servers, tools loaded, tools trimmed, token savings.

**FR-6.3** — WHEN the turn history exceeds 20 entries, THEN older entries SHALL be collapsible or paginated to avoid overwhelming the UI.

**FR-6.4** — WHEN a user clicks a turn in the history, THEN it SHALL expand to show full details (complete intent, reasoning, tool lists).

**FR-6.5** — WHEN turn history is displayed, THEN data SHALL be retrieved from `getSessionStats().turns`, NOT from synthetic or demo data.

---

## Non-Functional Requirements

### NFR-1: Performance

**NFR-1.1** — WHEN statistics are requested, THEN `getSessionStats()` SHALL complete within 100ms for up to 1000 turns.

**NFR-1.2** — WHEN the dashboard updates after a routing decision, THEN the UI SHALL reflect new data within 500ms.

### NFR-2: Reliability

**NFR-2.1** — WHEN statistics calculation encounters an error, THEN the dashboard SHALL display "Stats unavailable" and log the error to the console WITHOUT crashing the page.

**NFR-2.2** — WHEN a server status poll fails, THEN the dashboard SHALL retry after 5 seconds and mark the server as "unknown" status (not "connected").

### NFR-3: Usability

**NFR-3.1** — WHEN a first-time user views the dashboard, THEN they SHALL understand what "tools loaded", "tools trimmed", and "token savings" mean from visual labels and layout alone (no external documentation required).

**NFR-3.2** — WHEN the dashboard displays zero turns, THEN it SHALL show a helpful message: "No routing decisions yet. Submit a query in the Playground to see statistics."

### NFR-4: Testability

**NFR-4.1** — WHEN testing the dashboard, THEN component tests SHALL verify that statistics are passed as props from real `getSessionStats()` output, NOT mock constants.

**NFR-4.2** — WHEN testing failure states, THEN tests SHALL simulate `getSessionStats()` throwing an error and verify "Stats unavailable" is displayed.

**NFR-4.3** — WHEN testing server health display, THEN tests SHALL simulate different server statuses and verify correct color coding and labels.

---

## Constraints

**C-1** — The dashboard SHALL be implemented as a Next.js App Router page at `/lab` (e.g., `src/app/lab/page.tsx`).

**C-2** — The dashboard SHALL use React Server Components by default; client components SHALL be marked with `"use client"` only when necessary (e.g., for real-time updates or interactivity).

**C-3** — The dashboard SHALL use Tailwind CSS 4 for styling; no external UI component libraries (e.g., Material-UI, Ant Design) SHALL be added.

**C-4** — Statistics data SHALL be retrieved by importing functions from `src/lib/router/stats.ts` and `src/lib/mcp/server-manager.ts`; the dashboard SHALL NOT maintain its own separate statistics state.

**C-5** — Real-time updates (server status changes, new routing turns) SHALL use polling or React state updates; WebSocket or Server-Sent Events are out of scope for the initial release.

---

## Acceptance Criteria

**AC-1** — A user can navigate to `/lab` and see the dashboard with session statistics (even if zero turns completed).

**AC-2** — After submitting a query in the Playground, the user refreshes `/lab` and sees the new turn's statistics (tools loaded, trimmed, token savings).

**AC-3** — The dashboard displays accurate server health status (3 demo servers shown as "connected" on first load).

**AC-4** — When a server is manually disconnected (e.g., by killing its process), the dashboard shows that server as "disconnected" or "error" within 10 seconds.

**AC-5** — When `getSessionStats()` throws an error (simulated in tests), the dashboard displays "Stats unavailable" instead of crashing.

**AC-6** — The dashboard's visual design uses dark theme with lab aesthetics (green/purple accents, prominent numbers).

**AC-7** — All displayed numbers match the output of `getSessionStats()` (verified by logging both values in tests).

---

## Traceability to Core Value

The Monster Lab Dashboard directly demonstrates FrankenMCP's core value proposition:

- **FR-2.1, FR-2.2** → Show "context efficiency" as concrete numbers (tools loaded vs. trimmed)
- **FR-2.3** → Quantify token savings in real-time
- **FR-4** → Build trust through "transparency" (server health visibility)
- **FR-5** → Reinforce "Monster Lab" branding (experimental, playful, Frankenstein theme)
- **FR-6** → Enable users to audit past routing decisions

---

## Open Questions

1. Should turn history persist across page refreshes, or remain session-scoped in memory?
2. Should the dashboard auto-refresh (polling), or require manual refresh?
3. Should we visualize tool schemas (e.g., show trimmed parameters), or just tool names?

---

## Changes from Previous Versions

_Initial version._
