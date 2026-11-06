/**
 * PBT Invariant 2: Routing Determinism
 *
 * Requirements: FR-2.6, NFR-3.3
 *
 * Rule:
 * Same natural language intent + same registered MCP server set
 * MUST produce identical routing decisions (selectedServers and toolFilter) on repeated invocations.
 *
 * Task 3.2 Wiring Decision:
 * Option B (deterministic stub search function) is used to verify deterministic decision derivation,
 * tool filtering, and cache equivalence across 100+ generated runs without subprocess jitter.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { routeIntent, clearRoutingCache } from '@/lib/router/adapter';
import { ServerManifest, ToolSchema, SearchResult, RoutingDecision } from '@/lib/router/types';

/**
 * Helper function bypassing cache to test router determinism directly.
 * Validates FR-2.6, NFR-3.3.
 */
async function routeIntentNoCache(
  intent: string,
  manifests: ServerManifest[],
  searchFn?: (query: string) => Promise<SearchResult[]>
): Promise<RoutingDecision> {
  return routeIntent(intent, manifests, { bypassCache: true, searchFn });
}

// Validates FR-2.6, NFR-3.3
describe('PBT Invariant 2: Routing Determinism', () => {
  // Generator for tool schemas
  const toolSchemaGen: fc.Arbitrary<ToolSchema> = fc.record({
    name: fc.stringMatching(/^[a-z][a-z0-9_]{1,15}$/),
    description: fc.string({ minLength: 1, maxLength: 60 }),
    inputSchema: fc.record({
      type: fc.constant('object'),
      properties: fc.dictionary(
        fc.stringMatching(/^[a-z_]{1,10}$/),
        fc.record({ type: fc.constant('string') }),
        { minKeys: 1, maxKeys: 4 }
      ),
      required: fc.array(fc.stringMatching(/^[a-z_]{1,10}$/), { minLength: 1, maxLength: 2 }),
    }),
  });

  // Generator for servers with tools
  const serverManifestGen = (idPrefix: string): fc.Arbitrary<ServerManifest> =>
    fc.record({
      id: fc.stringMatching(/^[a-z][a-z0-9_]{1,12}$/).map((s) => `${idPrefix}_${s}`),
      name: fc.string({ minLength: 3, maxLength: 30 }),
      transport: fc.constant('stdio' as const),
      status: fc.constant('connected' as const),
      tools: fc.array(toolSchemaGen, { minLength: 1, maxLength: 5 }),
    });

  it('produces identical selectedServers and toolFilter on repeated calls bypassing cache (numRuns: 100)', async () => {
    // Validates FR-2.6, NFR-3.3
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 60 }),
        fc.array(serverManifestGen('srv'), { minLength: 1, maxLength: 3 }),
        async (intent, rawServers) => {
          // Ensure unique server IDs and unique tool names per server
          const uniqueServerMap = new Map<string, ServerManifest>();
          for (const s of rawServers) {
            if (!uniqueServerMap.has(s.id)) {
              const uniqueTools = Array.from(new Map(s.tools.map((t) => [t.name, t])).values());
              if (uniqueTools.length > 0) {
                uniqueServerMap.set(s.id, { ...s, tools: uniqueTools });
              }
            }
          }
          const servers = Array.from(uniqueServerMap.values());
          if (servers.length === 0) {
            return;
          }

          // Deterministic search matcher: scores tools deterministically based on character codes
          const deterministicSearchFn = async (query: string): Promise<SearchResult[]> => {
            const results: SearchResult[] = [];
            for (const s of servers) {
              for (const tool of s.tools) {
                // Compute deterministic hash score in range [0.5, 0.99]
                let hash = 0;
                const combined = `${query}::${s.id}::${tool.name}`;
                for (let i = 0; i < combined.length; i++) {
                  hash = (hash * 31 + combined.charCodeAt(i)) >>> 0;
                }
                const score = 0.5 + (hash % 500) / 1000;
                results.push({
                  tool: tool.name,
                  server: s.id,
                  score,
                  description: tool.description,
                });
              }
            }
            // Sort by score descending deterministically
            results.sort((a, b) => b.score - a.score || a.tool.localeCompare(b.tool));
            // Return top 1 to 3 tools
            return results.slice(0, Math.min(3, results.length));
          };

          // Act: execute routeIntentNoCache twice
          const decision1 = await routeIntentNoCache(intent, servers, deterministicSearchFn);
          const decision2 = await routeIntentNoCache(intent, servers, deterministicSearchFn);

          // Assert: identical routing decisions
          expect(decision1.selectedServers.slice().sort()).toEqual(decision2.selectedServers.slice().sort());
          expect(decision1.toolFilter).toEqual(decision2.toolFilter);
          expect(decision1.reasoning).toEqual(decision2.reasoning);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('guarantees routing decisions are invariant to server registry input ordering (numRuns: 100)', async () => {
    // Validates FR-2.6, NFR-3.3
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.array(serverManifestGen('ord'), { minLength: 2, maxLength: 4 }),
        async (intent, rawServers) => {
          const uniqueServerMap = new Map<string, ServerManifest>();
          for (const s of rawServers) {
            if (!uniqueServerMap.has(s.id)) {
              const uniqueTools = Array.from(new Map(s.tools.map((t) => [t.name, t])).values());
              if (uniqueTools.length > 0) {
                uniqueServerMap.set(s.id, { ...s, tools: uniqueTools });
              }
            }
          }
          const servers = Array.from(uniqueServerMap.values());
          if (servers.length < 2) {
            return;
          }

          // Deterministic search function based on tool and server identity
          const deterministicSearchFn = async (): Promise<SearchResult[]> => {
            const results: SearchResult[] = [];
            for (const s of servers) {
              const tool = s.tools[0];
              results.push({
                tool: tool.name,
                server: s.id,
                score: 0.85,
                description: tool.description,
              });
            }
            return results;
          };

          // Reverse server ordering
          const reversedServers = [...servers].reverse();

          const decisionForward = await routeIntentNoCache(intent, servers, deterministicSearchFn);
          const decisionReversed = await routeIntentNoCache(intent, reversedServers, deterministicSearchFn);

          // Both must select the exact same server set and tool filter regardless of server order
          expect(decisionForward.selectedServers.slice().sort()).toEqual(
            decisionReversed.selectedServers.slice().sort()
          );

          const forwardSortedFilter = [...decisionForward.toolFilter].sort((a, b) =>
            a.serverID.localeCompare(b.serverID)
          );
          const reversedSortedFilter = [...decisionReversed.toolFilter].sort((a, b) =>
            a.serverID.localeCompare(b.serverID)
          );

          expect(forwardSortedFilter).toEqual(reversedSortedFilter);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('guarantees cached routing yields exact equivalent result as uncached execution (numRuns: 100)', async () => {
    // Validates FR-2.6, NFR-3.3
    clearRoutingCache();

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 40 }),
        fc.array(serverManifestGen('cch'), { minLength: 1, maxLength: 3 }),
        async (intent, rawServers) => {
          const uniqueServerMap = new Map<string, ServerManifest>();
          for (const s of rawServers) {
            if (!uniqueServerMap.has(s.id)) {
              const uniqueTools = Array.from(new Map(s.tools.map((t) => [t.name, t])).values());
              if (uniqueTools.length > 0) {
                uniqueServerMap.set(s.id, { ...s, tools: uniqueTools });
              }
            }
          }
          const servers = Array.from(uniqueServerMap.values());
          if (servers.length === 0) {
            return;
          }

          let searchCallCount = 0;
          const searchFn = async (): Promise<SearchResult[]> => {
            searchCallCount++;
            return [
              {
                tool: servers[0].tools[0].name,
                server: servers[0].id,
                score: 0.92,
                description: servers[0].tools[0].description,
              },
            ];
          };

          // First run: bypass cache
          const uncachedDecision = await routeIntent(intent, servers, {
            bypassCache: true,
            searchFn,
          });

          // Second run: use cache (populates or reads cache)
          const cachedDecision = await routeIntent(intent, servers, {
            bypassCache: false,
            searchFn,
          });

          // Third run: must hit cache without invoking searchFn again
          const priorCount = searchCallCount;
          const secondCachedDecision = await routeIntent(intent, servers, {
            bypassCache: false,
            searchFn,
          });

          expect(searchCallCount).toBe(priorCount); // verified cache hit
          expect(cachedDecision.selectedServers).toEqual(uncachedDecision.selectedServers);
          expect(cachedDecision.toolFilter).toEqual(uncachedDecision.toolFilter);
          expect(secondCachedDecision).toEqual(cachedDecision);
        }
      ),
      { numRuns: 100 }
    );
  });
});
