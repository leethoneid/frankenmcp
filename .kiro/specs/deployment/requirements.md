# Deployment — Requirements Specification

> **Feature**: Production-ready Vercel deployment with serverless-compatible MCP architecture  
> **Status**: Draft (awaiting confirmation)  
> **Author**: Kiro  
> **Date**: 2026-11-06  
> **Related Specs**: router-core, monster-lab-dashboard, playground-chat

## Overview

The deployment specification addresses the architectural mismatch between stdio-based MCP servers (which spawn long-lived subprocesses) and Vercel's serverless execution model (which prohibits persistent processes and enforces strict timeouts). This specification defines a production-ready deployment strategy that maintains the zero-configuration demo experience while ensuring reliability on Vercel's infrastructure.

This specification uses **EARS (Easy Approach to Requirements Syntax)** format for clarity and traceability.

---

## Problem Statement

### Current Architecture Issues

1. **Stdio subprocess incompatibility**: Demo MCP servers spawn Node.js child processes via stdio transport. Vercel serverless functions cannot maintain these processes across invocations and terminate all processes after request completion.

2. **Cold start overhead**: Each API route invocation spawns new MCP server processes, causing 200-500ms startup latency per server on cold starts.

3. **Process cleanup risk**: Zombie processes may accumulate if subprocess termination fails, though Vercel's sandbox cleanup mitigates this somewhat.

4. **Timeout constraints**: Vercel free tier enforces 10-second function timeout; router + 3 servers + tool execution must complete within this window.

### Design Constraints

- **Zero API keys requirement**: Demo must work without user-provided credentials (rules out hosted MCP servers requiring auth)
- **Vercel free tier only**: No paid add-ons (rules out persistent containers, databases, or background workers)
- **Maintain stdio demo servers locally**: Development experience must remain fast with real subprocesses
- **Open source deployment**: Solution must work for anyone forking the repo (rules out proprietary hosting)

---

## Functional Requirements

### FR-1: In-Process MCP Server Adapter

**FR-1.1** — WHEN the application runs on Vercel, THEN demo MCP servers (notes, tasks, calculator) SHALL run as in-process modules rather than stdio subprocesses.

**FR-1.2** — WHEN an in-process MCP server is invoked, THEN it SHALL expose the same tool schemas and behavior as the stdio version.

**FR-1.3** — WHEN the application runs locally in development mode, THEN MCP servers MAY run as stdio subprocesses for realistic integration testing.

**FR-1.4** — WHEN the application detects it is running on Vercel (via `process.env.VERCEL === '1'`), THEN it SHALL automatically use in-process adapters without user configuration.

**FR-1.5** — WHEN an in-process adapter is loaded, THEN it SHALL initialize within 50ms (no subprocess spawn delay).

**FR-1.6** — WHEN tools are invoked via in-process adapter, THEN state (notes, tasks) SHALL be stored in memory with function-instance-scoped lifecycle: shared across warm invocations within the same instance, reset on cold start or redeployment.

**FR-1.7** — WHEN a cold start occurs or deployment is restarted, THEN demo data (notes, tasks) SHALL be reset to pre-seeded fixture state (3 notes, 5 tasks with `[DEMO]` prefix) WITHOUT warning users (this is acceptable for demo purposes).

### FR-2: Dual-Mode MCP Server Manager

**FR-2.1** — WHEN `MCPServerManager` is initialized, THEN it SHALL detect the runtime environment (local vs Vercel) via environment variables.

**FR-2.2** — WHEN running on Vercel, THEN `MCPServerManager.connectAll()` SHALL load in-process adapters for demo servers (notes, tasks, calculator) instead of spawning stdio subprocesses.

**FR-2.3** — WHEN running locally, THEN `MCPServerManager.connectAll()` SHALL spawn stdio subprocesses as configured in `.kiro/settings/mcp.json`.

**FR-2.4** — WHEN an in-process adapter fails to initialize, THEN the server SHALL be marked as unavailable and routing SHALL proceed with remaining servers.

**FR-2.5** — WHEN `MCPServerManager.invokeToolCall()` is called, THEN it SHALL route to the appropriate adapter (in-process or stdio) transparently based on server connection type.

**FR-2.6** — WHEN listing server manifests via `MCPServerManager.getServerManifests()`, THEN in-process and stdio servers SHALL appear with identical manifest structures (only transport field differs).

### FR-3: Serverless Function Optimization

**FR-3.1** — WHEN an API route handler is invoked on Vercel, THEN MCP server initialization SHALL complete within 100ms for all three demo servers combined.

**FR-3.2** — WHEN a query is routed and executed, THEN the total response time (routing + tool execution) SHALL complete within 5 seconds on Vercel (well under the 10-second timeout).

