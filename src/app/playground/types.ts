/**
 * @file types.ts
 * @description Type definitions for the Playground Chat conversation state and routing feedback.
 */

export interface RoutingSummary {
  selectedServers: string[];
  toolsLoaded: number;
  toolsTrimmed: number;
  estimatedTokensSaved: number;
  routingTimeMs: number;
  reasoning?: string;
}

export interface ToolResult {
  serverID: string;
  toolName: string;
  status: 'success' | 'error';
  result?: any;
  error?: string;
}

export interface Turn {
  id: string;
  timestamp: number;
  userQuery: string;
  routing?: RoutingSummary;
  toolResults?: ToolResult[];
  warnings?: string[];
  error?: string;
}
