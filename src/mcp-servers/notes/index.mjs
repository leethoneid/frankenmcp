import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { NotesCore, NOTE_TOOLS } from './core.mjs';

/**
 * Notes Demo MCP Server
 * Zero-config local notes store with CRUD operations and demo fixtures.
 */

const core = new NotesCore();

const server = new Server(
  {
    name: 'notes-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: NOTE_TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'create_note': {
      const note = core.createNote(args?.title, args?.content);
      return {
        content: [{ type: 'text', text: JSON.stringify({ id: note.id }) }],
      };
    }

    case 'read_note': {
      const note = core.readNote(args?.id);
      return {
        content: [{ type: 'text', text: JSON.stringify(note) }],
      };
    }

    case 'update_note': {
      const note = core.updateNote(args?.id, args?.title, args?.content);
      return {
        content: [{ type: 'text', text: JSON.stringify({ id: note.id }) }],
      };
    }

    case 'delete_note': {
      const res = core.deleteNote(args?.id);
      return {
        content: [{ type: 'text', text: JSON.stringify(res) }],
      };
    }

    case 'list_notes': {
      const summaryList = core.listNotes().map((n) => ({
        id: n.id,
        title: n.title,
      }));
      return {
        content: [{ type: 'text', text: JSON.stringify({ notes: summaryList }) }],
      };
    }

    default:
      throw new Error(`Unknown tool: '${name}'`);
  }
});

// Auto-connect to stdio when executed directly
const transport = new StdioServerTransport();
await server.connect(transport);
