# Router Core — Requirements Specification

> **Feature**: Dynamic MCP router with schema trimming and per-turn statistics  
> **Status**: Draft (awaiting confirmation)  
> **Author**: Kiro  
> **Date**: 2026-11-05

## Overview

The router core is the central orchestration layer that enables FrankenMCP to stitch multiple MCP servers together efficiently. It routes user intents to relevant servers, trims unnecessary tool schemas to save context window space, and tracks per-turn statistics for transparency.

This specification uses **EARS (Easy Approach to Requirements Syntax)** format for clarity and traceability.

---

## Functional Requirements

### FR-1: MCP Server Registration

**FR-1.1** — WHEN a user adds an MCP server configuration, THEN the system SHALL validate the transport type (stdio, SSE, or Streamable HTTP) and connection parameters.

**FR-1.2** — WHEN a user adds an MCP server with stdio transport, THEN the system SHALL store the command path and arguments required to spawn the server process.

**FR-1.3** — WHEN a user adds an MCP server with SSE transport, THEN the system SHALL store the HTTP endpoint URL.

**FR-1.4** — WHEN a user adds an MCP server with Streamable HTTP transport, THEN the system SHALL store the HTTP endpoint URL and any required headers.

**FR-1.5** — WHEN a user removes an MCP server, THEN the system SHALL terminate any active connection and remove the server from the routing pool.

**FR-1.6** — WHEN the system connects to an MCP server, THEN the system SHALL retrieve and cache the server's tool list and schemas.

**FR-1.7** — WHEN an MCP server connection fails, THEN the system SHALL log the error and mark the server as unavailable WITHOUT falling back to mock data.

### FR-2: Dynamic Routing and Schema Trimming

**FR-2.1** — WHEN a user submits a natural language intent, THEN the system SHALL invoke the `mcp-dynamic-router` dependency to determine which registered MCP servers are relevant.

**FR-2.2** — WHEN the router returns a routing decision, THEN the system SHALL load tool schemas ONLY from the selected servers.

**FR-2.3** — WHEN tool schemas are loaded, THEN the system SHALL trim schemas for tools not relevant to the current intent while preserving all required parameters for retained tools.

**FR-2.4** — WHEN a tool schema is trimmed, THEN the system SHALL remove optional parameters and descriptions that do not match the intent keywords.

**FR-2.5** — WHEN no servers are selected by the router, THEN the system SHALL return an error message stating "No relevant tools found for this request" WITHOUT generating synthetic responses.

**FR-2.6** — WHEN the same user intent and server set are provided multiple times, THEN the system SHALL produce the same routing decision each time (determinism).

**FR-2.7** — WHEN a tool schema is trimmed and then reloaded from the server, THEN the schema SHALL match the original untrimmed version (round-trip fidelity).

### FR-3: Per-Turn Routing Statistics

**FR-3.1** — WHEN a routing decision is made, THEN the system SHALL record the number of tools loaded from selected servers.

**FR-3.2** — WHEN schemas are trimmed, THEN the system SHALL record the number of tools whose schemas were trimmed.

**FR-3.3** — WHEN routing statistics are requested, THEN the system SHALL calculate an estimated token savings based on the character count of trimmed schema content.

**FR-3.4** — WHEN routing statistics are displayed, THEN all numbers SHALL be calculated from actual routing decisions, NOT hard-coded or synthetic values.

**FR-3.5** — WHEN a routing decision completes, THEN the system SHALL store the statistics (tools loaded, tools trimmed, servers used, timestamp) for later retrieval.

**FR-3.6** — WHEN displaying historical statistics, THEN the system SHALL aggregate data from all previous routing decisions in the current session.

### FR-4: Demo MCP Servers Pre-Configuration

**FR-4.1** — WHEN the application starts for the first time, THEN the system SHALL pre-configure three demo MCP servers (notes, tasks, calculator) in `.kiro/settings/mcp.json`.

**FR-4.2** — WHEN demo servers are pre-configured, THEN each server SHALL be a stdio-based MCP server that requires no API keys or external services.

**FR-4.3** — WHEN the notes demo server is invoked, THEN it SHALL support tools for creating, reading, updating, and deleting notes stored in memory or a local JSON file.

