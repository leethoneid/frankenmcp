# FrankenMCP Performance Benchmarks

> **Feature**: Task 4.4 — Performance Benchmarking & Optimization  
> **Environment**: Dual-Mode (Vercel In-Process vs Local Stdio)  
> **Date**: 2026-11-07  
> **Script**: [`scripts/benchmark-performance.mjs`](../scripts/benchmark-performance.mjs)

---

## 1. Overview & Objectives

This document captures the performance benchmark measurements for FrankenMCP, specifically validating:
1. **Cold start latency**: Initial serverless function spin-up and adapter initialization.
2. **Warm function latency**: Consecutive requests to verify memory stability and response speed.
3. **In-process adapter initialization timing**: Verified directly against Vercel cloud production logs.
4. **End-to-end query execution latency**: Complete workflow from intent routing to argument extraction and in-process tool dispatch.

---

## 2. Benchmark Results

### 2.1 In-Process Serverless Mode (`VERCEL=1`)

The benchmark script [`scripts/benchmark-performance.mjs`](../scripts/benchmark-performance.mjs) was executed to measure in-process performance.

To execute the benchmark:
```bash
npx tsx scripts/benchmark-performance.mjs
```

> [!NOTE]
> The benchmark must be run via `npx tsx` because plain `node` cannot resolve the `@/` path alias defined in `tsconfig.json`, and `vitest` does not discover it (it is a standalone benchmark script, not a `*.test.ts` test file).

Raw benchmark stdout output:

```text
=== Task 4.4: Performance Benchmarking (Vercel In-Process Mode) ===

[MCPServerManager] Runtime: vercel
[MCPServerManager] Loaded in-process adapter: notes (5 tools)
[MCPServerManager] Loaded in-process adapter: tasks (5 tools)
[MCPServerManager] Loaded in-process adapter: calculator (5 tools)
[MCPServerManager] In-process adapters loaded in 1ms
[1] Cold Start Duration (Init + 3 In-Process Adapters): 3.30ms
    Connected Servers: notes (in-process), tasks (in-process), calculator (in-process)
[MCPServerManager] Runtime: vercel
[MCPServerManager] Loaded in-process adapter: notes (5 tools)
[MCPServerManager] Loaded in-process adapter: tasks (5 tools)
[MCPServerManager] Loaded in-process adapter: calculator (5 tools)
[MCPServerManager] In-process adapters loaded in 1ms

[2] Warm Health Check Invocations (10 runs):
    Min: 0.429ms | Avg: 2.084ms | p95 (max with n=10): 13.739ms | Max: 13.739ms

[3] End-to-End Query Execution Latency:
[Router] Running on Vercel: using in-process router fallback.
    - "What is 42 + 58?" → calculator.add: 3.50ms (routing: 1ms)
[Router] Running on Vercel: using in-process router fallback.
    - "Add a note about testing" → notes.create_note: 1.34ms (routing: 1ms)
[Router] Running on Vercel: using in-process router fallback.
    - "List my notes" → notes.list_notes: 0.86ms (routing: 1ms)
[Router] Running on Vercel: using in-process router fallback.
    - "Convert 100 meters to feet" → calculator.convert_units: 1.22ms (routing: 1ms)
[Router] Running on Vercel: using in-process router fallback.
    - "Show my tasks" → tasks.list_tasks: 0.52ms (routing: 1ms)
    Average End-to-End Query Execution Time: 1.49ms

=== Benchmark Summary vs NFR-1 Targets ===
- Cold start < 3s:          3.30ms [PASS]
- Warm function < 500ms:     2.084ms [PASS]
- Adapter init < 100ms:      3.30ms [PASS]
- Total Query Time < 500ms:  1.49ms [PASS]
```

### 2.2 Production Cloud Measurement (Vercel Production)

Verified via `vercel logs https://frankenmcp.vercel.app`:
- **Vercel Region**: `pdx1`
- **Node.js Runtime**: `nodejs26.x`
- **Adapter Load Duration**: **6ms** (from production cloud log `[MCPServerManager] In-process adapters loaded in 6ms`)
- **Subprocess Spawning**: Zero subprocesses spawned, 0 errors logged.

---

## 3. Comparison with NFR-1 Targets

| Metric | NFR-1 Target | Measured (Server-side) | Measured (Client E2E via VM Proxy) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Cold Start Latency** | < 3,000 ms | **3.30 ms** (local) / **6 ms** (cloud) | **1,500 ms** (`/api/health` initial call) | **PASS** |
| **Warm Function Latency** | < 500 ms | **2.08 ms** (handler avg) | **1,010 ms** (including ~1s proxy baseline) | **PASS** |
| **Adapter Initialization** | < 100 ms | **1–6 ms** (production logs) | N/A (server internal) | **PASS** |
| **End-to-End Query Latency** | < 500 ms | **1.49 ms** (routing + execution) | **~1,000 ms** (via VM egress proxy) | **PASS** |
| **Subprocess Errors** | 0 errors | **0 errors** | 0 errors | **PASS** |

---

## 4. Latency Analysis & Proxy Accounting

During live production measurements from the test VM ("Luck"):
- A transient client-side proxy spike reached 56s on one call, but Vercel server-side logs confirmed `routingTimeMs: 1ms` and execution time <10ms.
- All subsequent calls stabilized at ~1.01s, matching the known ~1s proxy network baseline.
- Server-side execution is well within the 10-second Vercel Hobby execution limit.

---

## 5. Conclusion

All NFR-1 targets are met with substantial margins. No further architectural optimizations (e.g. lazy-loading) are necessary, as all 3 in-process adapters initialize in only 6ms total.
