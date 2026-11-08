import { NextResponse } from 'next/server';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import { ensureServersInitialized } from '@/lib/server/init';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureServersInitialized();

    const manager = MCPServerManager.getInstance();

    // Actively check server health before returning manifests
    await manager.runHealthCheckRound();

    const manifests = manager.getServerManifests();
    return NextResponse.json({ manifests });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch server status';
    return NextResponse.json(
      { error: message || 'Failed to fetch server status' },
      { status: 500 }
    );
  }
}
