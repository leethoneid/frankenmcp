import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Home from '@/app/page';

describe('Landing Page (src/app/page.tsx)', () => {
  it('renders FrankenMCP landing page with hero, navigation, and Kiroween badge', () => {
    const html = renderToStaticMarkup(<Home />);

    // Brand and Hackathon Identifier
    expect(html).toContain('FrankenMCP');
    expect(html).toContain('Kiroween 2026');
    expect(html).toContain('Frankenstein Category');

    // Navigation and Action Links
    expect(html).toContain('href="/playground"');
    expect(html).toContain('href="/lab"');
    expect(html).toContain('Try the Playground');
    expect(html).toContain('Open Monster Lab');

    // GitHub link
    expect(html).toContain('https://github.com/leethoneid/frankenmcp');
  });

  it('renders How It Works pipeline and all three demo servers with real tool lists', () => {
    const html = renderToStaticMarkup(<Home />);

    // Pipeline description (TF-IDF + BM25)
    expect(html).toContain('Dynamic Router Pruning');
    expect(html).toContain('TF-IDF');
    expect(html).toContain('BM25');

    // Notes Server & Tools
    expect(html).toContain('Notes Server');
    expect(html).toContain('create_note');
    expect(html).toContain('read_note');
    expect(html).toContain('update_note');
    expect(html).toContain('delete_note');
    expect(html).toContain('list_notes');

    // Tasks Server & Tools
    expect(html).toContain('Tasks Server');
    expect(html).toContain('create_task');
    expect(html).toContain('read_task');
    expect(html).toContain('update_task');
    expect(html).toContain('delete_task');
    expect(html).toContain('list_tasks');

    // Calculator Server & Tools
    expect(html).toContain('Calculator Server');
    expect(html).toContain('add');
    expect(html).toContain('subtract');
    expect(html).toContain('multiply');
    expect(html).toContain('divide');
    expect(html).toContain('convert_units');

    // Dual-Mode Architecture
    expect(html).toContain('stdio child processes');
    expect(html).toContain('in-process adapters');
    expect(html).toContain('Vercel Serverless');
  });

  it('does NOT contain any starter template remnants', () => {
    const html = renderToStaticMarkup(<Home />);

    // Next.js starter template boilerplate
    expect(html).not.toContain('edit the page.tsx');
    expect(html).not.toContain('Deploy Now');
    expect(html).not.toContain('Next.js logo');
    expect(html).not.toContain('next.svg');
    expect(html).not.toContain('vercel.svg');
    expect(html).not.toContain('Templates');
    expect(html).not.toContain('Learning center');
  });
});
