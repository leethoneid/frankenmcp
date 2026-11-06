import fs from 'fs';
import path from 'path';
import { ServerConfig, MCPConfigParseError } from '@/lib/router/types';

export interface MCPConfigFile {
  mcpServers?: Record<string, Partial<ServerConfig> & { command?: string; args?: string[]; endpoint?: string }>;
}

/**
 * Loads and validates MCP server configurations from a JSON file (e.g. .kiro/settings/mcp.json).
 *
 * Throws MCPConfigParseError if:
 * - File does not exist
 * - File contains invalid JSON
 * - Configuration schema validation fails (missing required fields, invalid transport)
 */
export function loadMCPConfig(configPath: string): ServerConfig[] {
  const resolvedPath = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(process.cwd(), configPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new MCPConfigParseError(configPath, new Error(`Config file not found at '${configPath}'`));
  }

  let rawContent: string;
  try {
    rawContent = fs.readFileSync(resolvedPath, 'utf-8');
  } catch (err) {
    throw new MCPConfigParseError(configPath, err);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    throw new MCPConfigParseError(configPath, err);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new MCPConfigParseError(configPath, new Error('Root configuration must be an object'));
  }

  const parsedObj = parsed as Record<string, unknown>;
  const serversObj = parsedObj.mcpServers !== undefined ? parsedObj.mcpServers : parsedObj;

  if (typeof serversObj !== 'object' || serversObj === null) {
    throw new MCPConfigParseError(configPath, new Error("Configuration field 'mcpServers' must be an object"));
  }

  const configs: ServerConfig[] = [];

  for (const [key, rawEntry] of Object.entries(serversObj as Record<string, unknown>)) {
    if (typeof rawEntry !== 'object' || rawEntry === null) {
      throw new MCPConfigParseError(configPath, new Error(`Invalid server configuration for '${key}'`));
    }

    const entry = rawEntry as Record<string, unknown>;
    const id = (typeof entry.id === 'string' && entry.id.trim()) ? entry.id.trim() : key;
    if (!id) {
      throw new MCPConfigParseError(configPath, new Error("Field 'id' must be a non-empty string"));
    }

    const name = (typeof entry.name === 'string' && entry.name.trim())
      ? entry.name.trim()
      : (typeof entry.id === 'string' && entry.id.trim())
      ? entry.id.trim()
      : key;

    let transport = entry.transport as string | undefined;
    if (!transport) {
      if (entry.command) {
        transport = 'stdio';
      } else if (entry.endpoint) {
        transport = 'sse';
      }
    }

    if (!transport || !['stdio', 'sse', 'http'].includes(transport)) {
      throw new MCPConfigParseError(
        configPath,
        new Error(`Invalid transport '${transport}' for server '${id}'. Expected 'stdio', 'sse', or 'http'`)
      );
    }

    if (transport === 'stdio') {
      if (!entry.command || typeof entry.command !== 'string' || !entry.command.trim()) {
        throw new MCPConfigParseError(
          configPath,
          new Error(`Missing required field: command for stdio server '${id}'`)
        );
      }
      if (entry.args !== undefined && !Array.isArray(entry.args)) {
        throw new MCPConfigParseError(
          configPath,
          new Error(`Field 'args' must be an array for stdio server '${id}'`)
        );
      }
    } else if (transport === 'sse' || transport === 'http') {
      if (!entry.endpoint || typeof entry.endpoint !== 'string' || !entry.endpoint.trim()) {
        throw new MCPConfigParseError(
          configPath,
          new Error(`Missing required field: endpoint for ${transport} server '${id}'`)
        );
      }
    }

    configs.push({
      id,
      name,
      transport: transport as 'stdio' | 'sse' | 'http',
      command: typeof entry.command === 'string' ? entry.command : undefined,
      args: Array.isArray(entry.args) ? (entry.args as string[]) : undefined,
      endpoint: typeof entry.endpoint === 'string' ? entry.endpoint : undefined,
      headers: (typeof entry.headers === 'object' && entry.headers !== null)
        ? (entry.headers as Record<string, string>)
        : undefined,
      disabled: Boolean(entry.disabled),
    });
  }

  return configs;
}
