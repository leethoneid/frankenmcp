import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/health/route';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import { _resetServerInitForTesting } from '@/lib/server/init';

describe('Task 3.2: Health Check API Integration Tests', () => {
  const originalVercel = process.env.VERCEL;

  beforeEach(async () => {
    _resetServerInitForTesting();
    await MCPServerManager.resetInstance();
  });

  afterEach(async () => {
    process.env.VERCEL = originalVercel;
    _resetServerInitForTesting();
    await MCPServerManager.resetInstance();
  });

  describe('Vercel In-Process Environment (VERCEL=1)', () => {
    it('initializes servers, reports healthy with 3 in-process servers, and responds in <100ms', async () => {
      process.env.VERCEL = '1';

      // 1. Initial invocation (triggers lazy server init)
      const res1 = await GET();
      expect(res1.status).toBe(200);

      const body1 = await res1.json();
      expect(body1.status).toBe('healthy');
      expect(body1.environment).toBe('vercel');
      expect(body1.servers).toHaveLength(3);

      const ids = body1.servers.map((s: any) => s.id);
      expect(ids).toContain('notes');
      expect(ids).toContain('tasks');
      expect(ids).toContain('calculator');

      for (const s of body1.servers) {
        expect(s.status).toBe('connected');
        expect(s.transport).toBe('in-process');
        expect(s.toolCount).toBe(5);
      }

      // 2. Measure response time on warm invocation (must be <100ms)
      const startTime = performance.now();
      const res2 = await GET();
      const durationMs = performance.now() - startTime;

      expect(res2.status).toBe(200);
      expect(durationMs).toBeLessThan(100);
    });
  });

  describe('Local Environment (VERCEL undefined)', () => {
    it('initializes stdio servers and reports healthy status', async () => {
      delete process.env.VERCEL;

      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('healthy');
      expect(body.environment).toBe('local');
      expect(body.servers.length).toBeGreaterThanOrEqual(3);

      const notes = body.servers.find((s: any) => s.id === 'notes');
      expect(notes).toBeDefined();
      expect(notes.status).toBe('connected');
      expect(notes.transport).toBe('stdio');
      expect(notes.toolCount).toBe(5);
    }, 15000);
  });
});
