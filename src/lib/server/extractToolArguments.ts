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
    // 四则运算（add/subtract/multiply/divide）：
    // 不再按运算符符号或单词匹配，按书写顺序取查询里的前两个数字作为 a、b
    if (['add', 'subtract', 'multiply', 'divide'].includes(toolName)) {
      const matches = trimmedQuery.match(/\d+(?:\.\d+)?/g);
      if (matches && matches.length >= 2) {
        let a = parseFloat(matches[0]);
        const b = parseFloat(matches[1]);
        if (trimmedQuery.trim().startsWith('-')) {
          a = -Math.abs(a);
        }
        // FR-3.2a："subtract X from Y" 表示 Y - X，需交换书写顺序
        if (
          toolName === 'subtract' &&
          /subtract\s+\d+(?:\.\d+)?\s+from\s+\d+(?:\.\d+)?/i.test(trimmedQuery)
        ) {
          return { a: b, b: a };
        }
        if (!isNaN(a) && !isNaN(b)) {
          return { a, b };
        }
      }
      return null;
    }

    // convert_units：
    // 取查询里的第一个数字 + 按顺序出现的前两个可识别单位，连接词不再限定 to/into/in
    if (toolName === 'convert_units') {
      const numMatch = trimmedQuery.match(/-?\d+(?:\.\d+)?/);
      if (!numMatch) {
        return null;
      }
      const val = parseFloat(numMatch[0]);
      if (isNaN(val)) {
        return null;
      }

      // 按顺序提取前两个可识别的单位
      const unitMatches = trimmedQuery.match(
        /(?:千克|公斤|摄氏度|华氏度|英尺|英寸|厘米|毫米|米|磅|meters?|feet|foot|ft|inches?|kilograms?|kg|pounds?|lbs?|celsius|fahrenheit|\b[CFcf]\b)/gi
      );

      if (unitMatches && unitMatches.length >= 2) {
        const fromUnit = normalizeUnit(unitMatches[0]);
        const toUnit = normalizeUnit(unitMatches[1]);
        if (fromUnit && toUnit) {
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
  if (!unitStr) return null;
  const raw = unitStr.trim();
  const lower = raw.toLowerCase();

  // Unsupported units (cm/mm) explicitly return null to fail loud rather than mis-mapping to meters
  if (['厘米', '毫米'].includes(raw)) return null;

  // Chinese mappings
  if (raw === '米') return 'm';
  if (raw === '英尺') return 'ft';
  if (raw === '英寸') return 'in';
  if (['千克', '公斤'].includes(raw)) return 'kg';
  if (raw === '磅') return 'lb';
  if (['摄氏度', '摄氏'].includes(raw)) return 'C';
  if (['华氏度', '华氏'].includes(raw)) return 'F';

  // English mappings
  const u = lower.replace(/[^a-z°]/g, '');
  if (['m', 'meter', 'meters'].includes(u)) return 'm';
  if (['ft', 'foot', 'feet'].includes(u)) return 'ft';
  if (['in', 'inch', 'inches'].includes(u)) return 'in';
  if (['kg', 'kilogram', 'kilograms'].includes(u)) return 'kg';
  if (['lb', 'lbs', 'pound', 'pounds'].includes(u)) return 'lb';
  if (['c', 'celsius'].includes(u)) return 'C';
  if (['f', 'fahrenheit'].includes(u)) return 'F';
  return null;
}
