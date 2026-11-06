import { ChildProcess } from 'child_process';
import { MCPClient } from '@/lib/mcp/client';
import { recordTurn, computeTurnStats } from './stats';
import {
  RoutingDecision,
  SearchResult,
  ServerManifest,
  TurnStatistics,
  RouterUnavailableError,
  RoutingTimeoutError,
  InvalidRoutingDecisionError,
  NoRelevantToolsError,
  AllServersUnavailableError,
} from './types';

/**
 * PBT Strategy Decision (Task 3.2): Option B (Inject Stub Search Function)
 *
 * Rationale:
 * - Option A (ephemeral test servers) creates heavy subprocess spawn/kill overhead on every test case,
 *   which is especially slow and resource-intensive across 100+ fast-check iterations on Windows.
 * - Option B injects a deterministic search function via `options.searchFn` into `routeIntent()`.
 *   This enables sub-second property-based testing of core invariants (schema parameter preservation,
 *   routing determinism, schema round-trip fidelity) while end-to-end integration tests verify real
 *   router subprocess execution.
 */

export interface RouterProcessOptions {
  command?: string;
  args?: string[];
  client?: MCPClient;
}

export interface SearchToolsOptions {
  client?: MCPClient;
  timeoutMs?: number;
  searchFn?: (query: string) => Promise<SearchResult[]>;
}

export interface RouteIntentOptions {
  bypassCache?: boolean;
  searchFn?: (query: string) => Promise<SearchResult[]>;
  client?: MCPClient;
  timeoutMs?: number;
  turnID?: string;
  onTurnRecorded?: (stats: TurnStatistics) => void;
}

const MAX_CACHE_SIZE = 100;
const routingCache = new Map<string, RoutingDecision>();

let activeRouterProcess: ChildProcess | null = null;
let activeRouterClient: MCPClient | null = null;
let exitListenerAttached = false;

/**
 * Access the active router client (or null if not running).
 */
export function getRouterClient(): MCPClient | null {
  return activeRouterClient;
}

/**
 * Override or inject the active router client (useful for unit tests).
 */
export function setRouterClient(client: MCPClient | null): void {
  activeRouterClient = client;
}

/**
 * Spawns the router subprocess (defaulting to `npx -y github:leethoneid/mcp-dynamic-router serve`),
 * captures stdout/stderr, monitors exit code, and connects an MCP stdio client.
 *
 * Throws RouterUnavailableError if spawning fails or the process exits with a non-zero code.
 */
export async function startRouterProcess(options: RouterProcessOptions = {}): Promise<ChildProcess> {
  if (activeRouterClient && activeRouterProcess && !activeRouterProcess.killed) {
    return activeRouterProcess;
  }

  const isWindows = process.platform === 'win32';
  const defaultCommand = isWindows ? 'npx.cmd' : 'npx';
  const command = options.command || defaultCommand;
  const args = options.args || ['-y', 'github:leethoneid/mcp-dynamic-router', 'serve'];

  try {
    const client = options.client || new MCPClient({
      id: 'mcp-dynamic-router',
      name: 'Dynamic MCP Router',
      transport: 'stdio',
      command,
      args,
    });

    await client.connect();

    // Access underlying child process from StdioClientTransport
    const transport = (client as unknown as { transport?: { _process?: ChildProcess } }).transport;
    const child = transport?._process;

    if (!child) {
      throw new Error('Transport did not expose a valid child process');
    }

    // Capture and log stderr for debugging
    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        if (text.trim()) {
          console.error('[Router Process STDERR]:', text.trim());
        }
      });
    }

    // Monitor exit code
    child.on('exit', (code) => {
      if (code !== null && code !== 0 && activeRouterProcess === child) {
        console.error(`[Router Process] Exited unexpectedly with non-zero code ${code}`);
        activeRouterClient = null;
        activeRouterProcess = null;
      }
    });

    activeRouterClient = client;
    activeRouterProcess = child;

    setupGracefulShutdown();
    return child;
  } catch (cause) {
    await stopRouterProcess().catch(() => {});
    throw new RouterUnavailableError(cause);
  }
}

/**
 * Terminate the active router process and disconnect its MCP client.
 */
