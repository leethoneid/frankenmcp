import { describe, it, expect } from 'vitest';
import { TasksCore, TASK_TOOLS } from '@/mcp-servers/tasks/core.mjs';
import { TasksAdapter } from '@/mcp-servers/tasks/adapter';

describe('Task 2.2: Tasks Core & In-Process Adapter', () => {
  describe('TasksCore logic and fixtures', () => {
    it('loads 5 fixtures automatically on initialization with [DEMO] tag', () => {
      const core = new TasksCore();
      const tasks = core.listTasks();

      expect(tasks).toHaveLength(5);
      for (const task of tasks) {
        expect(task.title).toContain('[DEMO]');
        expect(['low', 'medium', 'high']).toContain(task.priority);
        expect(typeof task.completed).toBe('boolean');
      }
    });

    it('creates task with default priority medium when not specified', () => {
      const core = new TasksCore();
      const task = core.createTask('Calibrate galvanometer');

      expect(task.id).toMatch(/^task-\d+$/);
      expect(task.title).toBe('Calibrate galvanometer');
      expect(task.priority).toBe('medium');
      expect(task.completed).toBe(false);

      const all = core.listTasks();
      expect(all).toHaveLength(6);
      expect(all.find((t) => t.id === task.id)).toBeDefined();
    });

    it('creates task with explicit priority', () => {
      const core = new TasksCore();
      const task = core.createTask('Critical voltage test', 'high');

      expect(task.priority).toBe('high');
    });

    it('updates task properties and toggles completion', () => {
      const core = new TasksCore();

      // Read task-3
      const task3 = core.readTask('task-3');
      expect(task3.completed).toBe(false);

      // Mark completed
      const updated = core.updateTask('task-3', { completed: true, priority: 'high' });
      expect(updated.completed).toBe(true);
      expect(updated.priority).toBe('high');

      // Verify persistence in core
      const reRead = core.readTask('task-3');
      expect(reRead.completed).toBe(true);
      expect(reRead.priority).toBe('high');
    });

    it('filters tasks by completed status', () => {
      const core = new TasksCore();

      const completedTasks = core.listTasks({ completed: true });
      expect(completedTasks.length).toBeGreaterThan(0);
      expect(completedTasks.every((t) => t.completed === true)).toBe(true);

      const incompleteTasks = core.listTasks({ completed: false });
      expect(incompleteTasks.length).toBeGreaterThan(0);
      expect(incompleteTasks.every((t) => t.completed === false)).toBe(true);
    });

    it('deletes tasks and throws when deleting or reading non-existent task', () => {
      const core = new TasksCore();

      const delRes = core.deleteTask('task-1');
      expect(delRes.success).toBe(true);
      expect(() => core.readTask('task-1')).toThrow("Task not found with id: 'task-1'");
      expect(() => core.deleteTask('task-1')).toThrow("Cannot delete: task not found with id: 'task-1'");
    });

    it('fails loud on empty or invalid inputs', () => {
      const core = new TasksCore();

      expect(() => (core as any).createTask('')).toThrow(/requires non-empty string parameter: title/);
      expect(() => (core as any).readTask('')).toThrow(/requires parameter: id/);
      expect(() => (core as any).updateTask('')).toThrow(/requires parameter: id/);
      expect(() => (core as any).updateTask('non-existent', { completed: true })).toThrow(/Cannot update: task not found/);
    });
  });

  describe('TasksAdapter and Parity', () => {
    it('implements InProcessMCPAdapter and listTools matches stdio TASK_TOOLS exactly', () => {
      const adapter = new TasksAdapter();

      expect(adapter.serverID).toBe('tasks');
      expect(adapter.name).toBe('Tasks Server');

      const tools = adapter.listTools();
      expect(tools).toHaveLength(5);
      expect(tools).toEqual(TASK_TOOLS);
    });

    it('invokes tools directly in-process via invokeTool', async () => {
      const adapter = new TasksAdapter();

      // list_tasks
      const initialTasks = await adapter.invokeTool('list_tasks');
      expect(initialTasks).toHaveLength(5);

      // create_task
      const created = await adapter.invokeTool('create_task', {
        title: 'Adapter Task',
        priority: 'high',
      });
      expect(created.id).toBeDefined();

      // read_task
      const read = await adapter.invokeTool('read_task', { id: created.id });
      expect(read.title).toBe('Adapter Task');
      expect(read.priority).toBe('high');

      // update_task
      const updated = await adapter.invokeTool('update_task', {
        id: created.id,
        completed: true,
      });
      expect(updated.completed).toBe(true);

      // delete_task
      const deleted = await adapter.invokeTool('delete_task', { id: created.id });
      expect(deleted.success).toBe(true);

      // unknown tool
      await expect(adapter.invokeTool('unknown_tool')).rejects.toThrow("Unknown tool: 'unknown_tool'");
    });
  });
});
