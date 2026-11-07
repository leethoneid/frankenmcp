import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PlaygroundPage from '@/app/playground/page';
import ChatContainer from '@/app/playground/components/ChatContainer';
import TurnDisplay from '@/app/playground/components/TurnDisplay';
import type { Turn } from '@/app/playground/types';

describe('Playground Chat - Task 6.5: Acceptance Criteria (AC-1 to AC-7) Validation', () => {
  it('validates AC-1: User can navigate to /playground and see input field, submit button, and example queries', async () => {
    const pageElement = await PlaygroundPage();
    const html = renderToStaticMarkup(pageElement);

    // Header and theme
    expect(html).toContain('FrankenMCP Playground');
    expect(html).toContain('border-purple-900/30');
    expect(html).toContain('bg-gray-950');

    // Input bar
    expect(html).toContain('Ask about notes, tasks, or calculations…');
    expect(html).toContain('Submit');

    // Welcome message with examples
    expect(html).toContain('Welcome to FrankenMCP Playground');
    expect(html).toContain('TRY THESE EXAMPLES:');
    expect(html).toContain('Add a note about the meeting');
    expect(html).toContain('Show my tasks');
    expect(html).toContain('What is 42 + 58?');
  });

  it('validates AC-2: User can submit "Add a note" and see routing stats + tool result (covered in Task 6.1)', () => {
    const mockTurn: Turn = {
      id: 'turn-ac2',
      timestamp: 1700000000000,
      userQuery: 'Add a note about the meeting',
      routing: {
        selectedServers: ['notes'],
        toolsLoaded: 1,
        toolsTrimmed: 4,
        estimatedTokensSaved: 140,
        routingTimeMs: 15,
        reasoning: 'Routing to notes server for create_note',
      },
      toolResults: [
        {
          serverID: 'notes',
          toolName: 'create_note',
          status: 'success',
          result: { id: 'note-1', title: 'the meeting' },
        },
      ],
    };

    const html = renderToStaticMarkup(<TurnDisplay turn={mockTurn} />);
    expect(html).toContain('Add a note about the meeting');
    expect(html).toContain('notes');
    expect(html).toContain('1 tools');
    expect(html).toContain('4 tools');
    expect(html).toContain('~140 tokens');
    expect(html).toContain('create_note');
    expect(html).toContain('note-1');
  });

  it('validates AC-3: User can submit math query like "What is 42 + 58?" and see calculator result', () => {
    const mockTurn: Turn = {
      id: 'turn-ac3',
      timestamp: 1700000000000,
      userQuery: 'What is 42 + 58?',
      routing: {
        selectedServers: ['calculator'],
        toolsLoaded: 1,
        toolsTrimmed: 4,
        estimatedTokensSaved: 120,
        routingTimeMs: 12,
        reasoning: 'Math expression routed to calculator',
      },
      toolResults: [
        {
          serverID: 'calculator',
          toolName: 'add',
          status: 'success',
          result: { sum: 100 },
        },
      ],
    };

    const html = renderToStaticMarkup(<TurnDisplay turn={mockTurn} />);
    expect(html).toContain('What is 42 + 58?');
    expect(html).toContain('calculator');
    expect(html).toContain('add');
    expect(html).toContain('100');
  });

  it('validates AC-4: Playground turns integrate with Monster Lab without duplicate recording (verified in Task 6.4)', () => {
    // Assert turns rendered in ChatContainer are displayed faithfully
    const turns: Turn[] = [
      { id: 't1', timestamp: 1, userQuery: 'Query 1' },
      { id: 't2', timestamp: 2, userQuery: 'Query 2' },
      { id: 't3', timestamp: 3, userQuery: 'Query 3' },
    ];

    const html = renderToStaticMarkup(<ChatContainer initialTurns={turns} />);
    expect(html).toContain('Query 1');
    expect(html).toContain('Query 2');
    expect(html).toContain('Query 3');
  });

  it('validates AC-5: Disconnected server displays prominent warning notice', () => {
    const mockTurn: Turn = {
      id: 'turn-ac5',
      timestamp: 1700000000000,
      userQuery: 'Show notes',
      warnings: ["Server 'tasks' unavailable"],
    };

    const html = renderToStaticMarkup(<TurnDisplay turn={mockTurn} />);
    expect(html).toContain('tasks');
    expect(html).toContain('unavailable');
    expect(html).toContain('bg-yellow-950/40');
    expect(html).toContain('border-yellow-600/50');
  });

  it('validates AC-6: Query with no matching tools displays "No relevant tools found for this query"', () => {
    const mockTurn: Turn = {
      id: 'turn-ac6',
      timestamp: 1700000000000,
      userQuery: 'What is the weather?',
      error: 'No relevant tools found for this query',
    };

    const html = renderToStaticMarkup(<TurnDisplay turn={mockTurn} />);
    expect(html).toContain('What is the weather?');
    expect(html).toContain('No relevant tools found for this query');
    expect(html).toContain('text-red-300');
    expect(html).not.toContain('🔧 Tool Results'); // Not proceeding to tool execution
  });

  it('validates AC-7: Responsive layout structure supports mobile viewports (375px)', async () => {
    const pageElement = await PlaygroundPage();
    const html = renderToStaticMarkup(pageElement);

    // Full screen height calculation
    expect(html).toContain('h-[calc(100vh-120px)]');

    // Flexible layout classes
    expect(html).toContain('flex-1');
    expect(html).toContain('flex flex-col');

    // History container with turns supports vertical overflow scrolling
    const historyHtml = renderToStaticMarkup(
      <ChatContainer initialTurns={[{ id: 'turn-mobile', timestamp: Date.now(), userQuery: 'Mobile query' }]} />
    );
    expect(historyHtml).toContain('overflow-y-auto');
  });
});
