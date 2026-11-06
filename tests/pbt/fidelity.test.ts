/**
 * PBT Invariant 3: Schema Round-Trip Fidelity
 *
 * Requirements: FR-2.7, NFR-3.4
 *
 * Rule:
 * Tool schemas loaded into memory, evaluated during routing and trimming, and then reloaded
 * MUST maintain 100% fidelity with original server declarations without in-place mutation,
 * property drift, or data corruption.
 *
 * Task 3.2 Wiring Decision:
 * Option B / in-memory client factory is used to simulate MCP server tool discovery and refresh
 * with deep-clone assertions across 100+ generated runs.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { routeIntent } from '@/lib/router/adapter';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import { MCPClient } from '@/lib/mcp/client';
import { ToolSchema, ServerManifest, SearchResult, ServerConfig } from '@/lib/router/types';

// Validates FR-2.7, NFR-3.4
describe('PBT Invariant 3: Schema Round-Trip Fidelity', () => {
  let manager: MCPServerManager;

  beforeEach(async () => {
    await MCPServerManager.resetInstance();
  });

  afterEach(async () => {
    if (manager) {
      await manager.shutdown();
    }
    await MCPServerManager.resetInstance();
  });

  // Generator for arbitrary tool schemas matching MCP protocol
  const toolPropertyGen = fc.record({
    type: fc.constantFrom('string', 'number', 'boolean', 'integer', 'array', 'object'),
    description: fc.string({ minLength: 0, maxLength: 60 }),
  });

  const toolSchemaGen: fc.Arbitrary<ToolSchema> = fc
    .tuple(
      fc.stringMatching(/^[a-z][a-z0-9_]{1,16}$/),
      fc.string({ minLength: 1, maxLength: 80 }),
      fc.dictionary(
        fc.stringMatching(/^[a-z_]{1,12}$/),
        toolPropertyGen,
        { minKeys: 1, maxKeys: 5 }
      )
    )
    .chain(([name, description, properties]) => {
      const keys = Object.keys(properties);
      return fc
        .subarray(keys, { minLength: 1, maxLength: keys.length })
        .map((required) => ({
          name,
          description,
          inputSchema: {
            type: 'object',
            properties,
            required,
          },
        }));
    });

  it('guarantees registered schemas match originals after routing and force refresh (numRuns: 100)', async () => {
    // Validates FR-2.7, NFR-3.4
    await fc.assert(
      fc.asyncProperty(
        fc.array(toolSchemaGen, { minLength: 2, maxLength: 6 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (schemas, intent) => {
          // De-duplicate tool names
          const uniqueMap = new Map<string, ToolSchema>();
          for (const s of schemas) {
            if (!uniqueMap.has(s.name)) {
              uniqueMap.set(s.name, s);
            }
          }
          const uniqueSchemas = Array.from(uniqueMap.values());
          if (uniqueSchemas.length < 2) {
            return;
          }

          // Deep clone original schemas to detect any in-place mutation
          const originalSchemas: ToolSchema[] = JSON.parse(JSON.stringify(uniqueSchemas));

          const serverID = 'pbt_fidelity_srv';
          const serverConfig: ServerConfig = {
            id: serverID,
            name: 'PBT Fidelity Server',
            transport: 'stdio',
            command: 'node',
            args: [],
          };

          // Mock client factory that returns the generated schemas on listTools()
          const mockClientFactory = () => {
            return {
              connect: async () => {},
              disconnect: async () => {},
              listTools: async () => JSON.parse(JSON.stringify(originalSchemas)),
              callTool: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
              ping: async () => {},
              onNotification: () => {},
            } as unknown as MCPClient;
          };

          manager = new MCPServerManager(mockClientFactory);
          manager.registerServer(serverConfig);
          await manager.connectServer(serverID);

          // Retain first tool only; remainder trimmed
          const targetTool = originalSchemas[0];
          const searchFn = async (): Promise<SearchResult[]> => [
            {
              tool: targetTool.name,
              server: serverID,
              score: 0.98,
              description: targetTool.description,
            },
          ];

          // Act: Route intent reading manifests from manager
          const manifestsBefore = manager.getServerManifests();
          const decision = await routeIntent(intent, manifestsBefore, {
            searchFn,
            bypassCache: true,
          });

          expect(decision.selectedServers).toContain(serverID);

          // Force refresh all schemas from the server
          await manager.refreshAllSchemas();

          // Assert: reloaded schemas match originals 100%
          for (let i = 0; i < originalSchemas.length; i++) {
            const expectedOriginal = originalSchemas[i];
            const reloaded = manager.getToolSchema(expectedOriginal.name, serverID);

            expect(reloaded).toBeDefined();
            expect(reloaded).toEqual(expectedOriginal);
          }

          // Clean up manager for next iteration
          await manager.shutdown();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('verifies routing and token savings calculations cause zero in-place schema mutation (numRuns: 100)', async () => {
    // Validates FR-2.7, NFR-3.4
    await fc.assert(
      fc.asyncProperty(
        fc.array(toolSchemaGen, { minLength: 3, maxLength: 7 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (schemas, intent) => {
          const uniqueMap = new Map<string, ToolSchema>();
          for (const s of schemas) {
            if (!uniqueMap.has(s.name)) {
              uniqueMap.set(s.name, s);
            }
          }
          const uniqueSchemas = Array.from(uniqueMap.values());
          if (uniqueSchemas.length < 3) {
            return;
          }

          // Deep snapshot of inputs
          const snapshotBefore = JSON.parse(JSON.stringify(uniqueSchemas));

          const serverID = 'immutability_server';
          const manifest: ServerManifest = {
            id: serverID,
            name: 'Immutability Server',
            transport: 'stdio',
            status: 'connected',
            tools: uniqueSchemas,
          };

          // Retain 1 tool, trim the other 2+
          const searchFn = async (): Promise<SearchResult[]> => [
            {
              tool: uniqueSchemas[0].name,
              server: serverID,
              score: 0.95,
              description: uniqueSchemas[0].description,
            },
          ];

          // Act: route intent through adapter (calculates turn stats and token savings)
          await routeIntent(intent, [manifest], {
            searchFn,
            bypassCache: true,
          });

          // Assert: manifest.tools array and all inner schemas are completely unmutated
          expect(manifest.tools).toEqual(snapshotBefore);

          for (let i = 0; i < uniqueSchemas.length; i++) {
            expect(manifest.tools[i]).toEqual(snapshotBefore[i]);
            expect(manifest.tools[i].inputSchema.required).toEqual(snapshotBefore[i].inputSchema.required);
            expect(manifest.tools[i].inputSchema.properties).toEqual(snapshotBefore[i].inputSchema.properties);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
