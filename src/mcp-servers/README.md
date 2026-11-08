# Demo MCP Servers Guide

This directory (`src/mcp-servers/`) houses pre-configured, zero-API-key demo MCP servers for **FrankenMCP**.

---

## 1. Existing Demo Servers

All demo servers are written as **native ES modules (`.mjs`)** using `@modelcontextprotocol/sdk`. They run directly with `node` with zero compilation steps.

| Server | Path | Tools Exposed | Fixtures / State |
| :--- | :--- | :--- | :--- |
| **Notes** | `src/mcp-servers/notes/index.mjs` | `create_note`, `read_note`, `update_note`, `delete_note`, `list_notes` | In-memory `Map` pre-seeded with 3 demo notes (each marked `[DEMO]`). |
| **Tasks** | `src/mcp-servers/tasks/index.mjs` | `create_task`, `read_task`, `update_task`, `delete_task`, `list_tasks` | In-memory `Map` pre-seeded with 5 demo tasks (each marked `[DEMO]`). |
| **Calculator** | `src/mcp-servers/calculator/index.mjs` | `add`, `subtract`, `multiply`, `divide`, `convert_units` | Stateless arithmetic and unit conversions (m/ft/in, kg/lb, C/F). |

---

## 2. Core Development Rules

When creating or modifying demo servers, follow these strict rules:

1. **Native ES Module (`.mjs`)**:
   Always use pure JavaScript with `.mjs` extension. This ensures child processes can be spawned directly by `MCPServerManager` without a build or TypeScript compilation step.
2. **Labeled Demo Data (`[DEMO]`)**:
   All pre-seeded fixture data MUST contain the `[DEMO]` prefix so it is visually transparent to reviewers.
3. **Fail-Loud Input Validation**:
   Validate tool inputs explicitly. Throw errors for missing required arguments, zero divisions, or non-existent IDs instead of failing silently.
4. **Stdio Protocol**:
   Use `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js` for process communication.

---

## 3. How to Add a New Demo Server

Adding a new demo server requires two steps:

### Step 1: Create the Server Script (`src/mcp-servers/<name>/index.mjs`)

```javascript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  {
    name: 'weather-demo-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 1. Define tools and schemas
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_current_weather',
        description: 'Get current weather conditions for a city [DEMO]',
        inputSchema: {
          type: 'object',
          properties: {
            city: { type: 'string', description: 'Target city name' },
          },
          required: ['city'],
        },
      },
    ],
  };
});

// 2. Implement tool handler with fail-loud validation
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'get_current_weather') {
    if (!args || typeof args.city !== 'string') {
      throw new Error("Missing required parameter 'city'");
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            city: args.city,
            temperature: 22,
            conditions: 'Sunny',
            note: '[DEMO] Synthetic fixture data for demonstration',
          }),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// 3. Connect to stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

### Step 2: Register in `.kiro/settings/mcp.json`

Add an entry under `mcpServers`:

```json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["src/mcp-servers/weather/index.mjs"],
      "disabled": false
    }
  }
}
```

On next startup, `MCPServerManager.loadAndRegisterConfig()` will automatically detect, spawn, and query the new server during `connectAll()`.
