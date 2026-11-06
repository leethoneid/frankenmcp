import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ensureServersInitialized, _resetServerInitForTesting } from '@/lib/server/init';
import { MCPServerManager } from '@/lib/mcp/server-manager';

describe('Playground Chat - Task 3.1: Server Initialization Module', () => {
  beforeEach(async () => {
    _resetServerInitForTesting();
    await MCPServerManager.resetInstance();
  });

  afterEach(async () => {
    _resetServerInitForTesting();
    await MCPServerManager.resetInstance();
    vi.restoreAllMocks();
  });

  it('initializes servers on first call by loading config and connecting all servers', async () => {
    const manager = MCPServerManager.getInstance();
    const loadSpy = vi.spyOn(manager, 'loadAndRegisterConfig').mockReturnValue([]);
    const connectSpy = vi.spyOn(manager, 'connectAll').mockImplementation(async () => {});

    await ensureServersInitialized();

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(loadSpy).toHaveBeenCalledWith(expect.stringContaining('mcp.json'));
    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it('is idempotent: second call returns immediately without re-initializing', async () => {
    const manager = MCPServerManager.getInstance();
    const loadSpy = vi.spyOn(manager, 'loadAndRegisterConfig').mockReturnValue([]);
    const connectSpy = vi.spyOn(manager, 'connectAll').mockImplementation(async () => {});

    await ensureServersInitialized();
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(connectSpy).toHaveBeenCalledTimes(1);

    // Second call
    await ensureServersInitialized();
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it('allows re-initialization after reset for test isolation', async () => {
    const manager = MCPServerManager.getInstance();
    const loadSpy = vi.spyOn(manager, 'loadAndRegisterConfig').mockReturnValue([]);
    const connectSpy = vi.spyOn(manager, 'connectAll').mockImplementation(async () => {});

    await ensureServersInitialized();
    expect(connectSpy).toHaveBeenCalledTimes(1);

    _resetServerInitForTesting();

    await ensureServersInitialized();
    expect(connectSpy).toHaveBeenCalledTimes(2);
  });
});
