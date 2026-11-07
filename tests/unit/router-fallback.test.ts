import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { simplifiedRoute, getFallbackSearchResults } from '@/lib/router/fallback';
import { routeIntent, setRouterClient } from '@/lib/router/adapter';
import { RouterUnavailableError } from '@/lib/router/types';
import type { ServerManifest } from '@/lib/router/types';

describe('Deployment - Task 1.4: Router Fallback Implementation', () => {
  const originalVercel = process.env.VERCEL;

  const mockServers: ServerManifest[] = [
    {
      id: 'notes',
      name: 'Notes Server',
      transport: 'stdio',
      status: 'connected',
      tools: [
        { name: 'create_note', description: 'Create note', inputSchema: { type: 'object' } },
        { name: 'read_note', description: 'Read note', inputSchema: { type: 'object' } },
        { name: 'list_notes', description: 'List notes', inputSchema: { type: 'object' } },
        { name: 'update_note', description: 'Update note', inputSchema: { type: 'object' } },
        { name: 'delete_note', description: 'Delete note', inputSchema: { type: 'object' } },
      ],
    },
    {
      id: 'tasks',
      name: 'Tasks Server',
      transport: 'stdio',
      status: 'connected',
      tools: [
        { name: 'create_task', description: 'Create task', inputSchema: { type: 'object' } },
        { name: 'list_tasks', description: 'List tasks', inputSchema: { type: 'object' } },
        { name: 'toggle_task_completion', description: 'Toggle task', inputSchema: { type: 'object' } },
      ],
    },
    {
      id: 'calculator',
      name: 'Calculator Server',
      transport: 'stdio',
      status: 'connected',
      tools: [
        { name: 'add', description: 'Add numbers', inputSchema: { type: 'object' } },
        { name: 'convert_units', description: 'Convert units', inputSchema: { type: 'object' } },
      ],
    },
  ];

  beforeEach(() => {
    delete process.env.VERCEL;
  });

  afterEach(() => {
    if (originalVercel !== undefined) {
      process.env.VERCEL = originalVercel;
    } else {
      delete process.env.VERCEL;
    }
  });

  describe('simplifiedRoute keyword matching accuracy', () => {
    it('routes notes queries to notes server', () => {
      expect(simplifiedRoute('Add a note about the meeting')).toEqual(['notes']);
      expect(simplifiedRoute('Read my project notes')).toEqual(['notes']);
      expect(simplifiedRoute('Delete note 123')).toEqual(['notes']);
      expect(simplifiedRoute('Note: check logs')).toEqual(['notes']);
    });

    it('routes task and todo queries to tasks server', () => {
      expect(simplifiedRoute('Show my tasks')).toEqual(['tasks']);
      expect(simplifiedRoute('Add a new task for tomorrow')).toEqual(['tasks']);
      expect(simplifiedRoute('Check off my todo item')).toEqual(['tasks']);
      expect(simplifiedRoute('List all pending todos')).toEqual(['tasks']);
    });

    it('routes arithmetic and math queries to calculator server', () => {
      expect(simplifiedRoute('What is 42 + 58?')).toEqual(['calculator']);
      expect(simplifiedRoute('Calculate 15 * 8')).toEqual(['calculator']);
      expect(simplifiedRoute('100 / 4')).toEqual(['calculator']);
      expect(simplifiedRoute('Math sum of 25 and 75')).toEqual(['calculator']);
      expect(simplifiedRoute('Convert 100 meters to feet')).toEqual(['calculator']);
    });

    it('routes unrecognized queries to all servers as fallback', () => {
      expect(simplifiedRoute('How is the weather today?')).toEqual(['notes', 'tasks', 'calculator']);
      expect(simplifiedRoute('Who was the 16th president?')).toEqual(['notes', 'tasks', 'calculator']);
    });

    it('achieves >= 90% routing accuracy on common dataset', () => {
      const testCases: { query: string; expected: string }[] = [
        { query: 'Create a meeting note', expected: 'notes' },
        { query: 'Review meeting notes', expected: 'notes' },
        { query: 'Take a quick note', expected: 'notes' },
        { query: 'Show notes list', expected: 'notes' },
        { query: 'List high priority tasks', expected: 'tasks' },
        { query: 'Add task buy groceries', expected: 'tasks' },
        { query: 'Mark task as done', expected: 'tasks' },
        { query: 'Update my todo list', expected: 'tasks' },
        { query: 'What is 15 + 27?', expected: 'calculator' },
        { query: 'Calculate 99 / 3', expected: 'calculator' },
        { query: 'Add 12 and 34', expected: 'calculator' },
        { query: 'Math calculation for taxes', expected: 'calculator' },
      ];

      let correct = 0;
      for (const tc of testCases) {
        const routes = simplifiedRoute(tc.query);
        if (routes.includes(tc.expected)) {
          correct++;
        }
      }

      const accuracy = correct / testCases.length;
      expect(accuracy).toBeGreaterThanOrEqual(0.9);
      expect(accuracy).toBe(1.0); // 100% accuracy on standard domain queries
    });
  });

  describe('getFallbackSearchResults tool extraction', () => {
    it('returns SearchResults with scores and tool metadata', () => {
      const results = getFallbackSearchResults('Add a note about release', mockServers);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.server === 'notes')).toBe(true);
      expect(results.some((r) => r.tool === 'create_note')).toBe(true);
    });

    it('extracts calculator tools for arithmetic queries', () => {
      const results = getFallbackSearchResults('Calculate 50 + 50', mockServers);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.server === 'calculator')).toBe(true);
      expect(results.some((r) => r.tool === 'add')).toBe(true);
    });
  });

  describe('routeIntent Vercel integration', () => {
    it('uses fallback routing when VERCEL=1 is set', async () => {
      process.env.VERCEL = '1';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const decision = await routeIntent('Add a note about meeting', mockServers, {
        bypassCache: true,
      });

      expect(decision.selectedServers).toContain('notes');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Router] Running on Vercel: using in-process router fallback')
      );

      warnSpy.mockRestore();
    });

    it('falls back to in-process router if router process is unavailable', async () => {
      delete process.env.VERCEL;
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const failingClient = {
        callTool: vi.fn().mockRejectedValue(new RouterUnavailableError(new Error('Process exited unexpectedly'))),
      } as any;
      setRouterClient(failingClient);

      const decision = await routeIntent('Show my tasks', mockServers, {
        bypassCache: true,
      });

      expect(decision.selectedServers).toContain('tasks');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Router subprocess unavailable: falling back')
      );

      setRouterClient(null);
      warnSpy.mockRestore();
    });
  });
});
