'use client';

/**
 * @file ToolResultCard.tsx
 * @description Component to display individual MCP tool execution result or error.
 * Formats JSON result objects, colors borders according to status, and collapses long outputs (>500 chars).
 */

import { useState } from 'react';
import type { ToolResult } from '../types';

export interface ToolResultCardProps {
  result: ToolResult;
}

export default function ToolResultCard({ result }: ToolResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const resultString = typeof result.result === 'object'
    ? JSON.stringify(result.result, null, 2)
    : String(result.result ?? '');
  const isLong = resultString.length > 500;

  return (
    <div
      className={`border rounded p-3 ${
        result.status === 'success'
          ? 'border-green-700/50 bg-green-900/10'
          : 'border-red-700/50 bg-red-900/10'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={result.status === 'success' ? 'text-green-400' : 'text-red-400'}>
          {result.status === 'success' ? '✓' : '✗'}
        </span>
        <span className="font-mono text-sm text-gray-200">
          {result.serverID}.{result.toolName}
        </span>
      </div>

      {result.status === 'success' ? (
        <div>
          <pre
            className={`text-xs overflow-x-auto ${
              isLong && !expanded ? 'max-h-32 overflow-y-hidden' : ''
            }`}
          >
            <code className="text-gray-300 font-mono">{resultString}</code>
          </pre>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-purple-400 hover:text-purple-300 mt-2 cursor-pointer"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      ) : (
        <div className="text-sm text-red-300">{result.error}</div>
      )}
    </div>
  );
}
