import {
  TurnStatistics,
  SessionStatistics,
  ToolSchema,
  ServerManifest,
  RoutingDecision,
} from './types';

/**
 * In-memory storage for turn statistics in the current session.
 * C-4: Statistics SHALL be stored in memory for the session and SHALL NOT persist to a database.
 */
let sessionTurns: TurnStatistics[] = [];

/**
 * Record a single conversation turn's routing statistics into session history.
 */
export function recordTurn(stats: TurnStatistics): void {
  if (!stats || typeof stats !== 'object') {
    throw new Error('[Stats] Invalid TurnStatistics object provided to recordTurn');
  }

  if (
    typeof stats.toolsLoaded !== 'number' ||
    typeof stats.toolsTrimmed !== 'number' ||
    typeof stats.estimatedTokensSaved !== 'number' ||
    typeof stats.routingTimeMs !== 'number'
  ) {
    throw new Error('[Stats] TurnStatistics contains non-numeric metric values');
  }

  sessionTurns.push({
    ...stats,
    toolFilter: stats.toolFilter
      ? stats.toolFilter.map((f) => ({ serverID: f.serverID, includedTools: [...f.includedTools] }))
      : [],
  });
}

/**
 * Retrieve aggregated statistics across all recorded turns in the current session.
 * Throws an Error if calculation fails or state is corrupted (never returns hard-coded fake data).
 */
export function getSessionStats(): SessionStatistics {
  try {
    let totalToolsLoaded = 0;
    let totalToolsTrimmed = 0;
    let totalTokensSaved = 0;
    let totalRoutingTimeMs = 0;

    for (const turn of sessionTurns) {
      if (
        isNaN(turn.toolsLoaded) ||
        isNaN(turn.toolsTrimmed) ||
        isNaN(turn.estimatedTokensSaved) ||
        isNaN(turn.routingTimeMs)
      ) {
        throw new Error(`Corrupted TurnStatistics encountered in turn ID: ${turn.turnID}`);
      }

      totalToolsLoaded += turn.toolsLoaded;
      totalToolsTrimmed += turn.toolsTrimmed;
      totalTokensSaved += turn.estimatedTokensSaved;
      totalRoutingTimeMs += turn.routingTimeMs;
    }

    const averageRoutingTimeMs =
      sessionTurns.length === 0 ? 0 : Math.round(totalRoutingTimeMs / sessionTurns.length);

    return {
      turns: [...sessionTurns],
      totalToolsLoaded,
      totalToolsTrimmed,
      totalTokensSaved,
      averageRoutingTimeMs,
    };
  } catch (err) {
    console.error('[Stats] Failed to calculate session statistics:', err);
    throw err;
  }
}

/**
 * Safe accessor that returns null instead of throwing if statistics calculation fails.
 */
export function safeGetSessionStats(): SessionStatistics | null {
  try {
    return getSessionStats();
  } catch (err) {
    console.error('[Stats] safeGetSessionStats caught error:', err);
    return null;
  }
}

/**
 * Clear all session statistics (primarily for session reset or test isolation).
 */
export function resetSessionStats(): void {
  sessionTurns = [];
}

/**
 * Get count of recorded turns in current session.
 */
export function getRecordedTurnsCount(): number {
  return sessionTurns.length;
}

/**
 * Estimate token savings based on character count of trimmed schemas.
 * Formula: Math.ceil(characterCount / 4)
 *
 * Returns null if schema input is invalid or calculation encounters an error.
 */
export function estimateTokenSavings(trimmedSchemas: ToolSchema[]): number | null {
  if (!Array.isArray(trimmedSchemas)) {
    console.error('[Stats] estimateTokenSavings error: trimmedSchemas is not an array', trimmedSchemas);
    return null;
  }

  try {
    let charCount = 0;
    for (const schema of trimmedSchemas) {
      if (!schema || typeof schema !== 'object' || typeof schema.name !== 'string') {
        console.error('[Stats] estimateTokenSavings error: invalid ToolSchema object', schema);
        return null;
      }
      charCount += JSON.stringify(schema).length;
    }
    return Math.ceil(charCount / 4);
  } catch (err) {
    console.error('[Stats] estimateTokenSavings error while serializing schemas:', err);
    return null;
  }
}

/**
 * Compute TurnStatistics strictly following design.md semantics:
 * - toolsLoaded: tools loaded into context (count of tools included in decision)
 * - toolsTrimmed: excluded tools from selected servers only ((total tools in selected servers) - toolsLoaded)
 * - estimatedTokensSaved: based on excluded schemas from selected servers only
 */