export async function stopRouterProcess(): Promise<void> {
  const clientToClose = activeRouterClient;
  const processToKill = activeRouterProcess;

  activeRouterClient = null;
  activeRouterProcess = null;

  if (clientToClose) {
    try {
      await clientToClose.disconnect();
    } catch (err) {
      console.warn('[Router Process] Warning while disconnecting router client:', err);
    }
  }

  if (processToKill && !processToKill.killed) {
    try {
      processToKill.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
}

/**
 * Query the dynamic router's `mcp_search_tools` tool to retrieve relevant tools.
 *
 * Throws:
 * - RoutingTimeoutError if call exceeds timeoutMs (default 2000ms)
 * - NoRelevantToolsError if router returns empty list
 * - InvalidRoutingDecisionError if router response is malformed
 */
export async function searchTools(
  query: string,
  options: SearchToolsOptions = {}
): Promise<SearchResult[]> {
  if (options.searchFn) {
    return options.searchFn(query);
  }

  const timeoutMs = options.timeoutMs ?? 2000;
  let client = options.client || activeRouterClient;

  if (!client) {
    await startRouterProcess();
    client = activeRouterClient;
  }

  if (!client) {
    throw new RouterUnavailableError(new Error('Failed to acquire connected router client'));
  }

  let toolResult: unknown;
  try {
    const callPromise = client.callTool('mcp_search_tools', { query });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new RoutingTimeoutError(timeoutMs)), timeoutMs).unref()
    );

    toolResult = await Promise.race([callPromise, timeoutPromise]);
  } catch (err) {
    if (err instanceof RoutingTimeoutError) {
      throw err;
    }
    throw new InvalidRoutingDecisionError(err, (err as Error).message);
  }

  return parseSearchResults(toolResult, query);
}

/**
 * Parses and validates raw tool response into SearchResult[].
 */
export function parseSearchResults(rawResponse: unknown, query: string): SearchResult[] {
  let list: unknown;

  if (Array.isArray(rawResponse)) {
    list = rawResponse;
  } else if (rawResponse && typeof rawResponse === 'object') {
    const obj = rawResponse as Record<string, unknown>;
    if (Array.isArray(obj.content)) {
      const textItem = obj.content.find(
        (c) => typeof c === 'object' && c !== null && (c as { type?: string }).type === 'text'
      ) as { text?: string } | undefined;

      if (textItem && typeof textItem.text === 'string') {
        try {
          list = JSON.parse(textItem.text);
        } catch (err) {
          throw new InvalidRoutingDecisionError(rawResponse, `Failed to parse tool content JSON: ${(err as Error).message}`);
        }
      } else {
        list = obj.content;
      }
    } else if (Array.isArray(obj.tools)) {
      list = obj.tools;
    } else if (Array.isArray(obj.results)) {
      list = obj.results;
    } else {
      throw new InvalidRoutingDecisionError(rawResponse, 'Malformed router response: missing array or content');
    }
  } else {
    throw new InvalidRoutingDecisionError(rawResponse, 'Expected object or array response from router');
  }

  if (!Array.isArray(list)) {
    throw new InvalidRoutingDecisionError(rawResponse, 'Extracted search results is not an array');
  }

  if (list.length === 0) {
    throw new NoRelevantToolsError(query);
  }

  return list.map((item, idx) => {
    if (typeof item !== 'object' || item === null) {
      throw new InvalidRoutingDecisionError(rawResponse, `Search result at index ${idx} is not an object`);
    }

    const obj = item as Record<string, unknown>;
    const tool = typeof obj.tool === 'string' ? obj.tool : typeof obj.name === 'string' ? obj.name : null;
    const server = typeof obj.server === 'string' ? obj.server : typeof obj.serverId === 'string' ? obj.serverId : null;
    const score = typeof obj.score === 'number' ? obj.score : 1.0;
    const description = typeof obj.description === 'string' ? obj.description : '';

    if (!tool) {
      throw new InvalidRoutingDecisionError(rawResponse, `Search result at index ${idx} missing 'tool' field`);
    }
    if (!server) {
      throw new InvalidRoutingDecisionError(rawResponse, `Search result at index ${idx} missing 'server' field`);
    }

    return {
      tool,
      server,
      score,
      description,
    };
  });
}

/**
 * Derives a RoutingDecision by grouping SearchResult[] by server and matching
 * against available ServerManifests.
 */
