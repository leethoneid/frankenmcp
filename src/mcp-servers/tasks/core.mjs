/**
 * @file core.mjs
 * @description In-memory business logic for Tasks MCP server.
 * Shared between stdio server (index.mjs) and in-process adapter (adapter.ts).
 */

export const TASK_TOOLS = [
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

export class TasksCore {
  constructor() {
    this.tasks = new Map();
    this.idCounter = 6;
    this.loadFixtures();
  }

  /**
   * Seeds demo tasks fixture data with [DEMO] prefix.
   */
  loadFixtures() {
    this.tasks.clear();
    const fixtures = [
      {
        id: 'task-1',
        title: '[DEMO] Assemble server stitches and transports',
        priority: 'high',
        completed: true,
      },
      {
        id: 'task-2',
        title: '[DEMO] Secure lightning rod ground to rack',
        priority: 'high',
        completed: true,
      },
      {
        id: 'task-3',
        title: '[DEMO] Calibrate dynamic router TF-IDF matcher',
        priority: 'medium',
        completed: false,
      },
      {
        id: 'task-4',
        title: '[DEMO] Trim schema overhead in Monster Lab dashboard',
        priority: 'medium',
        completed: false,
      },
      {
        id: 'task-5',
        title: '[DEMO] Record hackathon demo video walkthrough',
        priority: 'low',
        completed: false,
      },
    ];

    for (const fixture of fixtures) {
      this.tasks.set(fixture.id, fixture);
    }
  }

  /**
   * Creates a new task.
   */
  createTask(title, priority = 'medium') {
    if (!title || typeof title !== 'string' || !title.trim()) {
      throw new Error('create_task requires non-empty string parameter: title');
    }
    const validatedPriority = ['low', 'medium', 'high'].includes(priority) ? priority : 'medium';
    const id = `task-${this.idCounter++}`;
    const task = {
      id,
      title: title.trim(),
      priority: validatedPriority,
      completed: false,
    };
    this.tasks.set(id, task);
    return task;
  }

  /**
   * Reads task by ID.
   */
  readTask(id) {
    if (!id || typeof id !== 'string') {
      throw new Error('read_task requires parameter: id');
    }
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task not found with id: '${id}'`);
    }
    return task;
  }

  /**
   * Updates properties of an existing task.
   */
  updateTask(id, titleOrUpdates, maybePriority, maybeCompleted) {
    if (!id || typeof id !== 'string') {
      throw new Error('update_task requires parameter: id');
    }
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Cannot update: task not found with id: '${id}'`);
    }

    let title;
    let priority;
    let completed;

    if (typeof titleOrUpdates === 'object' && titleOrUpdates !== null) {
      title = titleOrUpdates.title;
      priority = titleOrUpdates.priority;
      completed = titleOrUpdates.completed;
    } else {
      title = titleOrUpdates;
      priority = maybePriority;
      completed = maybeCompleted;
    }

    if (typeof title === 'string' && title.trim()) {
      task.title = title.trim();
    }
    if (['low', 'medium', 'high'].includes(priority)) {
      task.priority = priority;
    }
    if (typeof completed === 'boolean') {
      task.completed = completed;
    }

    return task;
  }

  /**
   * Deletes task by ID.
   */
  deleteTask(id) {
    if (!id || typeof id !== 'string') {
      throw new Error('delete_task requires parameter: id');
    }
    if (!this.tasks.has(id)) {
      throw new Error(`Cannot delete: task not found with id: '${id}'`);
    }
    this.tasks.delete(id);
    return { success: true };
  }

  /**
   * Lists tasks, optionally filtered by completion status.
   */
  listTasks(filter) {
    let list = Array.from(this.tasks.values());
    const filterCompleted = filter?.completed;
    if (typeof filterCompleted === 'boolean') {
      list = list.filter((t) => t.completed === filterCompleted);
    }
    return list;
  }
}
