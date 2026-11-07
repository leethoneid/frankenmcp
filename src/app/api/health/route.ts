/**
 * @file route.ts
 * @description Health check endpoint for FrankenMCP.
 * Reports server connection status and runtime mode (Vercel vs Local).
 */

import { NextResponse } from 'next/server';
import { ensureServersInitialized } from '@/lib/server/init';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import { detectEnvironment } from '@/lib/deployment/env';

export async function GET() {
  try {
    // 1. Ensure servers are connected before checking status
    await ensureServersInitialized();

    const manager = MCPServerManager.getInstance();
    const manifests = manager.getServerManifests();

    const servers = manifests.map((m) => ({
      id: m.id,
      name: m.name,
      status: m.status,
      transport: m.transport,
      toolCount: m.tools.length,
    }));

    // 2. Health calculation: requires at least 3 demo servers online
    const demoServers = ['notes', 'tasks', 'calculator'];
    const onlineDemoServers = servers.filter(
      (s) => demoServers.includes(s.id) && s.status === 'connected'
    );

    let status: 'healthy' | 'degraded' | 'error';
    if (onlineDemoServers.length >= 3) {
      status = 'healthy';
    } else if (onlineDemoServers.length > 0) {
      status = 'degraded';
    } else {
      status = 'error';
    }

    const httpStatus = status === 'error' ? 503 : 200;

    return NextResponse.json(
      {
        status,
        environment: detectEnvironment(),
        servers,
        timestamp: new Date().toISOString(),
      },
      { status: httpStatus }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error during server initialization';
    return NextResponse.json(
      {
        status: 'error',
        environment: detectEnvironment(),
        servers: [],
        error: errorMsg,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