**FR-3.3** — WHEN multiple sequential requests arrive at the same warm function instance, THEN they SHALL share in-memory state (notes, tasks) allowing users to see data created in previous requests within that instance's lifecycle.

**FR-3.4** — WHEN a serverless function completes, THEN all in-process resources SHALL be released automatically (no explicit cleanup required; Node.js garbage collection handles this).

**FR-3.5** — WHEN router initialization fails on Vercel, THEN the API route SHALL return HTTP 503 with error details and log diagnostics.

### FR-4: Deployment Configuration

**FR-4.1** — WHEN the project is deployed to Vercel, THEN `vercel.json` SHALL configure appropriate function timeout (10s) and memory limits (1024MB minimum).

**FR-4.2** — WHEN Vercel builds the project, THEN `npm run build` SHALL succeed without spawning MCP server subprocesses (build-time process spawning is prohibited).

**FR-4.3** — WHEN environment variables are required for optional features (e.g., GitHub MCP server), THEN the application SHALL function without them (demo servers remain available).

**FR-4.4** — WHEN the deployment health check endpoint `/api/health` is called, THEN it SHALL first ensure servers are initialized via `ensureServersInitialized()`, then return connection status for all configured servers; `status: 'healthy'` requires at least 3 demo servers (notes, tasks, calculator) online.

**FR-4.5** — WHEN the Vercel deployment logs are examined, THEN they SHALL include startup diagnostics (which servers initialized, adapter mode, initialization time).

### FR-5: Fixture Data Seeding

**FR-5.1** — WHEN in-process adapters are initialized, THEN notes and tasks servers SHALL load pre-seeded fixture data (3 demo notes, 5 demo tasks with `[DEMO]` prefix in titles).

**FR-5.2** — WHEN fixture data is seeded, THEN it SHALL be loaded from shared core business logic (not duplicated in adapter code).

**FR-5.3** — WHEN users create new notes or tasks, THEN they SHALL appear alongside seeded fixture data (not replaced).

**FR-5.4** — WHEN seeded data is displayed, THEN it SHALL be clearly identifiable via `[DEMO]` prefix in titles.

### FR-6: Documentation and Fallback Strategy

**FR-6.1** — WHEN users fork the repository and deploy to Vercel, THEN README SHALL document that demo servers run in-process with function-instance-scoped state (shared within warm instance, reset on cold start).

**FR-6.2** — WHEN users want persistent state for notes/tasks in production, THEN README SHALL recommend migration to external MCP servers (e.g., hosted on Railway, Fly.io, or separate long-running Node.js service).

**FR-6.3** — WHEN the in-process adapter architecture is explained, THEN documentation SHALL clarify that this is a deployment-specific optimization, not a general MCP pattern.

**FR-6.4** — WHEN users encounter "Router unavailable" errors on Vercel, THEN error messages SHALL include troubleshooting steps (check Vercel logs, verify build succeeded, confirm function timeout).

**FR-6.5** — WHEN using TypeScript core modules (`.ts` files) imported by `.mjs` stdio servers, THEN README SHALL document Node.js version requirement (≥23.6 for native TypeScript support) and verify local Node.js version matches.

---

## Conditional Requirements (Router Incompatibility)

### FR-7: Router Adapter Fallback (Conditional — Only if Task 1.1 Determines Router Incompatible)

**FR-7.1** — IF `mcp-dynamic-router` subprocess fails on Vercel cold start, THEN the system SHALL implement an in-process router adapter or simplified rule-based routing as fallback.

**FR-7.2** — IF fallback routing is implemented, THEN it SHALL match keyword patterns to server names (e.g., "note" → notes, "task" → tasks, numbers → calculator).

**FR-7.3** — IF fallback routing is used, THEN README SHALL document the difference from full router functionality and recommend full router for local development.

---

## Non-Functional Requirements

### NFR-1: Performance

**NFR-1.1** — WHEN measuring cold start latency on Vercel, THEN first request after deployment SHALL complete within 3 seconds (including Next.js initialization + MCP adapter loading).

**NFR-1.2** — WHEN measuring warm function performance, THEN subsequent requests SHALL complete within 500ms for simple queries (e.g., "list notes").

**NFR-1.3** — WHEN three tools are executed sequentially, THEN total execution time SHALL NOT exceed 2 seconds (avoiding timeout risk).

### NFR-2: Reliability

**NFR-2.1** — WHEN Vercel function restarts occur (platform-triggered), THEN the application SHALL recover gracefully and reinitialize adapters without manual intervention.

**NFR-2.2** — WHEN concurrent requests exceed 10, THEN the application SHALL handle them without race conditions or shared state corruption (each request isolated).

