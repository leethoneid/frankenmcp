import { describe, it, expect } from 'vitest';
import { CalculatorCore, CALCULATOR_TOOLS } from '@/mcp-servers/calculator/core.mjs';
import { CalculatorAdapter } from '@/mcp-servers/calculator/adapter';

describe('Task 2.3: Calculator Core & In-Process Adapter', () => {
  describe('CalculatorCore arithmetic and unit conversions', () => {
    it('performs basic arithmetic operations accurately', () => {
      const core = new CalculatorCore();

      expect(core.add(42, 58)).toBe(100);
      expect(core.subtract(100, 35)).toBe(65);
      expect(core.multiply(12, 8)).toBe(96);
      expect(core.divide(100, 4)).toBe(25);
    });

    it('throws on division by zero', () => {
      const core = new CalculatorCore();

      expect(() => core.divide(42, 0)).toThrow('Division by zero is not allowed');
    });

    it('performs unit conversions accurately across length, weight, and temperature', () => {
      const core = new CalculatorCore();

      // Temperature
      expect(core.convertUnits(0, 'C', 'F')).toBe(32);
      expect(core.convertUnits(100, 'C', 'F')).toBe(212);
      expect(core.convertUnits(32, 'F', 'C')).toBe(0);

      // Length
      expect(core.convertUnits(1, 'm', 'ft')).toBe(3.28084);
      expect(core.convertUnits(12, 'in', 'ft')).toBe(1);

      // Weight
      expect(core.convertUnits(1, 'kg', 'lb')).toBe(2.204623);
      expect(core.convertUnits(2.204623, 'lb', 'kg')).toBe(1);
    });

    it('fails loud on non-numeric parameters or incompatible units', () => {
      const core = new CalculatorCore();

      expect(() => (core as any).add('a', 1)).toThrow("Parameter 'a' must be a valid number");
      expect(() => (core as any).convertUnits('abc', 'm', 'ft')).toThrow("Parameter 'value' must be a valid number");
      expect(() => (core as any).convertUnits(100, 'm', 'kg')).toThrow(/Incompatible or unsupported unit conversion/);
    });
  });

  describe('CalculatorAdapter and Parity', () => {
    it('implements InProcessMCPAdapter and listTools matches stdio CALCULATOR_TOOLS exactly', () => {
      const adapter = new CalculatorAdapter();

      expect(adapter.serverID).toBe('calculator');
      expect(adapter.name).toBe('Calculator Server');

      const tools = adapter.listTools();
      expect(tools).toHaveLength(5);
      expect(tools).toEqual(CALCULATOR_TOOLS);
    });

    it('invokes tools directly in-process via invokeTool', async () => {
      const adapter = new CalculatorAdapter();

      // add
      const addRes = await adapter.invokeTool('add', { a: 10, b: 25 });
      expect(addRes).toEqual({ result: 35 });

      // subtract
      const subRes = await adapter.invokeTool('subtract', { a: 50, b: 20 });
      expect(subRes).toEqual({ result: 30 });

      // multiply
      const mulRes = await adapter.invokeTool('multiply', { a: 6, b: 7 });
      expect(mulRes).toEqual({ result: 42 });

      // divide
      const divRes = await adapter.invokeTool('divide', { a: 80, b: 4 });
      expect(divRes).toEqual({ result: 20 });

      // convert_units
      const convRes = await adapter.invokeTool('convert_units', { value: 100, from: 'm', to: 'ft' });
      expect(convRes).toEqual({ result: 328.08399 });

      // unknown tool
      await expect(adapter.invokeTool('unknown_tool')).rejects.toThrow("Unknown tool: 'unknown_tool'");
    });
  });
});
