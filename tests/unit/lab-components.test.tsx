import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MetricCard from '@/app/lab/components/MetricCard';
import ServerStatusBadge from '@/app/lab/components/ServerStatusBadge';
import ErrorFallback from '@/app/lab/components/ErrorFallback';
import StatsPanel from '@/app/lab/components/StatsPanel';
import TurnHistoryPanel from '@/app/lab/components/TurnHistoryPanel';
import TurnCard from '@/app/lab/components/TurnCard';
import ServerHealthPanel, { formatOfflineDuration } from '@/app/lab/components/ServerHealthPanel';
import type { ServerStatus, SessionStatistics, TurnStatistics, ServerManifest } from '@/lib/router/types';

describe('Phase 3 - Lab UI Components Unit Tests', () => {
  describe('Task 3.1: MetricCard Component', () => {
    it('renders label, unit, description, and formats numbers with toLocaleString()', () => {
      const html = renderToStaticMarkup(
        <MetricCard
          label="Total Tools Trimmed"
          value={1234567}
          unit="tools excluded"
          description="Context efficiency gain"
          color="green"
        />
      );

      expect(html).toContain('Total Tools Trimmed');
      expect(html).toContain('1,234,567');
      expect(html).toContain('tools excluded');
      expect(html).toContain('Context efficiency gain');
    });

    it('renders prefix when provided', () => {
      const html = renderToStaticMarkup(
        <MetricCard
          label="Token Savings"
          value={4500}
          unit="tokens saved"
          description="Estimated prompt reduction"
          color="cyan"
          prefix="~"
        />
      );

      expect(html).toContain('~4,500');
    });

    it('applies semantic color classes for green, purple, cyan, and yellow', () => {
      const greenHtml = renderToStaticMarkup(
        <MetricCard label="L" value={1} unit="U" description="D" color="green" />
      );
      expect(greenHtml).toContain('text-green-400');
      expect(greenHtml).toContain('border-green-900/30');

      const purpleHtml = renderToStaticMarkup(
        <MetricCard label="L" value={1} unit="U" description="D" color="purple" />
      );
      expect(purpleHtml).toContain('text-purple-400');
      expect(purpleHtml).toContain('border-purple-900/30');

      const cyanHtml = renderToStaticMarkup(
        <MetricCard label="L" value={1} unit="U" description="D" color="cyan" />
      );
      expect(cyanHtml).toContain('text-cyan-400');
      expect(cyanHtml).toContain('border-cyan-900/30');

      const yellowHtml = renderToStaticMarkup(
        <MetricCard label="L" value={1} unit="U" description="D" color="yellow" />
      );
      expect(yellowHtml).toContain('text-yellow-400');
      expect(yellowHtml).toContain('border-yellow-900/30');
    });
  });

  describe('Task 3.2: ServerStatusBadge Component', () => {
    it('renders 🟢 Connected with text-green-400 for connected status', () => {
      const html = renderToStaticMarkup(<ServerStatusBadge status="connected" />);
      expect(html).toContain('🟢');
      expect(html).toContain('Connected');
      expect(html).toContain('text-green-400');
    });

    it('renders 🟡 Starting with text-yellow-400 for starting status', () => {
      const html = renderToStaticMarkup(<ServerStatusBadge status="starting" />);
      expect(html).toContain('🟡');
      expect(html).toContain('Starting');
      expect(html).toContain('text-yellow-400');
    });

    it('renders 🔴 Error with text-red-400 for error status', () => {
      const html = renderToStaticMarkup(<ServerStatusBadge status="error" />);
      expect(html).toContain('🔴');
      expect(html).toContain('Error');
      expect(html).toContain('text-red-400');
    });

    it('renders 🔴 Offline with text-red-400 for disconnected status', () => {
      const html = renderToStaticMarkup(<ServerStatusBadge status="disconnected" />);
      expect(html).toContain('🔴');
      expect(html).toContain('Offline');
      expect(html).toContain('text-red-400');
    });

    it('verifies both error and disconnected statuses use red styling and red circle icon', () => {
      const errorHtml = renderToStaticMarkup(<ServerStatusBadge status="error" />);
      const disconnectedHtml = renderToStaticMarkup(<ServerStatusBadge status="disconnected" />);

      expect(errorHtml).toContain('text-red-400');
      expect(errorHtml).toContain('🔴');
      expect(disconnectedHtml).toContain('text-red-400');
      expect(disconnectedHtml).toContain('🔴');
    });
  });

  describe('Task 3.3: ErrorFallback Component', () => {
    const originalEnv = process.env.NODE_ENV;
    const env = process.env as Record<string, string | undefined>;

    afterEach(() => {
      env.NODE_ENV = originalEnv;
    });

    it('always displays Stats Unavailable heading and user-friendly error guidance', () => {
      const html = renderToStaticMarkup(<ErrorFallback />);
      expect(html).toContain('⚠️');
      expect(html).toContain('Stats Unavailable');
      expect(html).toContain('Unable to load routing statistics. Please check server logs.');
    });

    it('shows error details in development mode when error prop is provided', () => {
      env.NODE_ENV = 'development';
      const testError = new Error('Subprocess crashed with SIGSEGV');
      const html = renderToStaticMarkup(<ErrorFallback error={testError} />);

      expect(html).toContain('Stats Unavailable');
      expect(html).toContain('Error details (dev only)');
      expect(html).toContain('Subprocess crashed with SIGSEGV');
      expect(html).toContain('<details');
    });

    it('hides error details in production mode even when error is provided', () => {
      env.NODE_ENV = 'production';
      const testError = new Error('Sensitive internal stack trace');
      const html = renderToStaticMarkup(<ErrorFallback error={testError} />);

      expect(html).toContain('Stats Unavailable');
      expect(html).not.toContain('Sensitive internal stack trace');
      expect(html).not.toContain('<details');
      expect(html).not.toContain('Error details (dev only)');
    });

    it('does not render details element when error is undefined in development mode', () => {
      env.NODE_ENV = 'development';
      const html = renderToStaticMarkup(<ErrorFallback />);

      expect(html).toContain('Stats Unavailable');
      expect(html).not.toContain('<details');
      expect(html).not.toContain('Error details (dev only)');
    });
  });
});

