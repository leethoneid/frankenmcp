import { describe, it, expect } from 'vitest';
import path from 'path';
import { MCPClient } from '@/lib/mcp/client';
import { ServerConfig, ToolInvocationError } from '@/lib/router/types';

describe('Phase 5 - Demo MCP Servers Unit Tests', () => {
  const notesPath = path.resolve(process.cwd(), 'src', 'mcp-servers', 'notes', 'index.mjs');
  const tasksPath = path.resolve(process.cwd(), 'src', 'mcp-servers', 'tasks', 'index.mjs');
  const calcPath = path.resolve(process.cwd(), 'src', 'mcp-servers', 'calculator', 'index.mjs');

  describe('Task 5.1: Notes Server', () => {
    const config: ServerConfig = {
      id: 'notes-test',
      name: 'Notes Server',
      transport: 'stdio',
      command: 'node',
      args: [notesPath],
    };

    it('exposes 5 tools and contains 3 [DEMO] fixtures', async () => {
      const client = new MCPClient(config);
      await client.connect();

      const tools = await client.listTools();
      expect(tools).toHaveLength(5);
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toEqual(
        expect.arrayContaining(['create_note', 'read_note', 'update_note', 'delete_note', 'list_notes'])
      );

      // Verify list_notes returns fixtures with [DEMO] tag
      const listRes = (await client.callTool('list_notes', {})) as { content: Array<{ text: string }> };
      const parsedList = JSON.parse(listRes.content[0].text);
      expect(parsedList.notes.length).toBeGreaterThanOrEqual(3);

      const readRes = (await client.callTool('read_note', { id: 'note-1' })) as { content: Array<{ text: string }> };
      const note1 = JSON.parse(readRes.content[0].text);
      expect(note1.title).toBe('[DEMO] Project Kickoff');
      expect(note1.content).toContain('[DEMO]');

      await client.disconnect();
    });

    it('performs CRUD operations and handles error cases', async () => {
      const client = new MCPClient(config);
      await client.connect();

      // Create
      const createRes = (await client.callTool('create_note', {
        title: 'New Experiment',
        content: '[DEMO] Lab notes',
      })) as { content: Array<{ text: string }> };
      const created = JSON.parse(createRes.content[0].text);
      expect(created.id).toBeDefined();

      // Read
      const readRes = (await client.callTool('read_note', { id: created.id })) as { content: Array<{ text: string }> };
      const note = JSON.parse(readRes.content[0].text);
      expect(note.title).toBe('New Experiment');

      // Update
      await client.callTool('update_note', { id: created.id, title: 'Updated Experiment' });
      const readUpdated = (await client.callTool('read_note', { id: created.id })) as { content: Array<{ text: string }> };
      expect(JSON.parse(readUpdated.content[0].text).title).toBe('Updated Experiment');

      // Delete
      const delRes = (await client.callTool('delete_note', { id: created.id })) as { content: Array<{ text: string }> };
      expect(JSON.parse(delRes.content[0].text).success).toBe(true);

      // Fail loud on non-existent note
      await expect(client.callTool('read_note', { id: 'non_existent_id' })).rejects.toThrow(ToolInvocationError);

      await client.disconnect();
    });
  });

  describe('Task 5.2: Tasks Server', () => {
    const config: ServerConfig = {
      id: 'tasks-test',
      name: 'Tasks Server',
      transport: 'stdio',
      command: 'node',
      args: [tasksPath],
    };

    it('exposes 5 tools and contains 5 [DEMO] fixtures with completion filter', async () => {
      const client = new MCPClient(config);
      await client.connect();

      const tools = await client.listTools();
      expect(tools).toHaveLength(5);

      const listRes = (await client.callTool('list_tasks', {})) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(listRes.content[0].text);
      expect(parsed.tasks).toHaveLength(5);
      expect(parsed.tasks.every((t: { title: string }) => t.title.includes('[DEMO]'))).toBe(true);

      // Filter by completed: true
      const compRes = (await client.callTool('list_tasks', { filter: { completed: true } })) as {
        content: Array<{ text: string }>;
      };
      const compTasks = JSON.parse(compRes.content[0].text).tasks;
      expect(compTasks.length).toBeGreaterThan(0);
      expect(compTasks.every((t: { completed: boolean }) => t.completed === true)).toBe(true);

      await client.disconnect();
    });

    it('supports task creation, state toggling, and fails loud on invalid id', async () => {
      const client = new MCPClient(config);
      await client.connect();

      // Create task
      const createRes = (await client.callTool('create_task', {
        title: '[DEMO] High voltage test',
        priority: 'high',
      })) as { content: Array<{ text: string }> };
      const taskId = JSON.parse(createRes.content[0].text).id;

      // Update to completed
      await client.callTool('update_task', { id: taskId, completed: true });
      const readRes = (await client.callTool('read_task', { id: taskId })) as { content: Array<{ text: string }> };
      const task = JSON.parse(readRes.content[0].text);
      expect(task.completed).toBe(true);
      expect(task.priority).toBe('high');

      // Invalid ID
      await expect(client.callTool('read_task', { id: 'invalid_task_999' })).rejects.toThrow(ToolInvocationError);

      await client.disconnect();
    });
  });

  describe('Task 5.3: Calculator Server', () => {
    const config: ServerConfig = {
      id: 'calc-test',
      name: 'Calculator Server',
      transport: 'stdio',
      command: 'node',
      args: [calcPath],
    };

    it('performs basic arithmetic operations', async () => {
      const client = new MCPClient(config);
      await client.connect();

      const addRes = (await client.callTool('add', { a: 15, b: 27 })) as { content: Array<{ text: string }> };
      expect(JSON.parse(addRes.content[0].text).result).toBe(42);

      const subRes = (await client.callTool('subtract', { a: 50, b: 8 })) as { content: Array<{ text: string }> };
      expect(JSON.parse(subRes.content[0].text).result).toBe(42);

      const mulRes = (await client.callTool('multiply', { a: 6, b: 7 })) as { content: Array<{ text: string }> };
      expect(JSON.parse(mulRes.content[0].text).result).toBe(42);

      const divRes = (await client.callTool('divide', { a: 84, b: 2 })) as { content: Array<{ text: string }> };
      expect(JSON.parse(divRes.content[0].text).result).toBe(42);

      // Divide by zero error
      await expect(client.callTool('divide', { a: 10, b: 0 })).rejects.toThrow(ToolInvocationError);

      await client.disconnect();
    });

    it('performs unit conversions across length, weight, and temperature', async () => {
      const client = new MCPClient(config);
      await client.connect();

      // Length: 1 meter to feet
      const lenRes = (await client.callTool('convert_units', { value: 1, from: 'm', to: 'ft' })) as {
        content: Array<{ text: string }>;
      };
      const lenVal = JSON.parse(lenRes.content[0].text).result;
      expect(lenVal).toBeCloseTo(3.28084, 2);

      // Weight: 1 kg to lb
      const wtRes = (await client.callTool('convert_units', { value: 1, from: 'kg', to: 'lb' })) as {
        content: Array<{ text: string }>;
      };
      const wtVal = JSON.parse(wtRes.content[0].text).result;
      expect(wtVal).toBeCloseTo(2.20462, 2);

      // Temperature: 100 C to F
      const tempRes = (await client.callTool('convert_units', { value: 100, from: 'C', to: 'F' })) as {
        content: Array<{ text: string }>;
      };
      expect(JSON.parse(tempRes.content[0].text).result).toBe(212);

      // Incompatible conversion
      await expect(
        client.callTool('convert_units', { value: 10, from: 'm', to: 'kg' })
      ).rejects.toThrow(ToolInvocationError);

      await client.disconnect();
    });
  });
});
