import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  RouterUnavailableError,
  RoutingTimeoutError,
  InvalidRoutingDecisionError,
  NoRelevantToolsError,
  ServerConnectionError,
  ToolInvocationError,
  MCPConfigParseError,
  AllServersUnavailableError,
  TurnStatistics,
  RoutingDecision,
  ServerManifest,
  ToolSchema
} from '@/lib/router/types';

describe('Phase 1 - Task 1.1: Project Structure Setup', () => {
  it('should have required router and mcp directories and placeholder files', () => {
    const requiredFiles = [
      'src/lib/router/adapter.ts',
      'src/lib/router/stats.ts',
      'src/lib/router/types.ts',
      'src/lib/mcp/client.ts',
      'src/lib/mcp/server-manager.ts',
      '.kiro/settings/mcp.json'
    ];

    for (const relPath of requiredFiles) {
      const fullPath = path.resolve(process.cwd(), relPath);
      expect(fs.existsSync(fullPath), `File ${relPath} must exist`).toBe(true);
    }
  });

  it('should have demo server subdirectories and tests subdirectories', () => {
    const requiredDirs = [
      'src/mcp-servers/notes',
      'src/mcp-servers/tasks',
      'src/mcp-servers/calculator',
      'tests/unit',
      'tests/integration',
      'tests/pbt'
    ];

    for (const relPath of requiredDirs) {
      const fullPath = path.resolve(process.cwd(), relPath);
      expect(fs.existsSync(fullPath), `Directory ${relPath} must exist`).toBe(true);
      expect(fs.statSync(fullPath).isDirectory()).toBe(true);
    }
  });

  it('should have .kiro/settings/mcp.json with empty mcpServers object', () => {
    const configPath = path.resolve(process.cwd(), '.kiro/settings/mcp.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed).toHaveProperty('mcpServers');
    expect(parsed.mcpServers).toEqual({});
  });
});

describe('Phase 1 - Task 1.2: TypeScript Type Definitions & Error Classes', () => {
  it('instantiates all 8 custom error classes with correct names and properties', () => {
    const err1 = new RouterUnavailableError(new Error('child died'));
    expect(err1).toBeInstanceOf(Error);
    expect(err1.name).toBe('RouterUnavailableError');
    expect(err1.message).toBe('Router process failed to start');
    expect((err1.cause as Error).message).toBe('child died');

    const err2 = new RoutingTimeoutError(2000);
    expect(err2.name).toBe('RoutingTimeoutError');
    expect(err2.timeoutMs).toBe(2000);
    expect(err2.message).toContain('2000ms');

    const err3 = new InvalidRoutingDecisionError({ bad: true }, 'missing toolFilter');
    expect(err3.name).toBe('InvalidRoutingDecisionError');
    expect(err3.reason).toBe('missing toolFilter');

    const err4 = new NoRelevantToolsError('calculate something');
    expect(err4.name).toBe('NoRelevantToolsError');
    expect(err4.intent).toBe('calculate something');

    const err5 = new ServerConnectionError('notes', new Error('ECONNREFUSED'));
    expect(err5.name).toBe('ServerConnectionError');
    expect(err5.serverID).toBe('notes');

    const err6 = new ToolInvocationError('calculator', 'divide', new Error('division by zero'));
    expect(err6.name).toBe('ToolInvocationError');
    expect(err6.serverID).toBe('calculator');
    expect(err6.toolName).toBe('divide');

    const err7 = new MCPConfigParseError('.kiro/settings/mcp.json', new SyntaxError('Unexpected token'));
    expect(err7.name).toBe('MCPConfigParseError');
    expect(err7.configPath).toBe('.kiro/settings/mcp.json');

    const err8 = new AllServersUnavailableError(['notes', 'tasks', 'calculator']);
    expect(err8.name).toBe('AllServersUnavailableError');
    expect(err8.serverIDs).toEqual(['notes', 'tasks', 'calculator']);
    expect(err8.message).toContain('notes, tasks, calculator');
  });

  it('validates TurnStatistics toolsLoaded semantics', () => {
    // Note server has 5 tools total, but router selected 2 tools for the context.
    // toolsLoaded is 2 (loaded into context), toolsTrimmed is 3 (excluded from selected server).
    const stats: TurnStatistics = {
      turnID: 'turn-1',
      timestamp: Date.now(),
      intent: 'Search notes',
      selectedServers: ['notes'],
      toolsLoaded: 2,
      toolsTrimmed: 3,
      estimatedTokensSaved: 300,
      routingTimeMs: 45
    };

    expect(stats.toolsLoaded).toBe(2);
    expect(stats.toolsTrimmed).toBe(3);
    expect(stats.selectedServers).toEqual(['notes']);
  });

  it('can typecheck complex ServerManifest and RoutingDecision structures', () => {
    const tool: ToolSchema = {
      name: 'create_note',
      description: 'Creates a note',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['title', 'content']
      }
    };

    const manifest: ServerManifest = {
      id: 'notes',
      name: 'Notes Server',
      transport: 'stdio',
      tools: [tool],
      status: 'connected'
    };

    const decision: RoutingDecision = {
      selectedServers: ['notes'],
      toolFilter: [
        {
          serverID: 'notes',
          includedTools: ['create_note']
        }
      ],
      reasoning: 'Match score: 0.95'
    };

    expect(manifest.tools[0].name).toBe('create_note');
    expect(decision.toolFilter[0].includedTools).toContain('create_note');
  });
});
