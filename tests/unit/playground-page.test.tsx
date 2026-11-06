import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PlaygroundPage from '@/app/playground/page';

describe('Playground Chat - Phase 4: Playground Page (Task 4.1)', () => {
  it('renders header, title, subtitle, and wraps ChatContainer', () => {
    const html = renderToStaticMarkup(<PlaygroundPage />);

    expect(html).toContain('🎮 Playground');
    expect(html).toContain('Ask questions, see routing decisions in real-time');
    expect(html).toContain('border-purple-900/30');
    expect(html).toContain('bg-gray-950');
    expect(html).toContain('text-purple-400');

    // ChatContainer contents
    expect(html).toContain('Welcome to FrankenMCP Playground');
    expect(html).toContain('Ask a question...');
    expect(html).toContain('Submit');
  });
});
