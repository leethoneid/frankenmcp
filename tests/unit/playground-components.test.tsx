import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ErrorMessage from '@/app/playground/components/ErrorMessage';
import LoadingIndicator from '@/app/playground/components/LoadingIndicator';
import RoutingStatsCard from '@/app/playground/components/RoutingStatsCard';
import ToolResultCard from '@/app/playground/components/ToolResultCard';
import WelcomeMessage, { EXAMPLE_QUERIES } from '@/app/playground/components/WelcomeMessage';
import InputBar from '@/app/playground/components/InputBar';
import TurnDisplay from '@/app/playground/components/TurnDisplay';
import ConversationHistory from '@/app/playground/components/ConversationHistory';
import type { Turn, ToolResult } from '@/app/playground/types';

describe('Playground Chat - Phase 1 & 2 UI Components Unit Tests', () => {
  describe('Task 1.2: ErrorMessage Component', () => {
    it('renders error message and icon with specified red styling classes', () => {
      const html = renderToStaticMarkup(
        <ErrorMessage message="Unable to connect to router" />
      );

      expect(html).toContain('⚠️');
      expect(html).toContain('Unable to connect to router');
      expect(html).toContain('border-red-700/50');
      expect(html).toContain('bg-red-900/10');
      expect(html).toContain('text-red-300');
    });
  });

  describe('Task 1.3: LoadingIndicator Component', () => {
    it('renders spinning indicator and default message', () => {
      const html = renderToStaticMarkup(<LoadingIndicator />);

      expect(html).toContain('animate-spin');
      expect(html).toContain('Routing...');
      expect(html).toContain('border-purple-400');
    });

    it('renders custom loading message when provided', () => {
      const html = renderToStaticMarkup(
        <LoadingIndicator message="Executing tool calculator.add..." />
      );

      expect(html).toContain('Executing tool calculator.add...');
    });
  });

  describe('Task 1.4: RoutingStatsCard Component', () => {
    it('displays servers, loaded, trimmed, and saved metrics with color coding', () => {
      const html = renderToStaticMarkup(
        <RoutingStatsCard
          routing={{
            selectedServers: ['notes', 'calculator'],
            toolsLoaded: 3,
            toolsTrimmed: 7,
            estimatedTokensSaved: 250,
          }}
        />
      );

      expect(html).toContain('📊 Routing Decision');
      expect(html).toContain('notes, calculator');
      expect(html).toContain('text-green-400 font-bold">3 tools');
      expect(html).toContain('text-purple-400 font-bold">7 tools');
      expect(html).toContain('text-cyan-400 font-bold">~250 tokens');
    });

    it('shows reasoning when present and hides it when omitted', () => {
      const withReasoning = renderToStaticMarkup(
        <RoutingStatsCard
          routing={{
            selectedServers: ['notes'],
            toolsLoaded: 1,
            toolsTrimmed: 4,
            estimatedTokensSaved: 100,
            reasoning: 'Notes keyword detected in query',
          }}
        />
      );
      expect(withReasoning).toContain('Notes keyword detected in query');

      const withoutReasoning = renderToStaticMarkup(
        <RoutingStatsCard
          routing={{
            selectedServers: ['notes'],
            toolsLoaded: 1,
            toolsTrimmed: 4,
            estimatedTokensSaved: 100,
          }}
        />
      );
      expect(withoutReasoning).not.toContain('italic mt-2');
    });
  });

  describe('Task 1.5: ToolResultCard Component', () => {
    it('renders successful tool result with green border and pretty-printed JSON', () => {
      const successResult: ToolResult = {
        serverID: 'notes',
        toolName: 'create_note',
        status: 'success',
        result: { id: 'note-1', title: 'Test Note' },
      };

      const html = renderToStaticMarkup(<ToolResultCard result={successResult} />);

      expect(html).toContain('✓');
      expect(html).toContain('notes.create_note');
      expect(html).toContain('border-green-700/50');
      expect(html).toContain('bg-green-900/10');
      expect(html).toContain('&quot;note-1&quot;');
    });

    it('renders error result with red border and error text', () => {
      const errorResult: ToolResult = {
        serverID: 'calculator',
        toolName: 'divide',
        status: 'error',
        error: 'Division by zero is undefined',
      };

      const html = renderToStaticMarkup(<ToolResultCard result={errorResult} />);

      expect(html).toContain('✗');
      expect(html).toContain('calculator.divide');
      expect(html).toContain('border-red-700/50');
      expect(html).toContain('bg-red-900/10');
      expect(html).toContain('Division by zero is undefined');
    });

    it('shows collapse toggle button when result exceeds 500 characters', () => {
      const longOutput = Array(40).fill('data entry line').join('\n');
      const longResult: ToolResult = {
        serverID: 'notes',
        toolName: 'list_notes',
        status: 'success',
        result: { payload: longOutput },
      };

      const html = renderToStaticMarkup(<ToolResultCard result={longResult} />);

      expect(html).toContain('Show more');
      expect(html).toContain('max-h-32');
    });
  });

  describe('Task 1.6: WelcomeMessage Component', () => {
    it('renders welcome heading, value proposition, and 3 server examples', () => {
      const handleExampleClick = vi.fn();
      const html = renderToStaticMarkup(
        <WelcomeMessage onExampleClick={handleExampleClick} />
      );

      expect(html).toContain('Welcome to FrankenMCP Playground');
      expect(html).toContain('Ask questions and watch the router select relevant tools in real-time');
      expect(html).toContain('TRY THESE EXAMPLES');

      // Verify all 3 examples from spec: notes, tasks, calculator
      expect(EXAMPLE_QUERIES).toHaveLength(3);
      expect(html).toContain('Add a note about the meeting');
      expect(html).toContain('Show my tasks');
      expect(html).toContain('What is 42 + 58?');
      expect(html).toContain('notes');
      expect(html).toContain('tasks');
      expect(html).toContain('calculator');
    });
  });

  describe('Task 2.1: InputBar Component', () => {
    it('renders input and submit button with disabled state when disabled=true', () => {
      const handleSubmit = vi.fn();
      const html = renderToStaticMarkup(
        <InputBar onSubmit={handleSubmit} disabled={true} value="active query" />
      );

      expect(html).toContain('value="active query"');
      expect(html).toContain('disabled=""');
      expect(html).toContain('Processing...');
    });

    it('renders submit button enabled when disabled=false and query has text', () => {
      const handleSubmit = vi.fn();
      const html = renderToStaticMarkup(
        <InputBar onSubmit={handleSubmit} disabled={false} value="search notes" />
      );

      expect(html).toContain('Submit');
      expect(html).not.toContain('Processing...');
    });
  });

  describe('Task 2.2: TurnDisplay Component', () => {
    it('renders complete turn with query, timestamp, routing stats, tool results, and error', () => {
      const fullTurn: Turn = {
        id: 'turn-123',
        timestamp: 1700000000000,
        userQuery: 'Calculate 15 * 4 and save note',
        routing: {
          selectedServers: ['calculator'],
          toolsLoaded: 1,
          toolsTrimmed: 4,
          estimatedTokensSaved: 150,
          routingTimeMs: 12,
          reasoning: 'Math query detected',
        },
        toolResults: [
          {
            serverID: 'calculator',
            toolName: 'multiply',
            status: 'success',
            result: { product: 60 },
          },
        ],
        error: 'Optional warning notice',
      };

      const html = renderToStaticMarkup(<TurnDisplay turn={fullTurn} />);

      expect(html).toContain('🙋');
      expect(html).toContain('Calculate 15 * 4 and save note');
      expect(html).toContain('📊 Routing Decision');
      expect(html).toContain('calculator');
      expect(html).toContain('🔧 Tool Results');
      expect(html).toContain('calculator.multiply');
      expect(html).toContain('Optional warning notice');
    });

    it('renders minimal turn with user query only', () => {
      const minimalTurn: Turn = {
        id: 'turn-min',
        timestamp: Date.now(),
        userQuery: 'Hello world query',
      };

      const html = renderToStaticMarkup(<TurnDisplay turn={minimalTurn} />);

      expect(html).toContain('Hello world query');
      expect(html).not.toContain('📊 Routing Decision');
      expect(html).not.toContain('🔧 Tool Results');
    });

    it('renders prominent yellow warning banner when turn contains warnings (Task 5.4)', () => {
      const turnWithWarnings: Turn = {
        id: 'turn-warn',
        timestamp: 1700000000000,
        userQuery: 'Search notes',
        warnings: ["Server 'tasks' unavailable", "Server 'calendar' unavailable"],
      };

      const html = renderToStaticMarkup(<TurnDisplay turn={turnWithWarnings} />);

      expect(html).toContain('⚠️');
      expect(html).toContain('tasks');
      expect(html).toContain('calendar');
      expect(html).toContain('unavailable');
      expect(html).toContain('bg-yellow-950/40');
      expect(html).toContain('border-yellow-600/50');
      expect(html).toContain('text-yellow-300');
    });
  });

  describe('Task 2.3: ConversationHistory Component', () => {
    it('renders WelcomeMessage when turns is empty', () => {
      const html = renderToStaticMarkup(
        <ConversationHistory turns={[]} onExampleClick={vi.fn()} />
      );

      expect(html).toContain('Welcome to FrankenMCP Playground');
      expect(html).toContain('TRY THESE EXAMPLES');
    });

    it('renders list of TurnDisplay items when turns are present', () => {
      const turns: Turn[] = [
        {
          id: 'turn-a',
          timestamp: 1700000000000,
          userQuery: 'Query Alpha',
        },
        {
          id: 'turn-b',
          timestamp: 1700000001000,
          userQuery: 'Query Beta',
          routing: {
            selectedServers: ['tasks'],
            toolsLoaded: 2,
            toolsTrimmed: 3,
            estimatedTokensSaved: 90,
            routingTimeMs: 8,
          },
        },
      ];

      const html = renderToStaticMarkup(
        <ConversationHistory turns={turns} onExampleClick={vi.fn()} />
      );

      expect(html).toContain('Query Alpha');
      expect(html).toContain('Query Beta');
      expect(html).toContain('tasks');
      expect(html).not.toContain('Welcome to FrankenMCP Playground');
    });
  });
});
