/**
 * Type definitions and custom error classes for the FrankenMCP Router Core.
 *
 * Implements requirements from:
 * - .kiro/specs/router-core/requirements.md (C-2, FR-1, FR-2, FR-3)
 * - .kiro/specs/router-core/design.md
 */

/**
 * Standard JSON Schema definition used for tool parameter schemas.
 */
export interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  [key: string]: any;
}

/**
 * Tool definition exposed by an MCP server.
 */
export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
}

/**
 * Connection and operational status of an MCP server.
 */
export type ServerStatus = 'connected' | 'disconnected' | 'error' | 'starting';

/**
 * Configuration needed to connect to an MCP server.
 */
export interface ServerConfig {
  id: string;
  name: string;
  transport: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  endpoint?: string;
  headers?: Record<string, string>;
  disabled?: boolean;
}

/**
 * Runtime manifest representing an active or registered MCP server with its exposed tools.
 */
export interface ServerManifest {
  id: string;
  name: string;
  transport: 'stdio' | 'sse' | 'http';
  tools: ToolSchema[];
  status: ServerStatus;
  /**
   * Timestamp in milliseconds when the server status last transitioned.
   */
  lastStatusChangeAt?: number;
  /**
   * Error message captured during the most recent connection or health-check failure.
   */
  lastError?: string;
}

/**
 * Search result entry returned by the dynamic router matching algorithm.
 */
export interface SearchResult {
  tool: string;
  server: string;
  score: number;
  description: string;
}

/**
 * Decision returned by the routing engine for a user intent.
 */
export interface RoutingDecision {
  /**
   * IDs of servers selected for this intent.
   */
  selectedServers: string[];

  /**
   * Specific tool filters per selected server.
   */
  toolFilter: {
    serverID: string;
    includedTools: string[];
  }[];

  /**
   * Optional explanation or score summary for the routing decision.
   */
  reasoning?: string;
}

/**
 * Statistics tracked per user conversation turn.
 *
 * Note on semantics:
 * - `toolsLoaded` is the number of tools loaded into context (included in routing decision),
 *   NOT the total tools from selected servers.
 * - `toolsTrimmed` is the count of tools in selected servers that were excluded from context.
 */
export interface TurnStatistics {
  turnID: string;
  timestamp: number;
  intent: string;
  selectedServers: string[];
  /**
   * Count of tools loaded into the LLM context for this turn.
   */
  toolsLoaded: number;
  /**
   * Count of tools excluded from the selected servers.
   */
  toolsTrimmed: number;
  /**
   * Estimated token savings based on character count of trimmed schemas.
   */
  estimatedTokensSaved: number;
  /**
   * Time in milliseconds taken to perform routing.
   */
  routingTimeMs: number;
  /**
   * Per-server tool inclusion filters for this turn (same shape as RoutingDecision.toolFilter).
   */
  toolFilter: {
    serverID: string;
    includedTools: string[];
  }[];
  /**
   * Optional explanation or score summary for the routing decision.
   */
  reasoning?: string;
}

/**
 * Aggregated statistics across an entire session.
 */
export interface SessionStatistics {
  turns: TurnStatistics[];
  totalToolsLoaded: number;
  totalToolsTrimmed: number;
  totalTokensSaved: number;
  averageRoutingTimeMs: number;
}

// ============================================================================
// Custom Error Classes (Fail-Loud Architecture)
// ============================================================================

export class RouterUnavailableError extends Error {
  constructor(public cause?: Error | unknown) {
    super('Router process failed to start');
    this.name = 'RouterUnavailableError';
  }
}

export class RoutingTimeoutError extends Error {
  constructor(public timeoutMs: number) {
    super(`Router did not respond within ${timeoutMs}ms`);
    this.name = 'RoutingTimeoutError';
  }
}

export class InvalidRoutingDecisionError extends Error {
  constructor(public response: unknown, public reason: string) {
    super(`Invalid routing response: ${reason}`);
    this.name = 'InvalidRoutingDecisionError';
  }
}

export class NoRelevantToolsError extends Error {
  constructor(public intent: string) {
    super(`No relevant tools found for intent: "${intent}"`);
    this.name = 'NoRelevantToolsError';
  }
}

export class ServerConnectionError extends Error {
  constructor(public serverID: string, public cause?: Error | unknown) {
    super(`Failed to connect to server '${serverID}'`);
    this.name = 'ServerConnectionError';
  }
}

export class ToolInvocationError extends Error {
  constructor(
    public serverID: string,
    public toolName: string,
    public cause?: Error | unknown
  ) {
    super(`Tool '${toolName}' on server '${serverID}' failed`);
    this.name = 'ToolInvocationError';
  }
}

export class MCPConfigParseError extends Error {
  constructor(public configPath: string, public cause?: Error | unknown) {
    super(`Failed to parse MCP config at '${configPath}'`);
    this.name = 'MCPConfigParseError';
  }
}

export class AllServersUnavailableError extends Error {
  constructor(public serverIDs: string[]) {
    super(`All registered servers are unavailable: ${serverIDs.join(', ')}`);
    this.name = 'AllServersUnavailableError';
  }
}
