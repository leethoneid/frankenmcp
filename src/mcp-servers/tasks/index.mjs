import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

/**
 * Tasks Demo MCP Server
 * Zero-config local tasks management with priority and completion tracking.
 */

// In-memory task storage
const tasks = new Map();

// 5 Pre-populated demo fixtures with [DEMO] marker
tasks.set('task-1', {
  id: 'task-1',
  title: '[DEMO] Assemble server stitches and transports',
  priority: 'high',
  completed: true,
});
tasks.set('task-2', {
  id: 'task-2',
  title: '[DEMO] Secure lightning rod ground to rack',
  priority: 'high',
  completed: true,
});
tasks.set('task-3', {
  id: 'task-3',
  title: '[DEMO] Calibrate dynamic router TF-IDF matcher',
  priority: 'medium',
  completed: false,
});
tasks.set('task-4', {
  id: 'task-4',
  title: '[DEMO] Trim schema overhead in Monster Lab dashboard',
  priority: 'medium',
  completed: false,
});
tasks.set('task-5', {
  id: 'task-5',
  title: '[DEMO] Record hackathon demo video walkthrough',
  priority: 'low',
  completed: false,
});

let idCounter = 6;

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

const TASK_TOOLS = [
  {
    name: 'create_task',
    description: 'Create a new task with title and optional priority',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the task' },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Task priority level (defaults to medium)',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'read_task',
    description: 'Get task details by task ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique task identifier' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_task',
    description: 'Update properties (title, priority, completed) of an existing task',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the task to update' },
        title: { type: 'string', description: 'New task title (optional)' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'New priority (optional)' },
        completed: { type: 'boolean', description: 'Completion status (optional)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a task by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the task to delete' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List all tasks, optionally filtering by completion status',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'object',
          properties: {
            completed: { type: 'boolean', description: 'Filter by completed status' },
          },
        },
      },
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TASK_TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'create_task': {
      if (!args || typeof args.title !== 'string' || !args.title.trim()) {
        throw new Error('create_task requires non-empty string parameter: title');
      }
      const priority = ['low', 'medium', 'high'].includes(args.priority) ? args.priority : 'medium';
      const id = `task-${idCounter++}`;
      tasks.set(id, {
        id,
        title: args.title.trim(),
        priority,
        completed: false,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify({ id }) }],
      };
    }

    case 'read_task': {
      if (!args || typeof args.id !== 'string') {
        throw new Error('read_task requires parameter: id');
      }
      const task = tasks.get(args.id);
      if (!task) {
        throw new Error(`Task not found with id: '${args.id}'`);
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(task) }],
      };
    }

    case 'update_task': {
      if (!args || typeof args.id !== 'string') {
        throw new Error('update_task requires parameter: id');
      }
      const task = tasks.get(args.id);
      if (!task) {
        throw new Error(`Cannot update: task not found with id: '${args.id}'`);
      }
      if (typeof args.title === 'string' && args.title.trim()) {
        task.title = args.title.trim();
      }
      if (['low', 'medium', 'high'].includes(args.priority)) {
        task.priority = args.priority;
      }
      if (typeof args.completed === 'boolean') {
        task.completed = args.completed;
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ id: task.id }) }],
      };
    }

    case 'delete_task': {
      if (!args || typeof args.id !== 'string') {
        throw new Error('delete_task requires parameter: id');
      }
      if (!tasks.has(args.id)) {
        throw new Error(`Cannot delete: task not found with id: '${args.id}'`);
      }
      tasks.delete(args.id);
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
      };
    }

    case 'list_tasks': {
      let list = Array.from(tasks.values());
      const filterCompleted = args?.filter?.completed;
      if (typeof filterCompleted === 'boolean') {
        list = list.filter((t) => t.completed === filterCompleted);
      }
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
