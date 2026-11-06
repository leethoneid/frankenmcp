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

    // Other task tools (toggle_task, delete_task) require explicit task IDs
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

    return null;
  }

  return null;
}