describe('Phase 5 - Statistics Display Components Unit Tests', () => {
  describe('Task 5.1: StatsPanel Component', () => {
    const mockInitialStats: SessionStatistics = {
      totalToolsLoaded: 12,
      totalToolsTrimmed: 28,
      totalTokensSaved: 3450,
      averageRoutingTimeMs: 18.5,
      turns: [],
    };

    it('displays initial session statistics across all 4 metric cards with responsive grid classes', () => {
      const html = renderToStaticMarkup(<StatsPanel initialStats={mockInitialStats} />);

      // Grid classes
      expect(html).toContain('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4');

      // Metric card 1: Tools Loaded
      expect(html).toContain('Tools Loaded');
      expect(html).toContain('12');
      expect(html).toContain('Total tools loaded into context');

      // Metric card 2: Tools Trimmed
      expect(html).toContain('Tools Trimmed');
      expect(html).toContain('28');
      expect(html).toContain('Total tools excluded from selected servers');

      // Metric card 3: Tokens Saved
      expect(html).toContain('Tokens Saved');
      expect(html).toContain('~3,450');
      expect(html).toContain('Estimated context tokens saved');

      // Metric card 4: Avg Routing Time
      expect(html).toContain('Avg Routing Time');
      expect(html).toContain('18.5');
      expect(html).toContain('Average decision latency');

      // No error banner by default
      expect(html).not.toContain('bg-yellow-900/20');
    });

    it('renders warning banner when pollError is present', () => {
      const html = renderToStaticMarkup(
        <StatsPanel initialStats={mockInitialStats} initialError="Unable to refresh statistics" />
      );

      expect(html).toContain('bg-yellow-900/20');
      expect(html).toContain('border-yellow-500');
      expect(html).toContain('text-yellow-300');
      expect(html).toContain('Unable to refresh statistics');
    });
  });

  describe('Task 5.2: TurnHistoryPanel Component', () => {
    it('shows empty state message when turns array is empty', () => {
      const html = renderToStaticMarkup(<TurnHistoryPanel initialTurns={[]} />);

      expect(html).toContain('Turn History');
      expect(html).toContain('No routing decisions yet. Submit a query in the Playground to see statistics.');
    });

    it('displays singular label "1 turn" when exactly 1 turn exists', () => {
      const singleTurn: TurnStatistics = {
        turnID: 'turn-single-1',
        intent: 'add a note',
        timestamp: 1700000000000,
        selectedServers: ['notes'],
        toolsLoaded: 1,
        toolsTrimmed: 4,
        estimatedTokensSaved: 120,
        routingTimeMs: 15,
        toolFilter: [{ serverID: 'notes', includedTools: ['create_note'] }],
      };

      const html = renderToStaticMarkup(<TurnHistoryPanel initialTurns={[singleTurn]} />);

      expect(html).toContain('Turn History (1 turn)');
      expect(html).not.toContain('1 turns');
      expect(html).toContain('add a note');
    });

    it('displays plural label and limits view to the 20 most recent turns (newest first) out of 25', () => {
      const turns25: TurnStatistics[] = Array.from({ length: 25 }, (_, idx) => ({
        turnID: `turn-${idx + 1}`,
        intent: `Query number ${idx + 1}`,
        timestamp: 1700000000000 + idx * 1000,
        selectedServers: ['notes'],
        toolsLoaded: 1,
        toolsTrimmed: 2,
        estimatedTokensSaved: 50,
        routingTimeMs: 10,
        toolFilter: [],
      }));

      const html = renderToStaticMarkup(<TurnHistoryPanel initialTurns={turns25} />);

      // Total count in header shows full count
      expect(html).toContain('Turn History (25 turns)');

      // Most recent (turn 25) is rendered
      expect(html).toContain('Query number 25');

      // Turn 6 (20th from the end) is rendered
      expect(html).toContain('Query number 6');

      // Older turns (1 through 5) are excluded from the slice(-20)
      expect(html).not.toContain('Query number 1"');
      expect(html).not.toContain('Query number 5"');
    });
  });

  describe('Task 5.3: TurnCard Component', () => {
    const fullTurn: TurnStatistics = {
      turnID: 'turn-card-1',
      intent: 'This is a long user intent that definitely exceeds fifty characters in length to test truncation',
      timestamp: 1700000000000,
      selectedServers: ['notes', 'calculator'],
      toolsLoaded: 2,
      toolsTrimmed: 8,
      estimatedTokensSaved: 950,
      routingTimeMs: 32,
      toolFilter: [
        { serverID: 'notes', includedTools: ['read_note'] },
        { serverID: 'calculator', includedTools: ['add'] },
      ],
      reasoning: 'Notes matched for document reading, calculator matched for arithmetic',
    };

    const serverToolsMap = new Map<string, string[]>([
      ['notes', ['read_note', 'create_note', 'list_notes', 'update_note', 'delete_note']],
      ['calculator', ['add', 'subtract', 'multiply', 'divide', 'convert_units']],
    ]);

    it('renders collapsed view with truncated intent (>50 chars), selected servers, key metrics, and ▶ toggle', () => {
      const html = renderToStaticMarkup(<TurnCard turn={fullTurn} allServerTools={serverToolsMap} />);

      // Truncated intent (50 chars + '...')
      expect(html).toContain('This is a long user intent that definitely exceeds...');
      expect(html).not.toContain('to test truncation&quot;');

      // Server list and metrics
      expect(html).toContain('notes, calculator');
      expect(html).toContain('2 loaded');
      expect(html).toContain('8 trimmed');
      expect(html).toContain('~950 tokens saved');
      expect(html).toContain('32ms');

      // Collapsed toggle icon
      expect(html).toContain('▶');
      expect(html).not.toContain('▼');

      // Expanded content is hidden
      expect(html).not.toContain('Full Intent:');
      expect(html).not.toContain('Tools by Server:');
      expect(html).not.toContain('Routing Reasoning:');
    });

    it('renders short intent without truncation in collapsed view', () => {
      const shortTurn: TurnStatistics = {
        ...fullTurn,
        intent: 'Short query',
      };

      const html = renderToStaticMarkup(<TurnCard turn={shortTurn} />);
      expect(html).toContain('&quot;Short query&quot;');
      expect(html).not.toContain('Short query...');
    });

    it('renders expanded view with full intent, loaded and trimmed tool lists, and reasoning', () => {
      const html = renderToStaticMarkup(
        <TurnCard turn={fullTurn} allServerTools={serverToolsMap} initialExpanded={true} />
      );

      // Expanded toggle icon
      expect(html).toContain('▼');

      // Full intent
      expect(html).toContain('Full Intent:');
      expect(html).toContain(fullTurn.intent);

      // Per-server tools: loaded (✓ green)
      expect(html).toContain('Tools by Server:');
      expect(html).toContain('✓ Loaded: read_note');
      expect(html).toContain('✓ Loaded: add');

      // Per-server tools: trimmed (✗ purple, line-through)
      expect(html).toContain('✗ Trimmed: create_note, list_notes, update_note, delete_note');
      expect(html).toContain('✗ Trimmed: subtract, multiply, divide, convert_units');
      expect(html).toContain('text-purple-400 text-xs line-through opacity-60');

      // Reasoning
      expect(html).toContain('Routing Reasoning:');
      expect(html).toContain('Notes matched for document reading, calculator matched for arithmetic');
      expect(html).toContain('italic');
    });

    it('renders gracefully without crashing when toolFilter and reasoning are absent', () => {
      const minimalTurn: TurnStatistics = {
        turnID: 'turn-min',
        intent: 'Minimal turn',
        timestamp: 1700000000000,
        selectedServers: [],
        toolsLoaded: 0,
        toolsTrimmed: 0,
        estimatedTokensSaved: 0,
        routingTimeMs: 5,
        toolFilter: [],
      };

      const html = renderToStaticMarkup(<TurnCard turn={minimalTurn} initialExpanded={true} />);

      expect(html).toContain('Minimal turn');
      expect(html).not.toContain('Tools by Server:');
      expect(html).not.toContain('Routing Reasoning:');
    });
  });

  describe('Task 6.1: ServerHealthPanel Component', () => {
    it('formatOfflineDuration computes Xm Ys and Xs correctly', () => {
      const now = 1700000100000;
      expect(formatOfflineDuration(undefined, now)).toBe('');
      expect(formatOfflineDuration(now - 45000, now)).toBe('45s');
      expect(formatOfflineDuration(now - 135000, now)).toBe('2m 15s');
      expect(formatOfflineDuration(now - 3600000, now)).toBe('60m 0s');
    });

    it('shows red warning banner when all servers are offline or empty', () => {
      const offlineManifests: ServerManifest[] = [
        {
          id: 'server-1',
          name: 'Server 1',
          transport: 'stdio',
          tools: [],
          status: 'error',
          lastError: 'Connection refused',
        },
        {
          id: 'server-2',
          name: 'Server 2',
          transport: 'stdio',
          tools: [],
          status: 'disconnected',
        },
      ];

      const html = renderToStaticMarkup(<ServerHealthPanel initialManifests={offlineManifests} />);

      expect(html).toContain('⚠️ All servers offline — cannot route requests');
      expect(html).toContain('bg-red-900/20');
      expect(html).toContain('border-red-500');
      expect(html).toContain('text-red-300');
    });

    it('renders connected server with tool count and does not show all-offline banner', () => {
      const mixedManifests: ServerManifest[] = [
        {
          id: 'notes',
          name: 'Notes Server',
          transport: 'stdio',
          tools: [
            { name: 'read_note', description: '', inputSchema: { type: 'object' } },
            { name: 'create_note', description: '', inputSchema: { type: 'object' } },
          ],
          status: 'connected',
        },
        {
          id: 'tasks',
          name: 'Tasks Server',
          transport: 'stdio',
          tools: [],
          status: 'error',
          lastError: 'Process terminated',
        },
      ];

      const html = renderToStaticMarkup(<ServerHealthPanel initialManifests={mixedManifests} />);

      expect(html).not.toContain('⚠️ All servers offline');
      expect(html).toContain('Notes Server');
      expect(html).toContain('2 tools');
      expect(html).toContain('Tasks Server');
      expect(html).toContain('Process terminated');
    });

    it('renders lastError and computed offline duration for error/disconnected servers', () => {
      const now = Date.now();
      const manifests: ServerManifest[] = [
        {
          id: 'sick-server',
          name: 'Sick Server',
          transport: 'stdio',
          tools: [],
          status: 'error',
          lastError: 'Subprocess crashed with SIGTERM',
          lastStatusChangeAt: now - 75000,
        },
      ];

      const html = renderToStaticMarkup(<ServerHealthPanel initialManifests={manifests} />);

      expect(html).toContain('Sick Server');
      expect(html).toContain('Subprocess crashed with SIGTERM');
      expect(html).toContain('Offline for 1m 15s');
    });

    it('renders "Starting..." for server in starting status', () => {
      const startingManifests: ServerManifest[] = [
        {
          id: 'booting-srv',
          name: 'Booting Server',
          transport: 'stdio',
          tools: [],
          status: 'starting',
        },
      ];

      const html = renderToStaticMarkup(<ServerHealthPanel initialManifests={startingManifests} />);

      expect(html).toContain('Booting Server');
      expect(html).toContain('Starting...');
    });

    it('renders yellow warning banner when initialError / pollError is set', () => {
      const html = renderToStaticMarkup(
        <ServerHealthPanel initialManifests={[]} initialError="Unable to refresh server status" />
      );

      expect(html).toContain('bg-yellow-900/20');
      expect(html).toContain('border-yellow-500');
      expect(html).toContain('text-yellow-300');
      expect(html).toContain('Unable to refresh server status');
    });
  });
});
