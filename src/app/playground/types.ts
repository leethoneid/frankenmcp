/**
 * @file types.ts
 * @description Type definitions for the Playground Chat conversation state and routing feedback.
 */

/**
 * Summary of dynamic routing results for a single conversation turn.
 */
export interface RoutingSummary {
  /** Array of MCP server IDs selected by the router. */
  selectedServers: string[];
  /** Total number of tool definitions provided to the model. */
  toolsLoaded: number;
  /** Number of tool definitions trimmed/excluded from context. */
  toolsTrimmed: number;
  /** Estimated token savings achieved by trimming unused tools. */
  estimatedTokensSaved: number;
  /** Execution latency of the routing process in milliseconds. */
  routingTimeMs: number;
  /** Optional explanation or rationale behind the server selection. */
  reasoning?: string;
}

/**
 * Result of executing an individual MCP tool on a server.
 */
export interface ToolResult {
  /** Target MCP server ID that executed the tool. */
  serverID: string;
  /** Name of the tool invoked. */
  toolName: string;
  /** Execution outcome status ('success' or 'error'). */
  status: 'success' | 'error';
  /** Successful output returned by the MCP tool invocation. */
  result?: any;
  /** Error message if tool execution failed or timed out. */
  error?: string;
}

/**
 * A single conversational turn in the Playground, combining user prompt,
 * routing transparency metrics, warnings, and tool outputs.
 */
export interface Turn {
  /** Unique identifier for the turn. */
  id: string;
  /** Epoch timestamp in milliseconds when the turn was created. */
  timestamp: number;
  /** The natural language query submitted by the user. */
  userQuery: string;
  /** Dynamic routing metrics and selected servers. */
  routing?: RoutingSummary;
  /** Array of tool invocation results. */
  toolResults?: ToolResult[];
  /** Server warning notices (e.g. offline servers skipped). */
  warnings?: string[];
  /** Global turn error message if routing or execution encountered a fatal issue. */
  error?: string;
}
