import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { detectEnvironment, isVercel, RuntimeEnvironment } from '@/lib/deployment/env';

describe('Deployment - Task 1.2: Environment Detection Module', () => {
  const originalVercel = process.env.VERCEL;

  beforeEach(() => {
    delete process.env.VERCEL;
  });

  afterEach(() => {
    if (originalVercel !== undefined) {
      process.env.VERCEL = originalVercel;
    } else {
      delete process.env.VERCEL;
    }
  });

  it('detects local environment when VERCEL is undefined', () => {
    delete process.env.VERCEL;
    const env: RuntimeEnvironment = detectEnvironment();
    expect(env).toBe('local');
    expect(isVercel()).toBe(false);
  });

  it('detects vercel environment when VERCEL is "1"', () => {
    process.env.VERCEL = '1';
    const env: RuntimeEnvironment = detectEnvironment();
    expect(env).toBe('vercel');
    expect(isVercel()).toBe(true);
  });

  it('detects local environment when VERCEL is "0" or arbitrary string', () => {
    process.env.VERCEL = '0';
    expect(detectEnvironment()).toBe('local');
    expect(isVercel()).toBe(false);

    process.env.VERCEL = 'true';
    expect(detectEnvironment()).toBe('local');
    expect(isVercel()).toBe(false);
  });
});