**FR-4.4** — WHEN the tasks demo server is invoked, THEN it SHALL support tools for creating, reading, updating, and deleting tasks stored in memory or a local JSON file.

**FR-4.5** — WHEN the calculator demo server is invoked, THEN it SHALL support tools for arithmetic operations (add, subtract, multiply, divide) and unit conversions.

**FR-4.6** — WHEN demo servers are started, THEN they SHALL register themselves with the router automatically based on the pre-configuration.

**FR-4.7** — WHEN a demo server fails to start, THEN the system SHALL log the error and mark the server as unavailable WITHOUT silently substituting mock responses.

---

## Non-Functional Requirements

### NFR-1: Performance

**NFR-1.1** — WHEN routing a user intent, THEN the routing decision SHALL complete within 2 seconds for up to 10 registered servers.

**NFR-1.2** — WHEN loading tool schemas, THEN schema retrieval SHALL complete within 1 second per server.

### NFR-2: Reliability

**NFR-2.1** — WHEN an MCP server becomes unavailable mid-session, THEN the router SHALL exclude it from subsequent routing decisions without crashing.

**NFR-2.2** — WHEN the router dependency fails, THEN the system SHALL return an error message to the user with diagnostic information.

### NFR-3: Testability

**NFR-3.1** — WHEN testing routing decisions, THEN tests SHALL spawn real MCP server subprocesses, NOT mocks, to validate end-to-end behavior.

**NFR-3.2** — WHEN testing schema trimming, THEN property-based tests SHALL generate ≥100 random tool schemas to verify that required parameters are never removed.

**NFR-3.3** — WHEN testing routing determinism, THEN property-based tests SHALL generate ≥100 random input intents and server sets to verify consistent routing decisions.

**NFR-3.4** — WHEN testing schema fidelity, THEN property-based tests SHALL generate ≥100 random schemas and verify round-trip preservation after trimming and reloading.

### NFR-4: Security

**NFR-4.1** — WHEN the router communicates with external MCP servers, THEN all network requests SHALL use HTTPS or secure local IPC.

**NFR-4.2** — WHEN tool schemas contain sensitive metadata, THEN the system SHALL NOT log or expose schemas in client-facing error messages.

---

## Constraints

**C-1** — The router core SHALL use `mcp-dynamic-router` as an external dependency via `npx -y github:leethoneid/mcp-dynamic-router serve`. The router source code SHALL NOT be modified or copied into this repository.

**C-2** — All adapter code wrapping the router SHALL reside in `src/lib/router/`.

**C-3** — Demo server code SHALL reside in `src/mcp-servers/` and SHALL NOT be imported by production routing code.

**C-4** — Routing statistics SHALL be stored in memory for the session and SHALL NOT persist to a database in the initial release.

---

## Acceptance Criteria

**AC-1** — A user can add a new stdio MCP server by providing a command and arguments, and the system successfully connects and retrieves tool schemas.

**AC-2** — A user can submit a natural language intent (e.g., "Add a note about the meeting"), and the system routes to the notes server, loads only relevant tools, and returns a response.

**AC-3** — A user can view routing statistics showing the number of tools loaded, tools trimmed, and estimated token savings for the current turn.

**AC-4** — The three demo servers (notes, tasks, calculator) are pre-configured and functional on first application start with no additional setup.

**AC-5** — All property-based tests for trimming, determinism, and fidelity pass with ≥100 generated test cases each.

**AC-6** — When a server connection fails, the system displays an error message and does NOT generate synthetic success responses.

---

## Traceability to PBT Invariants

Each PBT invariant maps to specific requirements:

- **PBT-1 (Trimming preserves required parameters)** → FR-2.3, NFR-3.2
- **PBT-2 (Routing is deterministic)** → FR-2.6, NFR-3.3
- **PBT-3 (Schema round-trip fidelity)** → FR-2.7, NFR-3.4

---

## Open Questions

1. Should the router support user-defined intent keywords, or rely entirely on the external router's NLP?
2. Should routing statistics persist across sessions, or remain ephemeral?
3. What is the maximum number of concurrent MCP servers the router should support?

---

## Changes from Previous Versions

_Initial version._
