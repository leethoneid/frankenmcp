import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

/**
 * Calculator Demo MCP Server
 * Stateless mathematical operations and unit conversions.
 */

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

const LENGTH_FACTORS = {
  m: 1,
  ft: 0.3048,
  in: 0.0254,
};

const WEIGHT_FACTORS = {
  kg: 1,
  lb: 0.45359237,
};

const CALCULATOR_TOOLS = [
  {
    name: 'add',
    description: 'Add two numbers (a + b)',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'First number' },
        b: { type: 'number', description: 'Second number' },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'subtract',
    description: 'Subtract b from a (a - b)',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'First number' },
        b: { type: 'number', description: 'Second number' },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'multiply',
    description: 'Multiply two numbers (a * b)',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'First number' },
        b: { type: 'number', description: 'Second number' },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'divide',
    description: 'Divide a by b (a / b)',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'Numerator' },
        b: { type: 'number', description: 'Denominator (cannot be 0)' },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'convert_units',
    description: 'Convert values between units of length (m, ft, in), weight (kg, lb), or temperature (C, F)',
    inputSchema: {
      type: 'object',
      properties: {
        value: { type: 'number', description: 'Numeric value to convert' },
        from: { type: 'string', description: 'Source unit (m, ft, in, kg, lb, C, F)' },
        to: { type: 'string', description: 'Target unit (m, ft, in, kg, lb, C, F)' },
      },
      required: ['value', 'from', 'to'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: CALCULATOR_TOOLS };
});

function assertNumeric(val, paramName) {
  if (typeof val !== 'number' || isNaN(val)) {
    throw new Error(`Parameter '${paramName}' must be a valid number`);
  }
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'add': {
      assertNumeric(args?.a, 'a');
      assertNumeric(args?.b, 'b');
      return {
        content: [{ type: 'text', text: JSON.stringify({ result: args.a + args.b }) }],
      };
    }

    case 'subtract': {
      assertNumeric(args?.a, 'a');
      assertNumeric(args?.b, 'b');
      return {
        content: [{ type: 'text', text: JSON.stringify({ result: args.a - args.b }) }],
      };
    }

    case 'multiply': {
      assertNumeric(args?.a, 'a');
      assertNumeric(args?.b, 'b');
      return {
        content: [{ type: 'text', text: JSON.stringify({ result: args.a * args.b }) }],
      };
    }

    case 'divide': {
      assertNumeric(args?.a, 'a');
      assertNumeric(args?.b, 'b');
      if (args.b === 0) {
        throw new Error('Division by zero is not allowed');
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ result: args.a / args.b }) }],
      };
    }

    case 'convert_units': {
      assertNumeric(args?.value, 'value');
      if (typeof args.from !== 'string' || typeof args.to !== 'string') {
        throw new Error("convert_units requires string parameters: 'from' and 'to'");
      }

      const from = args.from.trim();
      const to = args.to.trim();
      const val = args.value;

      // Length conversion
      if (LENGTH_FACTORS[from] !== undefined && LENGTH_FACTORS[to] !== undefined) {
        const inMeters = val * LENGTH_FACTORS[from];
        const result = inMeters / LENGTH_FACTORS[to];
        return {
          content: [{ type: 'text', text: JSON.stringify({ result: Number(result.toFixed(6)) }) }],
        };
      }

      // Weight conversion
      if (WEIGHT_FACTORS[from] !== undefined && WEIGHT_FACTORS[to] !== undefined) {
        const inKg = val * WEIGHT_FACTORS[from];
        const result = inKg / WEIGHT_FACTORS[to];
        return {
          content: [{ type: 'text', text: JSON.stringify({ result: Number(result.toFixed(6)) }) }],
        };
      }

      // Temperature conversion
      if (['C', 'F'].includes(from) && ['C', 'F'].includes(to)) {
        let result = val;
        if (from === 'C' && to === 'F') {
          result = (val * 9) / 5 + 32;
        } else if (from === 'F' && to === 'C') {
          result = ((val - 32) * 5) / 9;
        }
        return {
          content: [{ type: 'text', text: JSON.stringify({ result: Number(result.toFixed(6)) }) }],
        };
      }

      throw new Error(`Incompatible or unsupported unit conversion from '${from}' to '${to}'`);
    }

    default:
      throw new Error(`Unknown tool: '${name}'`);
  }
});

// Auto-connect to stdio when executed directly
const transport = new StdioServerTransport();
await server.connect(transport);
