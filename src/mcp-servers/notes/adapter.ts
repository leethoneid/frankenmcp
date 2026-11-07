/**
 * @file adapter.ts
 * @description In-process MCP adapter for Notes server.
 * Enables zero-subprocess in-memory execution for Vercel serverless environments.
 */

import type { InProcessMCPAdapter, ToolDefinition } from '@/lib/mcp/in-process-adapter';
import { NotesCore, NOTE_TOOLS } from './core.mjs';

export class NotesAdapter implements InProcessMCPAdapter {
  readonly serverID = 'notes';
  readonly name = 'Notes Server';

  private core: NotesCore;

  constructor(core?: NotesCore) {
    this.core = core ?? new NotesCore();
  }

  /**
   * Synchronously returns 5 tool definitions exposed by the notes server.
   */
  listTools(): ToolDefinition[] {
    return NOTE_TOOLS as ToolDefinition[];
  }

  /**
   * Dispatches tool invocation directly to NotesCore in-process.
   */
  async invokeTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
    switch (toolName) {
      case 'create_note':
        return this.core.createNote(args?.title, args?.content);
      case 'list_notes':
        return this.core.listNotes();
      case 'read_note':
        return this.core.readNote(args?.id);
      case 'update_note':
        return this.core.updateNote(args?.id, args?.title, args?.content);
      case 'delete_note':
        return this.core.deleteNote(args?.id);
      default:
        throw new Error(`Unknown tool: '${toolName}'`);
    }
  }

  dispose(): void {
    // In-process memory automatically garbage collected
  }
}