export function computeTurnStats(
  turnID: string,
  intent: string,
  decision: RoutingDecision,
  allServers: ServerManifest[],
  routingTimeMs: number
): TurnStatistics {
  const serverMap = new Map(allServers.map((s) => [s.id, s]));
  let toolsLoaded = 0;
  let totalToolsInSelectedServers = 0;
  const trimmedSchemas: ToolSchema[] = [];

  for (const filter of decision.toolFilter) {
    toolsLoaded += filter.includedTools.length;
    const server = serverMap.get(filter.serverID);
    if (server) {
      totalToolsInSelectedServers += server.tools.length;
      const includedSet = new Set(filter.includedTools);
      for (const tool of server.tools) {
        if (!includedSet.has(tool.name)) {
          trimmedSchemas.push(tool);
        }
      }
    }
  }

  const toolsTrimmed = totalToolsInSelectedServers - toolsLoaded;
  const tokenSavings = estimateTokenSavings(trimmedSchemas);
  const estimatedTokensSaved = tokenSavings !== null ? tokenSavings : 0;

  // Copy toolFilter and optional reasoning from RoutingDecision (Task 1.2)
  const toolFilter = decision.toolFilter.map((f) => ({
    serverID: f.serverID,
    includedTools: [...f.includedTools],
  }));

  const turnStats: TurnStatistics = {
    turnID,
    timestamp: Date.now(),
    intent,
    selectedServers: decision.selectedServers,
    toolsLoaded,
    toolsTrimmed,
    estimatedTokensSaved,
    routingTimeMs,
    toolFilter,
  };

  if (decision.reasoning !== undefined) {
    turnStats.reasoning = decision.reasoning;
  }

  return turnStats;
}

/**
 * Format token savings value for UI display with fail-safe fallback text.
 */
export function formatTokenSavings(tokens: number | null | undefined): string {
  if (tokens === null || tokens === undefined || isNaN(tokens)) {
    return 'Token savings unavailable';
  }
  return `${tokens} tokens`;
}

/**
 * Browser sessionStorage key used to bridge real Playground routing turns
 * across stateless serverless function instances.
 */
export const SESSION_TURNS_STORAGE_KEY = 'frankenmcp_session_turns';

/**
 * Read recorded TurnStatistics from browser sessionStorage if available.
 */
export function readSessionStorageTurns(): TurnStatistics[] {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return [];
  }
  try {
    const raw = window.sessionStorage.getItem(SESSION_TURNS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is TurnStatistics =>
        Boolean(t) &&
        typeof t.turnID === 'string' &&
        typeof t.toolsLoaded === 'number' &&
        typeof t.toolsTrimmed === 'number' &&
        typeof t.estimatedTokensSaved === 'number' &&
        typeof t.routingTimeMs === 'number'
    );
  } catch {
    return [];
  }
}

/**
 * Deduplicate and merge server-side turns with browser sessionStorage turns by turnID.
 */
export function mergeTurnsByTurnId(
  serverTurns: TurnStatistics[],
  storageTurns: TurnStatistics[]
): TurnStatistics[] {
  const byId = new Map<string, TurnStatistics>();
  for (const t of serverTurns || []) {
    if (t && typeof t.turnID === 'string') {
      byId.set(t.turnID, t);
    }
  }
  for (const t of storageTurns || []) {
    if (t && typeof t.turnID === 'string') {
      byId.set(t.turnID, t);
    }
  }
  return Array.from(byId.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}

/**
 * Merge server-side SessionStatistics with browser sessionStorage turns,
 * deduplicating by turnID and recomputing aggregate totals from real turns.
 */
export function mergeSessionStats(
  serverStats: SessionStatistics,
  storageTurns: TurnStatistics[]
): SessionStatistics {
  if (!storageTurns || storageTurns.length === 0) {
    return serverStats;
  }

  const mergedTurns = mergeTurnsByTurnId(serverStats?.turns || [], storageTurns);
  let totalToolsLoaded = 0;
  let totalToolsTrimmed = 0;
  let totalTokensSaved = 0;
  let totalRoutingTimeMs = 0;

  for (const turn of mergedTurns) {
    totalToolsLoaded += turn.toolsLoaded;
    totalToolsTrimmed += turn.toolsTrimmed;
    totalTokensSaved += turn.estimatedTokensSaved;
    totalRoutingTimeMs += turn.routingTimeMs;
  }

  const averageRoutingTimeMs =
    mergedTurns.length === 0 ? 0 : Math.round(totalRoutingTimeMs / mergedTurns.length);

  return {
    turns: mergedTurns,
    totalToolsLoaded,
    totalToolsTrimmed,
    totalTokensSaved,
    averageRoutingTimeMs,
  };
}
