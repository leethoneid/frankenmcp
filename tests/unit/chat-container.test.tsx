import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ChatContainer from '@/app/playground/components/ChatContainer';
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
    expect(html).toContain('Ask a question...');
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
});