**NFR-2.3** — WHEN deployment succeeds but adapters fail to load, THEN health check endpoint SHALL return degraded status and UI SHALL display "Servers initializing..." message.

### NFR-3: Maintainability

**NFR-3.1** — WHEN adding a new demo MCP server, THEN developers SHALL implement both stdio version (for local dev) and in-process adapter (for Vercel) following documented adapter interface.

**NFR-3.2** — WHEN debugging deployment issues, THEN Vercel logs SHALL contain sufficient diagnostic information (adapter mode, server list, initialization timing, error stack traces).

**NFR-3.3** — WHEN running tests locally, THEN test suite SHALL validate both stdio and in-process modes to ensure parity.

### NFR-4: Compliance with Kiroween Rules

**NFR-4.1** — WHEN demonstrating the application to judges, THEN the Vercel deployment SHALL be accessible without VPN, registration, or API keys (requirement: frictionless onboarding).

**NFR-4.2** — WHEN judges inspect the repository, THEN `.kiro/` directory SHALL contain this spec and implementation SHALL match documented design (requirement: no fake Kiro usage).

**NFR-4.3** — WHEN measuring "time to first success", THEN a new user SHALL see working demo (3 connected servers, one successful query) within 60 seconds of opening the Vercel URL.

---

## Open Questions

### Question 1: Persistent State for Production Use Cases

**Question**: Should the in-process adapter optionally support Vercel KV or Postgres for persistent notes/tasks storage?

**Decision**: **Option A** (Ephemeral in-memory state). Simple, zero config, acceptable for demo. Document Option C (external MCP servers) for production use. Defer persistent storage post-competition.

**Status**: ✅ Confirmed

---

### Question 2: Router Dependency Serverless Compatibility

**Question**: Does `mcp-dynamic-router` (spawned via `npx github:...`) work reliably in Vercel serverless environment, or does it require stdio subprocess?

**Decision**: **Option C** (Simplified rule-based routing fallback on Vercel, full router locally). Empirical testing demonstrated that cold-start `npx github:...` downloads require >30s, exceeding Vercel's 10s function timeout. On Vercel, the application falls back to `simplifiedRoute()` (<1ms), while local development retains full stdio router capabilities. See `docs/router-vercel-compatibility-report.md`.

**Status**: ✅ Confirmed (Task 1.1 complete, Task 1.4 activated)

---

### Question 3: Health Check Endpoint Placement

**Question**: Should health check be a dedicated `/api/health` route or integrated into existing dashboard data endpoint?

**Decision**: **Option A** (Dedicated `/api/health` endpoint). Standard pattern, easy to monitor externally, must call `ensureServersInitialized()` before reading manifests.

**Status**: ✅ Confirmed

---

## Success Criteria

The deployment feature is complete when:

1. ✅ **Vercel deployment succeeds**: `main` branch auto-deploys without errors; build logs show successful compilation.

2. ✅ **Demo servers operational**: All three demo servers (notes, tasks, calculator) connect and respond to tool invocations on Vercel.

3. ✅ **No subprocesses spawned**: Vercel logs confirm zero stdio subprocess spawns; all servers run in-process.

4. ✅ **Under timeout threshold**: 95th percentile response time < 5 seconds for typical queries (measured via Vercel Analytics or manual testing).

5. ✅ **Health check functional**: `/api/health` returns JSON with server connection status and responds within 100ms.

6. ✅ **README updated**: Deployment section documents in-process adapter architecture, Vercel-specific behavior, and troubleshooting steps.

7. ✅ **Zero-config experience**: Judges opening Vercel URL see "3 servers connected" within 60 seconds without configuration.

8. ✅ **Tests pass**: Local test suite validates both stdio (dev) and in-process (Vercel) adapter modes with identical tool behavior.

---

## Traceability to Build Plan

| Build Plan Section | Requirements Coverage |
|--------------------|----------------------|
| §2.7 (Zero API keys) | FR-1.6, FR-4.3, NFR-4.1 |
| §3 (Vercel deployment) | FR-4.1–FR-4.5 |
| §7 Week 4 (deployment stability) | NFR-2.1–NFR-2.3 |
| §9 (60-second first success) | NFR-4.3 |
| AGENTS.md §2.4 (Fail-Closed defaults) | FR-2.4, FR-3.5, FR-6.4 |
| AGENTS.md §2.7 (No fake success) | FR-1.7, FR-6.1 |
| AGENTS.md §1.2 (No breaking router) | FR-7.1–7.3 (conditional fallback) |

---

## Related Specifications

- **router-core**: Defines MCP server registration and routing; deployment extends this with dual-mode manager.
- **monster-lab-dashboard**: Health check endpoint provides data for dashboard server status display.
- **playground-chat**: API route optimization (FR-3.2) directly impacts playground query response time.
