/**
 * @file fallback.ts
 * @description Fast in-process rule-based routing fallback for Vercel Serverless environment.
 * Evaluates user intent against regex and keyword patterns when running on Vercel
 * or when the external dynamic router subprocess is unavailable.
 */

import type { SearchResult, ServerManifest } from './types';

/**
 * Evaluates whether a user query matches any recognized domain keywords or patterns.
 * Returns false if the query falls through to the default all-server fallback.
 */
export function hasRecognizedIntent(intent: string): boolean {
  const lower = (intent || '').toLowerCase().trim();

  // Notes domain
  if (/note|笔记/i.test(lower)) {
    return true;
  }

  // Tasks domain
  if (/task|todo|任务|待办/i.test(lower)) {
    return true;
  }

  // Calculator domain
  if (
    /\d+\s*[+\-*/×÷=加减乘除]\s*\d+/.test(lower) ||
    /(\d+)\s*(plus|minus|times|divided by|and|\+|-|\*|\/|加|减|乘|除以?)\s*(\d+)/i.test(lower) ||
    /\b(calc(ulate|ulator)?|math|arithmetic|convert|conversion|celsius|fahrenheit|meters?|feet|inches|cm|kg|pounds?)\b/i.test(lower) ||
    /(米|英尺|英寸|千克|公斤|磅|摄氏度|华氏度|换算|计算)/i.test(lower) ||
    /\b(add|sum|multiply|divide|subtract)\s+\d+/i.test(lower)
  ) {
    return true;
  }

  return false;
}

/**
 * Keyword-based router fallback function.
 * Matches natural language intent against server domains.
 *
 * Pattern matching rules (Task 1.4):
 * - "note" / "notes" -> ['notes']
 * - "task" / "tasks" / "todo" -> ['tasks']
 * - Numbers / arithmetic operators / math -> ['calculator']
 * - No match -> ['notes', 'tasks', 'calculator'] (all servers)
 *
 * @param intent The natural language query from the user.
 * @returns Array of server IDs selected for this intent.
 */
export function simplifiedRoute(intent: string): string[] {
  const lower = (intent || '').toLowerCase().trim();

  // Priority 1: Notes domain
  if (/note|笔记/i.test(lower)) {
    return ['notes'];
  }

  // Priority 2: Tasks domain
  if (/task|todo|任务|待办/i.test(lower)) {
    return ['tasks'];
  }

  // Priority 3: Calculator / math / unit conversion domain
  if (
    /\d+\s*[+\-*/×÷=加减乘除]\s*\d+/.test(lower) ||
    /(\d+)\s*(plus|minus|times|divided by|and|\+|-|\*|\/|加|减|乘|除以?)\s*(\d+)/i.test(lower) ||
    /\b(calc(ulate|ulator)?|math|arithmetic|convert|conversion|celsius|fahrenheit|meters?|feet|inches|cm|kg|pounds?)\b/i.test(lower) ||
    /(米|英尺|英寸|千克|公斤|磅|摄氏度|华氏度|换算|计算)/i.test(lower) ||
    /\b(add|sum|multiply|divide|subtract)\s+\d+/i.test(lower)
  ) {
    return ['calculator'];
  }

  // Default: route to all servers
  return ['notes', 'tasks', 'calculator'];
}

/**
 * Converts simplified route selections into detailed SearchResult objects
 * matching available server manifests for downstream deriveRoutingDecision processing.
 *
 * @param intent The natural language query.
 * @param availableServers Currently registered and connected server manifests.
 * @returns Array of SearchResult items with scores and tool metadata.
 */
