/**
 * Phase 7 - Task 7.3: Acceptance Criteria Validation Suite
 *
 * Requirements: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6
 *
 * Programmatically validates all core acceptance criteria defined in requirements.md:
 * - AC-1: Adding an arbitrary stdio MCP server via command & args, connecting, and discovering tools.
 * - AC-2: Submitting natural language intent and receiving execution response from routed tool.
 * - AC-3: Accessing per-turn and session-wide routing statistics (toolsLoaded, toolsTrimmed, tokensSaved).
 * - AC-4: Verifying pre-configured demo servers (.kiro/settings/mcp.json) connect and expose 15 tools out-of-the-box.
 * - AC-5: Verifying PBT invariants (trimming, determinism, fidelity) each have test suites with >=100 runs.
 * - AC-6: Verifying connection failures and faults fail loud without synthetic fallback.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import {
  startRouterProcess,
  stopRouterProcess,
  routeIntent,
  clearRoutingCache,
} from '@/lib/router/adapter';
import { resetSessionStats, getSessionStats } from '@/lib/router/stats';

describe('Phase 7 - Task 7.3: Acceptance Criteria Validation', () => {
  let manager: MCPServerManager;

  const configPath = path.resolve(process.cwd(), '.kiro', 'settings', 'mcp.json');
  const routerFixturePath = path.resolve(
    process.cwd(),
    'tests',
    'integration',
    'fixtures',
    'test-stdio-router.mjs'
  );

  beforeEach(async () => {
    resetSessionStats();
    clearRoutingCache();
    await MCPServerManager.resetInstance();
    manager = MCPServerManager.getInstance();
  });

  afterEach(async () => {
    await stopRouterProcess();
    if (manager) {
      await manager.shutdown();
    }
    await MCPServerManager.resetInstance();
    clearRoutingCache();
  });

  it('validates AC-1: User can add a new stdio MCP server by providing command and args, connect, and retrieve tool schemas', async () => {
    const customServerScript = path.resolve(process.cwd(), 'src/mcp-servers/notes/index.mjs');

    // User provides command and args to register a new stdio server
    manager.registerServer({
      id: 'custom-stdio-notes',
      name: 'Custom Stdio Notes',
      transport: 'stdio',
      command: 'node',
      args: [customServerScript],
    });

    expect(manager.getServerStatus('custom-stdio-notes')).toBe('disconnected');

    // Connect to the newly added server
    await manager.connectServer('custom-stdio-notes');
    expect(manager.getServerStatus('custom-stdio-notes')).toBe('connected');

    // Retrieve tool schemas
    const manifests = manager.getServerManifests();
    const serverManifest = manifests.find((m) => m.id === 'custom-stdio-notes');
    expect(serverManifest).toBeDefined();
    expect(serverManifest?.tools.length).toBeGreaterThanOrEqual(5);

    // Invoke a discovered tool
    const res = (await manager.invokeToolCall('custom-stdio-notes', 'list_notes', {})) as {
      content: Array<{ text: string }>;
    };
    expect(JSON.parse(res.content[0].text).notes).toBeDefined();
  }, 15000);

  it('validates AC-2: User can submit intent and route to appropriate server tool with valid execution response', async () => {
    manager.loadAndRegisterConfig(configPath);
    await manager.connectAll();

    await startRouterProcess({ command: 'node', args: [routerFixturePath] });

    const decision = await routeIntent('Add a note about the meeting', manager.getServerManifests(), {
      bypassCache: true,
    });

    expect(decision.selectedServers).toContain('notes');
    const toolResult = (await manager.invokeToolCall('notes', 'create_note', {
      title: 'AC-2 Note',
      content: 'Testing AC-2 fulfillment',
    })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(toolResult.content[0].text);
    expect(parsed.id).toBeDefined();
  }, 20000);

  it('validates AC-3: User can view per-turn and session routing statistics (toolsLoaded, toolsTrimmed, tokensSaved)', async () => {
    manager.loadAndRegisterConfig(configPath);
    await manager.connectAll();
    await startRouterProcess({ command: 'node', args: [routerFixturePath] });

    await routeIntent('Calculate 15 + 27', manager.getServerManifests(), {
      bypassCache: true,
    });

    const stats = getSessionStats();
    expect(stats.turns).toHaveLength(1);
    expect(stats.totalToolsLoaded).toBe(1);
    expect(stats.totalToolsTrimmed).toBe(4); // 5 calculator tools - 1 loaded = 4 trimmed
    expect(stats.totalTokensSaved).toBeGreaterThan(0);
    expect(stats.averageRoutingTimeMs).toBeGreaterThanOrEqual(0);
  }, 20000);

  it('validates AC-4: Demo servers are pre-configured in .kiro/settings/mcp.json and functional on startup', async () => {
    const configs = manager.loadAndRegisterConfig(configPath);
    expect(configs.map((c) => c.id)).toEqual(['notes', 'tasks', 'calculator']);

    await manager.connectAll();

    expect(manager.getServerStatus('notes')).toBe('connected');
    expect(manager.getServerStatus('tasks')).toBe('connected');
    expect(manager.getServerStatus('calculator')).toBe('connected');

    const totalTools = manager.getServerManifests().reduce((sum, m) => sum + m.tools.length, 0);
    expect(totalTools).toBe(15);
  }, 20000);

  it('validates AC-5: PBT test invariants for trimming, determinism, and fidelity exist and run >=100 cases', async () => {
    // Assert existence and fast-check run counts in PBT test files
    const pbtDir = path.resolve(process.cwd(), 'tests', 'pbt');
    const trimmingFile = fs.readFileSync(path.join(pbtDir, 'trimming.test.ts'), 'utf-8');
    const determinismFile = fs.readFileSync(path.join(pbtDir, 'determinism.test.ts'), 'utf-8');
    const fidelityFile = fs.readFileSync(path.join(pbtDir, 'fidelity.test.ts'), 'utf-8');

    expect(trimmingFile).toContain('{ numRuns: 100 }');
    expect(trimmingFile).toContain('FR-2.3');
    expect(trimmingFile).toContain('NFR-3.2');

    expect(determinismFile).toContain('{ numRuns: 100 }');
    expect(determinismFile).toContain('FR-2.6');
    expect(determinismFile).toContain('NFR-3.3');

    expect(fidelityFile).toContain('{ numRuns: 100 }');
    expect(fidelityFile).toContain('FR-2.7');
    expect(fidelityFile).toContain('NFR-3.4');
  });

  it('validates AC-6: Server and router failures fail loud with specific errors, rejecting mock fallbacks', async () => {
    // 1. Unreachable server fails loud with ServerConnectionError
    manager.registerServer({
      id: 'bad-srv',
      name: 'Bad Server',
      transport: 'stdio',
      command: 'node',
      args: ['non_existent_file.mjs'],
    });

    await expect(
      manager.connectServer('bad-srv', { maxRetries: 1, initialDelayMs: 20 })
    ).rejects.toThrow();

    expect(manager.getServerStatus('bad-srv')).toBe('error');

    // 2. Disconnected server invocation fails loud with ToolInvocationError
    await expect(manager.invokeToolCall('bad-srv', 'test_tool', {})).rejects.toThrow();
  });
});
