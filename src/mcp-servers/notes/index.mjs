import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

/**
 * Notes Demo MCP Server
 * Zero-config local notes store with CRUD operations and demo fixtures.
 */

// In-memory note storage
const notes = new Map();

// 3 Pre-populated demo fixtures with [DEMO] marker in content
notes.set('note-1', {
  id: 'note-1',
  title: 'Project Kickoff',
  content: '[DEMO] Welcome to FrankenMCP Monster Lab. Heterogeneous MCP routing is live.',
  created: Date.now() - 3600000,
});
notes.set('note-2', {
  id: 'note-2',
  title: 'Architecture Blueprint',
  content: '[DEMO] Dynamic router trims unnecessary tool definitions per turn to save LLM context.',
  created: Date.now() - 1800000,
});
notes.set('note-3', {
  id: 'note-3',
  title: 'Lab Supply Checklist',
  content: '[DEMO] Electrodes, lightning rod ground cables, test tubes, and spare CPU cores.',
  created: Date.now() - 600000,
});

let idCounter = 4;

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

const NOTE_TOOLS = [
  {
    name: 'create_note',
    description: 'Create a new note with a title and content',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the note' },
        content: { type: 'string', description: 'Body text of the note' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'read_note',
    description: 'Read a note by its unique identifier',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the note to retrieve' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_note',
    description: 'Update the title or content of an existing note',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the note to update' },
        title: { type: 'string', description: 'New title (optional)' },
        content: { type: 'string', description: 'New content (optional)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_note',
    description: 'Delete a note by its identifier',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the note to delete' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_notes',
    description: 'List all notes available in the local store',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: NOTE_TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'create_note': {
      if (!args || typeof args.title !== 'string' || typeof args.content !== 'string') {
        throw new Error('create_note requires non-empty string parameters: title, content');
      }
      const id = `note-${idCounter++}`;
      notes.set(id, {
        id,
        title: args.title,
        content: args.content,
        created: Date.now(),
      });
      return {
        content: [{ type: 'text', text: JSON.stringify({ id }) }],
      };
    }

    case 'read_note': {
      if (!args || typeof args.id !== 'string') {
        throw new Error('read_note requires parameter: id');
      }
      const note = notes.get(args.id);
      if (!note) {
        throw new Error(`Note not found with id: '${args.id}'`);
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(note) }],
      };
    }

    case 'update_note': {
      if (!args || typeof args.id !== 'string') {
        throw new Error('update_note requires parameter: id');
      }
      const note = notes.get(args.id);
      if (!note) {
        throw new Error(`Cannot update: note not found with id: '${args.id}'`);
      }
      if (typeof args.title === 'string') {
        note.title = args.title;
      }
      if (typeof args.content === 'string') {
        note.content = args.content;
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ id: note.id }) }],
      };
    }

    case 'delete_note': {
      if (!args || typeof args.id !== 'string') {
        throw new Error('delete_note requires parameter: id');
      }
      if (!notes.has(args.id)) {
        throw new Error(`Cannot delete: note not found with id: '${args.id}'`);
      }
      notes.delete(args.id);
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
      };
    }

    case 'list_notes': {
      const summaryList = Array.from(notes.values()).map((n) => ({
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
