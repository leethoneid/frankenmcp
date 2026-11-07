/**
 * @file extractToolArguments.ts
 * @description Argument derivation module for demo MCP servers.
 * Uses deterministic regex patterns to extract strongly-typed tool arguments from natural language queries.
 */

/**
 * Extracts tool arguments from a user query for pre-configured demo tools.
 * Returns null if no recognized pattern matches the query or if manual argument entry is needed.
 *
 * @param query The natural language user query
 * @param toolName The name of the routed tool
 * @param serverID The identifier of the server providing the tool
 * @returns Argument dictionary or null if extraction fails
 */
export function extractToolArguments(
  query: string,
  toolName: string,
  serverID: string
): Record<string, any> | null {
  if (!query || typeof query !== 'string') {
    return null;
  }

  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0) {
    return null;
  }

  // 1. Notes Server Patterns
  if (serverID === 'notes') {
    if (toolName === 'create_note') {
      const match = trimmedQuery.match(/(?:add|create)\s+(?:a\s+)?note(?:\s+(?:about|titled))?\s+(.+)/i);
      if (match && match[1].trim()) {
        const content = match[1].trim();
        return { title: content, content };
      }
      return null;
    }

    if (toolName === 'list_notes') {
      return {};
    }

    // Other note tools (read_note, update_note, delete_note) require explicit note IDs not derivable from query
    return null;
  }

  // 2. Tasks Server Patterns
  if (serverID === 'tasks') {
    if (toolName === 'create_task') {
      const match = trimmedQuery.match(/(?:add|create)\s+(?:a\s+)?task\s+(.+)/i);
      if (match && match[1].trim()) {
        const title = match[1].trim();
        return { title, priority: 'medium' };
      }
      return null;
    }

    if (toolName === 'list_tasks') {
      return {};
    }

    if (toolName === 'update_task') {
      const match = trimmedQuery.match(/(?:mark|set)?\s*(?:task\s+)?([a-zA-Z0-9_-]+)\s*(?:as\s+)?(?:done|complete|completed)/i) ||
                    trimmedQuery.match(/(?:complete|finish)\s+(?:task\s+)?([a-zA-Z0-9_-]+)/i);
      if (match && match[1].trim()) {
        const rawId = match[1].trim();
        if (!isValidTaskId(rawId)) {
          return null;
        }
        const id = rawId.startsWith('task-') ? rawId : `task-${rawId}`;
        return { id, completed: true };
      }
      return null;
    }

    // Other task tools (read_task, delete_task) require explicit task IDs
    return null;
  }

  // 3. Calculator Server Patterns
  if (serverID === 'calculator') {
    if (toolName === 'add') {
      const match = trimmedQuery.match(/(?:^|[^\d.-])(-?\d+(?:\.\d+)?)\s*\+\s*(-?\d+(?:\.\d+)?)/);
      if (match) {
        return { a: parseFloat(match[1]), b: parseFloat(match[2]) };
      }
      return null;
    }

    if (toolName === 'subtract') {
      const match = trimmedQuery.match(/(?:^|[^\d.-])(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
      if (match) {
        return { a: parseFloat(match[1]), b: parseFloat(match[2]) };
      }
      return null;
    }

    if (toolName === 'multiply') {
      const match = trimmedQuery.match(/(?:^|[^\d.-])(-?\d+(?:\.\d+)?)\s*[*×]\s*(-?\d+(?:\.\d+)?)/);
      if (match) {
        return { a: parseFloat(match[1]), b: parseFloat(match[2]) };
      }
      return null;
    }

    if (toolName === 'divide') {
      const match = trimmedQuery.match(/(?:^|[^\d.-])(-?\d+(?:\.\d+)?)\s*[/÷]\s*(-?\d+(?:\.\d+)?)/);
      if (match) {
        return { a: parseFloat(match[1]), b: parseFloat(match[2]) };
      }
      return null;
    }

    if (toolName === 'convert_units') {
      const match = trimmedQuery.match(/(?:convert\s+)?(-?\d+(?:\.\d+)?)\s*([a-zA-Z°]+)\s+(?:to|into|in)\s+([a-zA-Z°]+)/i);
      if (match) {
        const val = parseFloat(match[1]);
        const fromUnit = normalizeUnit(match[2]);
        const toUnit = normalizeUnit(match[3]);
        if (!isNaN(val) && fromUnit && toUnit) {
          return { value: val, from: fromUnit, to: toUnit };
        }
      }
      return null;
    }

    return null;
  }

  return null;
}

/**
 * Validates whether an extracted string candidate matches a valid task ID shape.
 * Rejects common English connector words that regex might capture when task ID is omitted.
 */
function isValidTaskId(id: string): boolean {
  if (!id) return false;
  const lower = id.toLowerCase().trim();
  if (['as', 'a', 'the', 'it', 'this', 'that', 'all', 'done', 'complete', 'completed', 'task'].includes(lower)) {
    return false;
  }
  return /^task-[\w-]+$/i.test(lower) || /\d/.test(lower);
}

/**
 * Normalizes user-entered unit strings into canonical MCP calculator unit identifiers:
 * - Length: 'm', 'ft', 'in'
 * - Weight: 'kg', 'lb'
 * - Temperature: 'C', 'F'
 */
function normalizeUnit(unitStr: string): string | null {
  const u = unitStr.toLowerCase().replace(/[^a-z]/g, '');
  if (['m', 'meter', 'meters'].includes(u)) return 'm';
  if (['ft', 'foot', 'feet'].includes(u)) return 'ft';
  if (['in', 'inch', 'inches'].includes(u)) return 'in';
  if (['kg', 'kilogram', 'kilograms'].includes(u)) return 'kg';
  if (['lb', 'lbs', 'pound', 'pounds'].includes(u)) return 'lb';
  if (['c', 'celsius'].includes(u)) return 'C';
  if (['f', 'fahrenheit'].includes(u)) return 'F';
  return null;
}
