import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  {
    name: 'test-stdio-router',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'mcp_search_tools',
        description: 'Simulates dynamic router tool search',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
          required: ['query'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'mcp_search_tools') {
    const query = String(request.params.arguments?.query || '').toLowerCase();

    let results = [];
    if (query.includes('note')) {
      results = [
        { tool: 'create_note', server: 'notes', score: 0.95, description: 'Create note' },
        { tool: 'read_note', server: 'notes', score: 0.88, description: 'Read note' },
      ];
    } else if (query.includes('calc') || query.includes('add') || query.includes('math')) {
      results = [
        { tool: 'add', server: 'calculator', score: 0.91, description: 'Add two numbers' },
      ];
    } else {
      results = [
        { tool: 'list_notes', server: 'notes', score: 0.5, description: 'List notes' },
      ];
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
