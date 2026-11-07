import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TasksCore, TASK_TOOLS } from './core.mjs';

/**
 * Tasks Demo MCP Server
 * Zero-config local tasks management with priority and completion tracking.
 */

const core = new TasksCore();

const server = new Server(
  {
    name: 'tasks-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TASK_TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'create_task': {
      const task = core.createTask(args?.title, args?.priority);
      return {
        content: [{ type: 'text', text: JSON.stringify({ id: task.id }) }],
      };
    }

    case 'read_task': {
      const task = core.readTask(args?.id);
      return {
        content: [{ type: 'text', text: JSON.stringify(task) }],
      };
    }

    case 'update_task': {
      const task = core.updateTask(args?.id, args?.title, args?.priority, args?.completed);
      return {
        content: [{ type: 'text', text: JSON.stringify({ id: task.id }) }],
      };
    }

    case 'delete_task': {
      const res = core.deleteTask(args?.id);
      return {
        content: [{ type: 'text', text: JSON.stringify(res) }],
      };
    }

    case 'list_tasks': {
      const list = core.listTasks(args?.filter);
      return {
        content: [{ type: 'text', text: JSON.stringify({ tasks: list }) }],
      };
    }

    default:
      throw new Error(`Unknown tool: '${name}'`);
  }
});

// Auto-connect to stdio when executed directly
const transport = new StdioServerTransport();
await server.connect(transport);
