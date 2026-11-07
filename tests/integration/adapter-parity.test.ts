import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { MCPClient } from '@/lib/mcp/client';
import { ServerConfig } from '@/lib/router/types';
import { NotesAdapter } from '@/mcp-servers/notes/adapter';
import { TasksAdapter } from '@/mcp-servers/tasks/adapter';
import { CalculatorAdapter } from '@/mcp-servers/calculator/adapter';

describe('Task 4.2: Adapter Parity Tests (stdio vs in-process)', () => {
  const notesPath = path.resolve(process.cwd(), 'src', 'mcp-servers', 'notes', 'index.mjs');
  const tasksPath = path.resolve(process.cwd(), 'src', 'mcp-servers', 'tasks', 'index.mjs');
  const calcPath = path.resolve(process.cwd(), 'src', 'mcp-servers', 'calculator', 'index.mjs');

  describe('Notes Server Parity', () => {
    let client: MCPClient;
    let adapter: NotesAdapter;

    beforeEach(async () => {
      adapter = new NotesAdapter();
      const config: ServerConfig = {
        id: 'notes-stdio',
        name: 'Notes Stdio',
        transport: 'stdio',
        command: 'node',
        args: [notesPath],
      };
      client = new MCPClient(config);
      await client.connect();
    });

    afterEach(async () => {
      await client.disconnect();
      adapter.dispose();
    });

    it('exposes identical 5 tool schemas', async () => {
      const stdioTools = await client.listTools();
      const adapterTools = adapter.listTools();

      expect(stdioTools).toHaveLength(5);
      expect(adapterTools).toHaveLength(5);

      const stdioNames = stdioTools.map((t) => t.name).sort();
      const adapterNames = adapterTools.map((t) => t.name).sort();
      expect(stdioNames).toEqual(adapterNames);

      // Compare tool schemas
      for (const name of stdioNames) {
        const sTool = stdioTools.find((t) => t.name === name)!;
        const aTool = adapterTools.find((t) => t.name === name)!;
        expect(aTool.description).toBe(sTool.description);
        expect(aTool.inputSchema.type).toBe(sTool.inputSchema.type);
        expect(Object.keys(aTool.inputSchema.properties || {}).sort()).toEqual(
          Object.keys(sTool.inputSchema.properties || {}).sort()
        );
      }
    });

    it('produces matching note structures on create and list', async () => {
      // Create via stdio
      const stdioRes = (await client.callTool('create_note', {
        title: 'Parity Test Note Stdio',
        content: 'Testing stdio',
      })) as { content: Array<{ text: string }> };
      const stdioCreated = JSON.parse(stdioRes.content[0].text);
      expect(stdioCreated.id).toBeDefined();

      // Create via adapter
      const adapterCreated = await adapter.invokeTool('create_note', {
        title: 'Parity Test Note Adapter',
        content: 'Testing adapter',
      });
      expect(adapterCreated.id).toBeDefined();

      // List notes
      const stdioListRes = (await client.callTool('list_notes', {})) as {
        content: Array<{ text: string }>;
      };
      const stdioList = JSON.parse(stdioListRes.content[0].text).notes;
      const adapterList = await adapter.invokeTool('list_notes');

      expect(stdioList.length).toBeGreaterThanOrEqual(4);
      expect(adapterList.length).toBeGreaterThanOrEqual(4);

      // Both lists contain items with id and title
      expect(typeof stdioList[0].id).toBe('string');
      expect(typeof stdioList[0].title).toBe('string');
      expect(typeof adapterList[0].id).toBe('string');
      expect(typeof adapterList[0].title).toBe('string');
    });

    it('fails loud with error on non-existent note', async () => {
      await expect(client.callTool('read_note', { id: 'non_existent_note' })).rejects.toThrow();
      await expect(adapter.invokeTool('read_note', { id: 'non_existent_note' })).rejects.toThrow(
        "Note not found with id: 'non_existent_note'"
      );
    });
  }, 15000);

  describe('Tasks Server Parity', () => {
    let client: MCPClient;
    let adapter: TasksAdapter;

    beforeEach(async () => {
      adapter = new TasksAdapter();
      const config: ServerConfig = {
        id: 'tasks-stdio',
        name: 'Tasks Stdio',
        transport: 'stdio',
        command: 'node',
        args: [tasksPath],
      };
      client = new MCPClient(config);
      await client.connect();
    });

    afterEach(async () => {
      await client.disconnect();
      adapter.dispose();
    });

    it('exposes identical 5 tool schemas', async () => {
      const stdioTools = await client.listTools();
      const adapterTools = adapter.listTools();

      expect(stdioTools).toHaveLength(5);
      expect(adapterTools).toHaveLength(5);

      const stdioNames = stdioTools.map((t) => t.name).sort();
      const adapterNames = adapterTools.map((t) => t.name).sort();
      expect(stdioNames).toEqual(adapterNames);
    });

    it('produces matching task structures on create and list', async () => {
      // Create via stdio
      const stdioRes = (await client.callTool('create_task', {
        title: 'Parity Task Stdio',
        priority: 'high',
      })) as { content: Array<{ text: string }> };
      const stdioCreated = JSON.parse(stdioRes.content[0].text);
      expect(stdioCreated.id).toBeDefined();

      // Create via adapter
      const adapterCreated = await adapter.invokeTool('create_task', {
        title: 'Parity Task Adapter',
        priority: 'high',
      });
      expect(adapterCreated.id).toBeDefined();
      expect(adapterCreated.priority).toBe('high');
      expect(adapterCreated.completed).toBe(false);

      // List tasks
      const stdioListRes = (await client.callTool('list_tasks', {})) as {
        content: Array<{ text: string }>;
      };
      const stdioList = JSON.parse(stdioListRes.content[0].text).tasks;
      const adapterList = await adapter.invokeTool('list_tasks');

      expect(stdioList.length).toBeGreaterThanOrEqual(6);
      expect(adapterList.length).toBeGreaterThanOrEqual(6);
    });

    it('fails loud on non-existent task update', async () => {
      await expect(
        client.callTool('update_task', { id: 'non_existent_task', completed: true })
      ).rejects.toThrow();
      await expect(
        adapter.invokeTool('update_task', { id: 'non_existent_task', completed: true })
      ).rejects.toThrow("Cannot update: task not found with id: 'non_existent_task'");
    });
  }, 15000);

  describe('Calculator Server Parity', () => {
    let client: MCPClient;
    let adapter: CalculatorAdapter;

    beforeEach(async () => {
      adapter = new CalculatorAdapter();
      const config: ServerConfig = {
        id: 'calc-stdio',
        name: 'Calculator Stdio',
        transport: 'stdio',
        command: 'node',
        args: [calcPath],
      };
      client = new MCPClient(config);
      await client.connect();
    });

    afterEach(async () => {
      await client.disconnect();
      adapter.dispose();
    });

    it('exposes identical 5 tool schemas', async () => {
      const stdioTools = await client.listTools();
      const adapterTools = adapter.listTools();

      expect(stdioTools).toHaveLength(5);
      expect(adapterTools).toHaveLength(5);

      const stdioNames = stdioTools.map((t) => t.name).sort();
      const adapterNames = adapterTools.map((t) => t.name).sort();
      expect(stdioNames).toEqual(adapterNames);
    });

    it('produces identical results for arithmetic and unit conversions', async () => {
      // Add
      const sAdd = (await client.callTool('add', { a: 42, b: 58 })) as {
        content: Array<{ text: string }>;
      };
      const sAddVal = JSON.parse(sAdd.content[0].text).result;
      const aAddVal = (await adapter.invokeTool('add', { a: 42, b: 58 })).result;
      expect(sAddVal).toBe(100);
      expect(aAddVal).toBe(100);

      // Divide by zero error parity
      await expect(client.callTool('divide', { a: 10, b: 0 })).rejects.toThrow();
      await expect(adapter.invokeTool('divide', { a: 10, b: 0 })).rejects.toThrow(
        'Division by zero is not allowed'
      );

      // Unit conversion
      const sConv = (await client.callTool('convert_units', {
        value: 100,
        from: 'm',
        to: 'ft',
      })) as { content: Array<{ text: string }> };
      const sConvVal = JSON.parse(sConv.content[0].text).result;
      const aConvVal = (await adapter.invokeTool('convert_units', {
        value: 100,
        from: 'm',
        to: 'ft',
      })).result;
      expect(sConvVal).toBe(328.08399);
      expect(aConvVal).toBe(328.08399);
    });
  }, 15000);
});