export function getFallbackSearchResults(
  intent: string,
  availableServers: ServerManifest[]
): SearchResult[] {
  const lower = (intent || '').toLowerCase().trim();
  const selectedServerIDs = simplifiedRoute(intent);
  const results: SearchResult[] = [];

  const availableMap = new Map(availableServers.map((s) => [s.id, s]));

  for (const serverID of selectedServerIDs) {
    const manifest = availableMap.get(serverID);
    if (!manifest) continue;

    const tools = manifest.tools || [];
    if (serverID === 'notes') {
      const isCreate = /add|create|new|write|make|新建|创建|添加|写/i.test(lower);
      const isRead = /read|get|view|show|find|search|list|all|读|看|查|列出|显示|获取|所有/i.test(lower);

      if (isCreate) {
        // 新建只留 create_note（排除无 ID 可提取的 read_note/update_note/delete_note 陪跑工具）
        const tool = tools.find((t) => t.name === 'create_note');
        if (tool) {
          results.push({ tool: tool.name, server: serverID, score: 0.95, description: tool.description });
        }
      } else if (isRead) {
        // 读/列只留 list_notes
        const tool = tools.find((t) => t.name === 'list_notes');
        if (tool) {
          results.push({ tool: tool.name, server: serverID, score: 0.92, description: tool.description });
        }
      } else {
        const tool = tools.find((t) => t.name === 'list_notes') || tools.find((t) => t.name === 'create_note');
        if (tool) {
          results.push({ tool: tool.name, server: serverID, score: 0.85, description: tool.description });
        }
      }
    } else if (serverID === 'tasks') {
      const isComplete = /mark.*(complete|done)|complete|finish|done|完成/i.test(lower);
      const isCreate = !isComplete && /add|create|new|make|新建|创建|添加/i.test(lower);

      if (isComplete) {
        // 标记完成留 update_task
        const tool = tools.find((t) => t.name === 'update_task');
        if (tool) {
          results.push({ tool: tool.name, server: serverID, score: 0.95, description: tool.description });
        }
      } else if (isCreate) {
        // 新建只留 create_task
        const tool = tools.find((t) => t.name === 'create_task');
        if (tool) {
          results.push({ tool: tool.name, server: serverID, score: 0.94, description: tool.description });
        }
      } else {
        // 列任务只留 list_tasks
        const tool = tools.find((t) => t.name === 'list_tasks');
        if (tool) {
          results.push({ tool: tool.name, server: serverID, score: 0.93, description: tool.description });
        }
      }
    } else if (serverID === 'calculator') {
      // 计算器按查询里的运算符选工具：
      // 四则运算优先于单位换算（算术运算符为明确信号，换算的"等于"等关键词具歧义）
      let targetTool = 'add';

      if (/\d+\s*-\s*\d+/i.test(lower) || /\b(minus|subtract)\b/i.test(lower) || /-/.test(lower) || /减/.test(lower)) {
        targetTool = 'subtract';
      } else if (/\d+\s*[*×]\s*\d+/i.test(lower) || /\b(multiply|times)\b/i.test(lower) || /[*×]/.test(lower) || /乘/.test(lower)) {
        targetTool = 'multiply';
      } else if (/\d+\s*[/÷]\s*\d+/i.test(lower) || /\b(divide|divided)\b/i.test(lower) || /[\/÷]/.test(lower) || /除/.test(lower)) {
        targetTool = 'divide';
      } else if (/\d+\s*\+\s*\d+/i.test(lower) || /\b(add|plus|sum)\b/i.test(lower) || /\+/.test(lower) || /加/.test(lower)) {
        targetTool = 'add';
      } else if (
        /convert|conversion|\bto\b|\binto\b|meter|feet|foot|inch|kg|pound|celsius|fahrenheit|米|英尺|英寸|千克|公斤|磅|摄氏度|华氏度|换算|等于/i.test(lower)
      ) {
        targetTool = 'convert_units';
      }

      const tool = tools.find((t) => t.name === targetTool) || tools.find((t) => t.name === 'add');
      if (tool) {
        results.push({ tool: tool.name, server: serverID, score: 0.95, description: tool.description });
      }
    } else {
      for (const t of tools) {
        results.push({ tool: t.name, server: serverID, score: 0.8, description: t.description });
      }
    }
  }

  // If no tools were added through specific filters, add all tools of the selected servers
  if (results.length === 0) {
    for (const serverID of selectedServerIDs) {
      const manifest = availableMap.get(serverID);
      if (manifest && manifest.tools) {
        for (const t of manifest.tools) {
          results.push({ tool: t.name, server: serverID, score: 0.8, description: t.description });
        }
      }
    }
  }

  return results;
}
