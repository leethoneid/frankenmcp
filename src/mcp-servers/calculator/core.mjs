/**
 * @file core.mjs
 * @description Stateless mathematical operations and unit conversions for Calculator MCP server.
 * Shared between stdio server (index.mjs) and in-process adapter (adapter.ts).
 */

export const LENGTH_FACTORS = {
  m: 1,
  ft: 0.3048,
  in: 0.0254,
};

export const WEIGHT_FACTORS = {
  kg: 1,
  lb: 0.45359237,
};

export const CALCULATOR_TOOLS = [
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

function assertNumeric(val, paramName) {
  if (typeof val !== 'number' || isNaN(val)) {
    throw new Error(`Parameter '${paramName}' must be a valid number`);
  }
}

export class CalculatorCore {
  /**
   * Adds two numbers.
   */
  add(a, b) {
    assertNumeric(a, 'a');
    assertNumeric(b, 'b');
    return a + b;
  }

  /**
   * Subtracts b from a.
   */
  subtract(a, b) {
    assertNumeric(a, 'a');
    assertNumeric(b, 'b');
    return a - b;
  }

  /**
   * Multiplies two numbers.
   */
  multiply(a, b) {
    assertNumeric(a, 'a');
    assertNumeric(b, 'b');
    return a * b;
  }

  /**
   * Divides a by b.
   * @throws Error on division by zero.
   */
  divide(a, b) {
    assertNumeric(a, 'a');
    assertNumeric(b, 'b');
    if (b === 0) {
      throw new Error('Division by zero is not allowed');
    }
    return a / b;
  }

  /**
   * Converts value between units across length (m, ft, in), weight (kg, lb), and temperature (C, F).
   */
  convertUnits(value, from, to) {
    assertNumeric(value, 'value');
    if (typeof from !== 'string' || typeof to !== 'string') {
      throw new Error("convert_units requires string parameters: 'from' and 'to'");
    }

    const cleanFrom = from.trim();
    const cleanTo = to.trim();

    // Length conversion
    if (LENGTH_FACTORS[cleanFrom] !== undefined && LENGTH_FACTORS[cleanTo] !== undefined) {
      const inMeters = value * LENGTH_FACTORS[cleanFrom];
      const result = inMeters / LENGTH_FACTORS[cleanTo];
      return Number(result.toFixed(6));
    }

    // Weight conversion
    if (WEIGHT_FACTORS[cleanFrom] !== undefined && WEIGHT_FACTORS[cleanTo] !== undefined) {
      const inKg = value * WEIGHT_FACTORS[cleanFrom];
      const result = inKg / WEIGHT_FACTORS[cleanTo];
      return Number(result.toFixed(6));
    }

    // Temperature conversion
    if (['C', 'F'].includes(cleanFrom) && ['C', 'F'].includes(cleanTo)) {
      let result = value;
      if (cleanFrom === 'C' && cleanTo === 'F') {
        result = (value * 9) / 5 + 32;
      } else if (cleanFrom === 'F' && cleanTo === 'C') {
        result = ((value - 32) * 5) / 9;
      }
      return Number(result.toFixed(6));
    }

    throw new Error(`Incompatible or unsupported unit conversion from '${from}' to '${to}'`);
  }
}
