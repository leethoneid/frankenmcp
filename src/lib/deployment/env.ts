/**
 * @file env.ts
 * @description Runtime environment detection module for FrankenMCP.
 * Determines whether the application is running in a Vercel Serverless Function
 * or in a local development/testing environment.
 */

export type RuntimeEnvironment = 'vercel' | 'local';

/**
 * Detects whether FrankenMCP is running on Vercel or locally.
 * Vercel automatically populates `process.env.VERCEL = '1'` in all serverless execution contexts.
 */
export function detectEnvironment(): RuntimeEnvironment {
  return process.env.VERCEL === '1' ? 'vercel' : 'local';
}

/**
 * Helper predicate returning true if running in Vercel serverless environment.
 */
export function isVercel(): boolean {
  return detectEnvironment() === 'vercel';
}
