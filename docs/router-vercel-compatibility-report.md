# Router Vercel Compatibility Investigation Report (Task 1.1)

**Date**: 2026-11-06  
**Investigator**: Kiro / Antigravity Agent  
**Status**: Completed  
**Outcome**: Router subprocess via `npx` **incompatible** with Vercel serverless cold starts. **Task 1.4 (Router Fallback Implementation) is required and triggered.**

---

## 1. Executive Summary

As required by Task 1.1 of the Deployment specification, we investigated whether the dynamic router (`npx -y github:leethoneid/mcp-dynamic-router serve`) can reliably execute in a Vercel serverless function environment.

**Key Finding**:
Running `npx -y github:leethoneid/mcp-dynamic-router serve` in an uncached cold-start environment takes **>30,000 ms** (timed out). Even under warm cache network checks, git remote negotiation takes **>15,000 ms**. Because Vercel's free/hobby tier enforces a strict **10,000 ms (10-second) hard execution timeout**, spawning the router via `npx` on cold start triggers a **100% failure rate (HTTP 504 Gateway Timeout)**.

Therefore, under **FR-7.1–FR-7.3** and **Task 1.4**, FrankenMCP must deploy a fast in-process fallback router (`simplifiedRoute()`) on Vercel when `process.env.VERCEL === '1'`, while maintaining full stdio router capabilities in local development.

---

## 2. Empirical Benchmark Data

| Scenario | Cache Condition | Command | Measured Latency | Vercel 10s Limit Result |
| :--- | :--- | :--- | :--- | :--- |
| **True Cold Start** | Empty temp cache (`--cache <tempDir>`) | `npx -y github:leethoneid/mcp-dynamic-router --version` | **>30,000 ms** (ETIMEDOUT) | ❌ **FAIL** (>300% of 10s timeout) |
| **Warm Start** | Pre-cached package | `npx -y github:leethoneid/mcp-dynamic-router --help` | **>15,000 ms** (Remote git check) | ❌ **FAIL** (>150% of 10s timeout) |
| **Local Stdio Process** | Local node module / fixture | `node tests/integration/fixtures/test-stdio-router.mjs` | **~25 ms** | ✅ **PASS** (Local only) |
| **In-Process Fallback** | In-memory keyword triage | `simplifiedRoute(intent)` | **< 1 ms** | ✅ **PASS** (Ideal for Vercel) |

---

## 3. Technical Root Cause Analysis

1. **Network Git Resolution Overhead**:
   `npx -y github:leethoneid/mcp-dynamic-router` specifies a remote GitHub repository. Before running, `npm` must query `api.github.com` and `github.com` via git/HTTPS to resolve HEAD commit hashes, download tarballs, and unpack dependencies. Under normal network conditions, this alone takes 15–30+ seconds.
2. **Ephemeral Serverless Sandboxes**:
   Vercel serverless functions run on ephemeral AWS Lambda microVMs. Cold start containers start without pre-existing `~/.npm/_npx` cache. Only `/tmp` is writable; `/var/task` is strictly read-only.
3. **Hard Timeout Ceilings**:
   Vercel Hobby plan functions are terminated after 10 seconds. Spawning `npx` over the network exceeds this limit on every new container startup.
4. **Process Lifecycle Restrictions**:
   Serverless functions freeze or terminate all child processes as soon as the HTTP response terminates. Long-lived stdio IPC background processes cannot survive across serverless invocations.

---

## 4. Architectural Decision & Action Plan

- **Decision**: Adopt **Option C** from `requirements.md` Open Question 2:
  - **Local Development (`process.env.VERCEL !== '1'`)**: Continue using the full `mcp-dynamic-router` via stdio subprocess.
  - **Vercel Serverless (`process.env.VERCEL === '1'`)**: Automatically activate `src/lib/router/fallback.ts` using zero-dependency keyword and regex matching (`simplifiedRoute()`), completing routing decisions in **<1ms** with zero network calls and zero subprocesses.
- **Spec Status Updates**:
  - `requirements.md` Open Question 2 marked as **Resolved (Option C)**.
  - `tasks.md` Task 1.1 marked as **Done `[x]`**.
  - `tasks.md` Task 1.4 marked as **Required and Activated**.
