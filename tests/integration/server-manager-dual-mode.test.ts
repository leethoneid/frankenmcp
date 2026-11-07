import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import { ServerConfig, ToolInvocationError } from '@/lib/router/types';

describe('Task 2.4: Dual-Mode MCPServerManager', () => {
  const originalEnv = process.env.VERCEL;

  beforeEach(async () => {
    await MCPServerManager.resetInstance();
  });

  afterEach(async () => {
    process.env.VERCEL = originalEnv;
    await MCPServerManager.resetInstance();
  });

  describe('Vercel In-Process Mode (process.env.VERCEL = "1")', () => {
    it('loads 3 in-process adapters without spawning child processes in <100ms', async () => {
      process.env.VERCEL = '1';

      const manager = MCPServerManager.getInstance();

      const startTime = performance.now();
      await manager.connectAll();
      const durationMs = performance.now() - startTime;

      // Verify adapter initialization completes in <100ms
      expect(durationMs).toBeLessThan(100);

      // Verify manifests
      const manifests = manager.getServerManifests();
      expect(manifests).toHaveLength(3);

      const serverIDs = manifests.map((m) => m.id);
      expect(serverIDs).toContain('notes');
      expect(serverIDs).toContain('tasks');
      expect(serverIDs).toContain('calculator');

      // Verify transport is marked as 'in-process'
      for (const m of manifests) {
        expect(m.status).toBe('connected');
        expect(m.transport).toBe('in-process');
        expect(m.tools.length).toBe(5);
      }
    });

    it('invokes tools directly in-process and produces valid results', async () => {
      process.env.VERCEL = '1';

      const manager = MCPServerManager.getInstance();
      await manager.connectAll();

      // 1. Calculator
      const calcRes = (await manager.invokeToolCall('calculator', 'add', { a: 25, b: 75 })) as {
        result: number;
      };
      expect(calcRes.result).toBe(100);

      // 2. Notes
      const notesList = (await manager.invokeToolCall('notes', 'list_notes')) as Array<{
        id: string;
        title: string;
      }>;
      expect(notesList.length).toBeGreaterThanOrEqual(3);

      // 3. Tasks
      const tasksList = (await manager.invokeToolCall('tasks', 'list_tasks')) as Array<{
        id: string;
        title: string;
      }>;
      expect(tasksList.length).toBeGreaterThanOrEqual(5);
    });

    it('fails loud with ToolInvocationError on invalid tool or bad args', async () => {
      process.env.VERCEL = '1';

      const manager = MCPServerManager.getInstance();
      await manager.connectAll();

      try {
        await manager.invokeToolCall('calculator', 'unknown_tool');
        expect.unreachable('Should have thrown ToolInvocationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ToolInvocationError);
        expect((err as ToolInvocationError).toolName).toBe('unknown_tool');
        expect(((err as ToolInvocationError).cause as Error).message).toContain("Unknown tool: 'unknown_tool'");
      }

      try {
        await manager.invokeToolCall('calculator', 'divide', { a: 10, b: 0 });
        expect.unreachable('Should have thrown ToolInvocationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ToolInvocationError);
        expect((err as ToolInvocationError).toolName).toBe('divide');
        expect(((err as ToolInvocationError).cause as Error).message).toContain('Division by zero is not allowed');
      }
    });
  });

  describe('Local Stdio Mode (process.env.VERCEL undefined)', () => {
    it('spawns stdio servers and invokes tools via stdio client', async () => {
      delete process.env.VERCEL;

      const manager = MCPServerManager.getInstance();
      const calcPath = path.resolve(process.cwd(), 'src', 'mcp-servers', 'calculator', 'index.mjs');

      const config: ServerConfig = {
        id: 'calculator-stdio',
        name: 'Calculator Stdio Server',
        transport: 'stdio',
        command: 'node',
        args: [calcPath],
      };

      manager.registerServer(config);
      await manager.connectServer('calculator-stdio');

      expect(manager.getServerStatus('calculator-stdio')).toBe('connected');

      const manifests = manager.getServerManifests();
      const calcManifest = manifests.find((m) => m.id === 'calculator-stdio');
      expect(calcManifest).toBeDefined();
      expect(calcManifest?.transport).toBe('stdio');
      expect(calcManifest?.tools.length).toBe(5);

      const res = (await manager.invokeToolCall('calculator-stdio', 'multiply', { a: 6, b: 9 })) as {
        content: Array<{ text: string }>;
      };
      const parsed = JSON.parse(res.content[0].text);
      expect(parsed.result).toBe(54);
    });
  });
});
