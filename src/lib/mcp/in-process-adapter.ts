/**
 * @file in-process-adapter.ts
 * @description Interface definition for In-Process MCP Adapters.
 * Used in serverless environments (e.g. Vercel) where spawning persistent
 * stdio child processes is prohibited or incurs unacceptable cold-start latency.
 */

/**
 * Standard tool schema definition matching Model Context Protocol (MCP) tool schemas.
 */
export interface ToolDefinition {
  /** The unique name of the MCP tool. */
  name: string;
  /** Human-readable description of what the tool does. */
  description: string;
  /** JSON Schema object defining required parameters and types. */
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
    [key: string]: any;
  };
}

/**
 * Contract for in-process MCP server adapters running directly inside the Node.js runtime.
 */
export interface InProcessMCPAdapter {
  /** Server identifier matching `.kiro/settings/mcp.json` (e.g. 'notes', 'tasks', 'calculator'). */
  readonly serverID: string;

  /** Human-readable display name of the MCP server. */
  readonly name: string;

  /**
   * Returns all tools exposed by this server synchronously.
   * Unlike stdio transports which require asynchronous IPC roundtrips,
   * in-process adapters provide immediate access to schemas (<1ms).
   */
  listTools(): ToolDefinition[];

  /**
   * Executes a tool by name with the supplied arguments.
   *
   * @param toolName The name of the tool to invoke.
   * @param args Key-value argument dictionary for the tool.
   * @returns Promise resolving to the tool's execution result.
   * @throws Error if tool is unknown or parameter validation fails (fail loud).
   */
  invokeTool(toolName: string, args: Record<string, any>): Promise<any>;

  /**
   * Disposes of any resources held by the adapter.
   * Must be idempotent and safe to invoke multiple times.
   */
  dispose(): void;
}
