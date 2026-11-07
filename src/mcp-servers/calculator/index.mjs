import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { CalculatorCore, CALCULATOR_TOOLS } from './core.mjs';

/**
 * Calculator Demo MCP Server
 * Stateless mathematical operations and unit conversions.
 */

const core = new CalculatorCore();

const server = new Server(
  {
    name: 'calculator-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: CALCULATOR_TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'add': {
      const result = core.add(args?.a, args?.b);
      return {
        content: [{ type: 'text', text: JSON.stringify({ result }) }],
      };
    }

    case 'subtract': {
      const result = core.subtract(args?.a, args?.b);
      return {
        content: [{ type: 'text', text: JSON.stringify({ result }) }],
      };
    }

    case 'multiply': {
      const result = core.multiply(args?.a, args?.b);
      return {
        content: [{ type: 'text', text: JSON.stringify({ result }) }],
      };
    }

    case 'divide': {
      const result = core.divide(args?.a, args?.b);
      return {
        content: [{ type: 'text', text: JSON.stringify({ result }) }],
      };
    }

    case 'convert_units': {
      const result = core.convertUnits(args?.value, args?.from, args?.to);
      return {
        content: [{ type: 'text', text: JSON.stringify({ result }) }],
      };
    }

    default:
      throw new Error(`Unknown tool: '${name}'`);
  }
});

// Auto-connect to stdio when executed directly
const transport = new StdioServerTransport();
await server.connect(transport);
