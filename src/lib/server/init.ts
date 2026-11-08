/**
 * @file init.ts
 * @description Lazy server initialization module for demo MCP servers.
 * Connects pre-configured stdio servers on demand in server-side API routes.
 */

import path from 'path';
import { MCPServerManager } from '@/lib/mcp/server-manager';

let initialized = false;

/**
 * Ensures demo MCP servers are loaded from configuration and connected.
 * Subsequent calls are no-ops (idempotent).
 */
export async function ensureServersInitialized(): Promise<void> {
  if (initialized) {
    return;
  }

  const manager = MCPServerManager.getInstance();
  if (
    manager.getServerStatus('notes') === 'connected' &&
    manager.getServerStatus('tasks') === 'connected' &&
    manager.getServerStatus('calculator') === 'connected'
  ) {
    initialized = true;
    return;
  }

  const configPath = path.resolve(process.cwd(), '.kiro', 'settings', 'mcp.json');
  try {
    manager.loadAndRegisterConfig(configPath);
  } catch (err) {
    console.warn('[ServerInit] Config file loading skipped or failed:', err);
  }
  await manager.connectAll();

  initialized = true;
}

/**
 * Reset initialization state for test isolation.
 */
export function _resetServerInitForTesting(): void {
  initialized = false;
}
