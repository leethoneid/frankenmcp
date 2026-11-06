import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { loadMCPConfig } from '@/lib/mcp/config-loader';
import { MCPConfigParseError } from '@/lib/router/types';

describe('Phase 2 - Task 2.3: loadMCPConfig', () => {
  const tmpDir = path.resolve(process.cwd(), 'tests', 'unit', 'tmp-config');

  beforeEach(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('successfully loads a valid mcp.json config', () => {
    const configPath = path.join(tmpDir, 'valid-mcp.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        mcpServers: {
          notes: {
            command: 'node',
            args: ['src/mcp-servers/notes/index.mjs'],
            disabled: false,
          },
          calculator: {
            command: 'node',
            args: ['src/mcp-servers/calculator/index.mjs'],
          },
          remote: {
            transport: 'sse',
            endpoint: 'https://example.com/sse',
          },
        },
      })
    );

    const configs = loadMCPConfig(configPath);
    expect(configs).toHaveLength(3);

    const notes = configs.find((c) => c.id === 'notes');
    expect(notes).toBeDefined();
    expect(notes?.transport).toBe('stdio');
    expect(notes?.command).toBe('node');
    expect(notes?.args).toEqual(['src/mcp-servers/notes/index.mjs']);
    expect(notes?.disabled).toBe(false);

    const calc = configs.find((c) => c.id === 'calculator');
    expect(calc?.transport).toBe('stdio');

    const remote = configs.find((c) => c.id === 'remote');
    expect(remote?.transport).toBe('sse');
    expect(remote?.endpoint).toBe('https://example.com/sse');
  });

  it('handles empty mcpServers object without error', () => {
    const configPath = path.join(tmpDir, 'empty.json');
    fs.writeFileSync(configPath, JSON.stringify({ mcpServers: {} }));

    const configs = loadMCPConfig(configPath);
    expect(configs).toEqual([]);
  });

  it('throws MCPConfigParseError when file does not exist', () => {
    const nonExistentPath = path.join(tmpDir, 'does-not-exist.json');
    expect(() => loadMCPConfig(nonExistentPath)).toThrow(MCPConfigParseError);

    try {
      loadMCPConfig(nonExistentPath);
    } catch (err) {
      expect(err).toBeInstanceOf(MCPConfigParseError);
      expect((err as MCPConfigParseError).configPath).toBe(nonExistentPath);
    }
  });

  it('throws MCPConfigParseError on malformed JSON', () => {
    const badJsonPath = path.join(tmpDir, 'malformed.json');
    fs.writeFileSync(badJsonPath, '{ invalid json: true,');

    expect(() => loadMCPConfig(badJsonPath)).toThrow(MCPConfigParseError);
  });

  it('throws MCPConfigParseError when required stdio fields are missing', () => {
    const invalidPath = path.join(tmpDir, 'missing-command.json');
    fs.writeFileSync(
      invalidPath,
      JSON.stringify({
        mcpServers: {
          broken: {
            transport: 'stdio',
            // command is missing
          },
        },
      })
    );

    expect(() => loadMCPConfig(invalidPath)).toThrow(MCPConfigParseError);
    try {
      loadMCPConfig(invalidPath);
    } catch (err) {
      expect((err as Error).message).toContain('command');
    }
  });

  it('throws MCPConfigParseError when required SSE/HTTP endpoint is missing', () => {
    const invalidPath = path.join(tmpDir, 'missing-endpoint.json');
    fs.writeFileSync(
      invalidPath,
      JSON.stringify({
        mcpServers: {
          broken_sse: {
            transport: 'sse',
            // endpoint is missing
          },
        },
      })
    );

    expect(() => loadMCPConfig(invalidPath)).toThrow(MCPConfigParseError);
    try {
      loadMCPConfig(invalidPath);
    } catch (err) {
      expect((err as Error).message).toContain('endpoint');
    }
  });

  it('throws MCPConfigParseError on unsupported transport type', () => {
    const invalidPath = path.join(tmpDir, 'bad-transport.json');
    fs.writeFileSync(
      invalidPath,
      JSON.stringify({
        mcpServers: {
          bad_transport: {
            transport: 'websocket',
          },
        },
      })
    );

    expect(() => loadMCPConfig(invalidPath)).toThrow(MCPConfigParseError);
  });
});
