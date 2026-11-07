/**
 * @file adapter.ts
 * @description In-process MCP adapter for Tasks server.
 * Enables zero-subprocess in-memory execution for Vercel serverless environments.
 */

import type { InProcessMCPAdapter, ToolDefinition } from '@/lib/mcp/in-process-adapter';
import { TasksCore, TASK_TOOLS } from './core.mjs';

export class TasksAdapter implements InProcessMCPAdapter {
  readonly serverID = 'tasks';
  readonly name = 'Tasks Server';

  private core: TasksCore;

  constructor(core?: TasksCore) {
    this.core = core ?? new TasksCore();
  }

  /**
   * Synchronously returns 5 tool definitions exposed by the tasks server.
   */
  listTools(): ToolDefinition[] {
    return TASK_TOOLS as ToolDefinition[];
  }

  /**
   * Dispatches tool invocation directly to TasksCore in-process.
   */
  async invokeTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
    switch (toolName) {
      case 'create_task':
        return this.core.createTask(args?.title, args?.priority);
      case 'read_task':
        return this.core.readTask(args?.id);
      case 'update_task':
        return this.core.updateTask(args?.id, args?.title, args?.priority, args?.completed);
      case 'delete_task':
        return this.core.deleteTask(args?.id);
      case 'list_tasks':
        return this.core.listTasks(args?.filter);
      default:
        throw new Error(`Unknown tool: '${toolName}'`);
    }
  }

  dispose(): void {
    // In-process memory automatically garbage collected
  }
}