export function deriveRoutingDecision(
  searchResults: SearchResult[],
  allServers: ServerManifest[]
): RoutingDecision {
  if (!searchResults || searchResults.length === 0) {
    throw new NoRelevantToolsError('');
  }

  const availableServerMap = new Map(allServers.map((s) => [s.id, s]));
  const serverToolMap = new Map<string, Set<string>>();
  let topScore = -Infinity;
  let topTool = '';

  for (const res of searchResults) {
    if (!availableServerMap.has(res.server)) {
      continue; // exclude servers not registered or available
    }

    if (!serverToolMap.has(res.server)) {
      serverToolMap.set(res.server, new Set());
    }
    serverToolMap.get(res.server)!.add(res.tool);

    if (res.score > topScore) {
      topScore = res.score;
      topTool = `${res.server}:${res.tool}`;
    }
  }

  const selectedServers = Array.from(serverToolMap.keys());
  if (selectedServers.length === 0) {
    throw new NoRelevantToolsError('No matching tools among available servers');
  }

  const toolFilter = selectedServers.map((serverID) => ({
    serverID,
    includedTools: Array.from(serverToolMap.get(serverID)!),
  }));

  const reasoning = topScore > -Infinity
    ? `Selected ${selectedServers.length} server(s), top match: ${topTool} (score: ${topScore.toFixed(2)})`
    : undefined;

  return {
    selectedServers,
    toolFilter,
    reasoning,
  };
}

/**
 * Calculate per-turn metrics adhering strictly to design.md definitions:
 * - toolsLoaded: tools loaded into context (count of tools included in decision)
 * - toolsTrimmed: excluded tools from selected servers only ((total tools in selected servers) - toolsLoaded)
 * - estimatedTokensSaved: ceil(character count of trimmed schemas / 4)
 *
 * Delegates directly to computeTurnStats in stats.ts to keep a single canonical implementation.
 */
export const calculateTurnStats = computeTurnStats;

/**
 * Build deterministic cache key for (intent + server set).
 */
export function getRoutingCacheKey(intent: string, servers: ServerManifest[]): string {
  const serverIDs = servers.map((s) => s.id).sort().join(',');
  return `${intent.trim().toLowerCase()}::${serverIDs}`;
}

/**
 * Clear the session-scoped routing cache.
 */
export function clearRoutingCache(): void {
  routingCache.clear();
}

/**
 * Get current entry count of routing cache.
 */
export function getRoutingCacheSize(): number {
  return routingCache.size;
}

/**
 * Main entry point for routing user intent to relevant MCP servers and tools.
 */
export async function routeIntent(
  intent: string,
  availableServers: ServerManifest[],
  options: RouteIntentOptions = {}
): Promise<RoutingDecision> {
  if (!availableServers || availableServers.length === 0) {
    throw new AllServersUnavailableError([]);
  }

  const cacheKey = getRoutingCacheKey(intent, availableServers);

  if (!options.bypassCache && routingCache.has(cacheKey)) {
    const cached = routingCache.get(cacheKey)!;
    // Refresh LRU position
    routingCache.delete(cacheKey);
    routingCache.set(cacheKey, cached);
    return cached;
  }

  const startTime = Date.now();
  let results: SearchResult[];

  if (options.searchFn) {
    results = await options.searchFn(intent);
  } else {
    results = await searchTools(intent, {
      client: options.client,
      timeoutMs: options.timeoutMs,
    });
  }

  const decision = deriveRoutingDecision(results, availableServers);
  const routingTimeMs = Date.now() - startTime;

  // Manage LRU cache bound
  if (routingCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = routingCache.keys().next().value;
    if (oldestKey) {
      routingCache.delete(oldestKey);
    }
  }
  routingCache.set(cacheKey, decision);

  // Calculate and record turn statistics via recordTurn() (Task 4.1)
  const stats = calculateTurnStats(
    options.turnID || `turn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    intent,
    decision,
    availableServers,
    routingTimeMs
  );
  recordTurn(stats);

  if (options.onTurnRecorded) {
    options.onTurnRecorded(stats);
  }

  return decision;
}

function setupGracefulShutdown(): void {
  if (typeof process !== 'undefined' && !exitListenerAttached) {
    exitListenerAttached = true;
    process.once('beforeExit', () => {
      stopRouterProcess().catch(() => {});
    });
  }
}
