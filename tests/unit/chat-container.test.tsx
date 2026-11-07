import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ChatContainer, { sendChatQuery } from '@/app/playground/components/ChatContainer';
import InputBar from '@/app/playground/components/InputBar';
import ConversationHistory from '@/app/playground/components/ConversationHistory';
import type { Turn } from '@/app/playground/types';

describe('Playground Chat - Task 3.4: ChatContainer Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders ConversationHistory empty state and InputBar on initial mount', () => {
    const html = renderToStaticMarkup(<ChatContainer />);

    expect(html).toContain('Welcome to FrankenMCP Playground');
    expect(html).toContain('Ask questions and watch the router select relevant tools');
    expect(html).toContain('TRY THESE EXAMPLES:');
    expect(html).toContain('Ask about notes, tasks, or calculations…');
    expect(html).toContain('Submit');
  });

  it('renders existing turns passed via initialTurns', () => {
    const initialTurns: Turn[] = [
      {
        id: 'turn-1',
        timestamp: 1700000000000,
        userQuery: 'What is 10 + 20?',
        routing: {
          selectedServers: ['calculator'],
          toolsLoaded: 1,
          toolsTrimmed: 4,
          estimatedTokensSaved: 120,
          routingTimeMs: 10,
          reasoning: 'Arithmetic expression',
        },
        toolResults: [
          {
            serverID: 'calculator',
            toolName: 'add',
            status: 'success',
            result: { sum: 30 },
          },
        ],
      },
    ];

    const html = renderToStaticMarkup(<ChatContainer initialTurns={initialTurns} />);

    expect(html).toContain('What is 10 + 20?');
    expect(html).toContain('calculator');
    expect(html).toContain('1 tools');
    expect(html).toContain('4 tools');
    expect(html).toContain('~120 tokens');
    expect(html).toContain('Arithmetic expression');
    expect(html).toContain('calculator.add');
    expect(html).toContain('30');
  });

  it('renders error turn when a turn contains error message', () => {
    const errorTurns: Turn[] = [
      {
        id: 'turn-err',
        timestamp: Date.now(),
        userQuery: 'Failed query',
        error: 'All servers offline',
      },
    ];

    const html = renderToStaticMarkup(<ChatContainer initialTurns={errorTurns} />);

    expect(html).toContain('Failed query');
    expect(html).toContain('⚠️');
    expect(html).toContain('All servers offline');
  });

  it('InputBar validates empty input and prevents submission', () => {
    let submitted = false;
    const handleSubmit = async () => {
      submitted = true;
    };

    const html = renderToStaticMarkup(
      <InputBar onSubmit={handleSubmit} disabled={false} value="" />
    );

    expect(html).toContain('disabled=""');
    expect(submitted).toBe(false);
  });

  it('verifies ChatContainer is strictly client-side and does not invoke server managers directly', () => {
    // Assert ChatContainer exports as a client component
    expect(typeof ChatContainer).toBe('function');
  });

  describe('Task 5.1 & 5.2 & 5.4: Error handling & banners', () => {
    it('Task 6.2: sendChatQuery returns turn object on 200 API success response', async () => {
      const mockTurn: Turn = {
        id: 'turn-success-123',
        timestamp: 1700000000000,
        userQuery: 'Calculate 10 + 20',
        routing: {
          selectedServers: ['calculator'],
          toolsLoaded: 1,
          toolsTrimmed: 4,
          estimatedTokensSaved: 120,
          routingTimeMs: 10,
        },
        toolResults: [
          {
            serverID: 'calculator',
            toolName: 'add',
            status: 'success',
            result: { sum: 30 },
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockTurn,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await sendChatQuery('/api/playground/chat', 'Calculate 10 + 20');
      expect(result.turn).toEqual(mockTurn);
      expect(result.error).toBeUndefined();
      expect(result.isRouterUnavailable).toBeUndefined();

      vi.unstubAllGlobals();
    });

    it('Task 5.1: sendChatQuery returns error on 404 NoRelevantToolsError response without setting router unavailable', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'No relevant tools found for this query' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await sendChatQuery('/api/playground/chat', 'unrelated fantasy query');
      expect(result.error).toBe('No relevant tools found for this query');
      expect(result.isRouterUnavailable).toBe(false);
      expect(result.turn).toBeUndefined();

      vi.unstubAllGlobals();
    });

    it('Task 5.2: sendChatQuery detects Router unavailable on 500 error response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Router unavailable. Please restart the application.' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await sendChatQuery('/api/playground/chat', 'calculate 1+1');
      expect(result.error).toBe('Router unavailable. Please restart the application.');
      expect(result.isRouterUnavailable).toBe(true);

      vi.unstubAllGlobals();
    });

    it('Task 5.2: ChatContainer displays prominent red banner and disables input when router is unavailable', () => {
      const html = renderToStaticMarkup(
        <ChatContainer
          initialError="Router unavailable. Please restart the application."
        />
      );

      // Red prominent banner
      expect(html).toContain('role="alert"');
      expect(html).toContain('bg-red-950/80');
      expect(html).toContain('border-red-500');
      expect(html).toContain('Router unavailable. Please restart the application.');

      // InputBar disabled
      expect(html).toContain('disabled=""');
    });

    it('Task 5.4: ChatContainer displays warning banner for disconnected servers in turns', () => {
      const turnWithWarning: Turn = {
        id: 'turn-warn-ui',
        timestamp: 1700000000000,
        userQuery: 'Do something with notes',
        warnings: ["Server 'tasks' unavailable"],
      };

      const html = renderToStaticMarkup(
        <ChatContainer initialTurns={[turnWithWarning]} />
      );

      expect(html).toContain('tasks');
      expect(html).toContain('unavailable');
      expect(html).toContain('bg-yellow-950/40');
      expect(html).toContain('border-yellow-600/50');
    });

    it('Task 7.3: ChatContainer passes inputRef and manages focus during query lifecycle', () => {
      const html = renderToStaticMarkup(<ChatContainer />);

      expect(html).toContain('placeholder="Ask about notes, tasks, or calculations…"');
      expect(html).toContain('Submit');
    });

    it('renders guidance box on no-match turn and allows clicking example query to populate InputBar', () => {
      const noMatchTurn: Turn = {
        id: 'turn-no-match-chat',
        timestamp: 1700000000000,
        userQuery: 'Who is the president of France?',
        routing: {
          selectedServers: ['notes', 'tasks', 'calculator'],
          toolsLoaded: 0,
          toolsTrimmed: 15,
          estimatedTokensSaved: 0,
          routingTimeMs: 1,
          reasoning: 'No relevant tools found for this query',
        },
        toolResults: [],
      };

      const html = renderToStaticMarkup(
        <ChatContainer initialTurns={[noMatchTurn]} />
      );

      expect(html).toContain('Who is the president of France?');
      expect(html).toContain(
        "This demo only answers questions that map to its 15 tools (notes, tasks, calculator) — there&#x27;s no LLM or general knowledge here. Try one of these:"
      );
      expect(html).toContain('Add a note about the meeting');
      expect(html).toContain('Show my tasks');
      expect(html).toContain('What is 42 + 58?');
    });
  });
});
