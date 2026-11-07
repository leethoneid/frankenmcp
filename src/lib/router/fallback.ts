/**
 * @file fallback.ts
 * @description Fast in-process rule-based routing fallback for Vercel Serverless environment.
 * Evaluates user intent against regex and keyword patterns when running on Vercel
 * or when the external dynamic router subprocess is unavailable.
 */

import type { SearchResult, ServerManifest } from './types';

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
  if (/note/i.test(lower)) {
    return ['notes'];
  }

  // Priority 2: Tasks domain
  if (/task|todo/i.test(lower)) {
    return ['tasks'];
  }

  // Priority 3: Calculator / math / unit conversion domain
  if (
    /\d+\s*[+\-*/×÷=]\s*\d+/.test(lower) ||
    /(\d+)\s*(plus|minus|times|divided by|and|\+|-|\*|\/)\s*(\d+)/i.test(lower) ||
    /\b(calc(ulate|ulator)?|math|arithmetic|convert|conversion|celsius|fahrenheit|meters?|feet|inches|cm|kg|pounds?)\b/i.test(lower) ||
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

    // Filter tools within the selected server based on intent nuances
    const tools = manifest.tools || [];
    if (serverID === 'notes') {
      const isCreate = /add|create|new|write|make/i.test(lower);
      const isRead = /read|get|view|show|find|search/i.test(lower);
      const isDelete = /delete|remove/i.test(lower);

      for (const t of tools) {
        let score = 0.85;
        if (isCreate && t.name === 'create_note') score = 0.95;
        else if (isRead && (t.name === 'read_note' || t.name === 'list_notes')) score = 0.92;
        else if (isDelete && t.name === 'delete_note') score = 0.95;

        // If specific intent, only include top matching tools to demonstrate schema trimming
        if (isCreate && (t.name === 'create_note' || t.name === 'read_note')) {
          results.push({ tool: t.name, server: serverID, score, description: t.description });
        } else if (isRead && (t.name === 'read_note' || t.name === 'list_notes')) {
          results.push({ tool: t.name, server: serverID, score, description: t.description });
        } else if (isDelete && t.name === 'delete_note') {
          results.push({ tool: t.name, server: serverID, score, description: t.description });
        } else if (!isCreate && !isRead && !isDelete) {
          results.push({ tool: t.name, server: serverID, score, description: t.description });
        }
      }
    } else if (serverID === 'tasks') {
      const isToggle = /complete|done|check|toggle|finish/i.test(lower);
      const isList = /list|show|view|get/i.test(lower);
      const isCreate = /add|create|new|make/i.test(lower);

      for (const t of tools) {
        let score = 0.85;
        if (isToggle && t.name === 'toggle_task_completion') score = 0.95;
        else if (isList && t.name === 'list_tasks') score = 0.93;
        else if (isCreate && t.name === 'create_task') score = 0.94;

        if (isToggle && t.name === 'toggle_task_completion') {
          results.push({ tool: t.name, server: serverID, score, description: t.description });
        } else if (isList && (t.name === 'list_tasks' || t.name === 'create_task')) {
          results.push({ tool: t.name, server: serverID, score, description: t.description });
        } else if (isCreate && (t.name === 'create_task' || t.name === 'list_tasks')) {
          results.push({ tool: t.name, server: serverID, score, description: t.description });
        } else if (!isToggle && !isList && !isCreate) {
          results.push({ tool: t.name, server: serverID, score, description: t.description });
        }
      }
    } else if (serverID === 'calculator') {
      const isConvert = /convert|conversion|meter|foot|celsius|fahrenheit|kg|pound/i.test(lower);

      for (const t of tools) {
        if (isConvert && t.name === 'convert_units') {
          results.push({ tool: t.name, server: serverID, score: 0.95, description: t.description });
        } else if (!isConvert && t.name === 'add') {
          results.push({ tool: t.name, server: serverID, score: 0.92, description: t.description });
        }
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
