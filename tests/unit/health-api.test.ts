import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET } from '@/app/api/health/route';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import * as serverInit from '@/lib/server/init';

vi.mock('@/lib/server/init', () => ({
  ensureServersInitialized: vi.fn().mockResolvedValue(undefined),
  _resetServerInitForTesting: vi.fn(),
}));

describe('Task 3.2: Health Check API Route Unit Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await MCPServerManager.resetInstance();
  });

  afterEach(async () => {
    await MCPServerManager.resetInstance();
  });

  it('calls ensureServersInitialized() before reading manifests', async () => {
    const res = await GET();
    expect(serverInit.ensureServersInitialized).toHaveBeenCalledTimes(1);
    expect(res.status).toBeDefined();
  });

  it('returns healthy (200) when all 3 demo servers are connected', async () => {
    const manager = MCPServerManager.getInstance();
    // Load in-process adapters
    await manager.loadInProcessAdapters();

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.environment).toBeDefined();
    expect(body.timestamp).toBeDefined();
    expect(body.servers).toHaveLength(3);

    for (const server of body.servers) {
      expect(server.status).toBe('connected');
      expect(server.toolCount).toBe(5);
      expect(server.transport).toBe('in-process');
    }
  });

  it('returns degraded (200) when only 1-2 demo servers are connected', async () => {
    const manager = MCPServerManager.getInstance();
    // Connect only notes adapter
    const { NotesAdapter } = await import('@/mcp-servers/notes/adapter');
    await manager.loadInProcessAdapters([new NotesAdapter()]);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('degraded');
    expect(body.servers).toHaveLength(1);
    expect(body.servers[0].id).toBe('notes');
  });

  it('returns error (503) when 0 demo servers are connected', async () => {
    // Empty manager (no servers)
    const response = await GET();
    expect(response.status).toBe(503);

    const body = await response.json();
    expect(body.status).toBe('error');
    expect(body.servers).toEqual([]);
  });

  it('returns error (503) when ensureServersInitialized throws an error', async () => {
    vi.mocked(serverInit.ensureServersInitialized).mockRejectedValueOnce(
      new Error('Failed to bind transport socket')
    );

    const response = await GET();
    expect(response.status).toBe(503);

    const body = await response.json();
    expect(body.status).toBe('error');
    expect(body.error).toContain('Failed to bind transport socket');
  });
});
