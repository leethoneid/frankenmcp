import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MetricCard from '@/app/lab/components/MetricCard';
import ServerStatusBadge from '@/app/lab/components/ServerStatusBadge';
import ErrorFallback from '@/app/lab/components/ErrorFallback';
import type { ServerStatus } from '@/lib/router/types';

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
