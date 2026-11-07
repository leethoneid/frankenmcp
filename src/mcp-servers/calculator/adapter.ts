/**
 * @file adapter.ts
 * @description In-process MCP adapter for Calculator server.
 * Enables zero-subprocess in-memory execution for Vercel serverless environments.
 */

import type { InProcessMCPAdapter, ToolDefinition } from '@/lib/mcp/in-process-adapter';
import { CalculatorCore, CALCULATOR_TOOLS } from './core.mjs';

export class CalculatorAdapter implements InProcessMCPAdapter {
  readonly serverID = 'calculator';
  readonly name = 'Calculator Server';

  private core: CalculatorCore;

  constructor(core?: CalculatorCore) {
    this.core = core ?? new CalculatorCore();
  }

  /**
   * Synchronously returns 5 tool definitions exposed by the calculator server.
   */
  listTools(): ToolDefinition[] {
    return CALCULATOR_TOOLS as ToolDefinition[];
  }

  /**
   * Dispatches tool invocation directly to CalculatorCore in-process.
   */
  async invokeTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
    switch (toolName) {
      case 'add':
        return { result: this.core.add(args?.a, args?.b) };
      case 'subtract':
        return { result: this.core.subtract(args?.a, args?.b) };
      case 'multiply':
        return { result: this.core.multiply(args?.a, args?.b) };
      case 'divide':
        return { result: this.core.divide(args?.a, args?.b) };
      case 'convert_units':
        return { result: this.core.convertUnits(args?.value, args?.from, args?.to) };
      default:
        throw new Error(`Unknown tool: '${toolName}'`);
    }
  }

  dispose(): void {
    // In-process memory automatically garbage collected
  }
}
