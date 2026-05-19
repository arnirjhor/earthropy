#!/usr/bin/env node
// Earthropy MCP server — stdio entry point.
// Run via: pnpm --filter @repo/mcp-server dev
// Or after build: node dist/cli.js
//
// IMPORTANT: stdio MCP servers must not write anything to stdout except
// JSON-RPC messages. All logging goes to stderr (the observability log
// already does this for warn/error; debug/info go to stdout — redirect
// or disable in production via LOG_LEVEL env).

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { log } from '@repo/observability/log';
import { PluginRegistry } from '@repo/plugin-sdk/registry';
import { createEarthropyMcpServer } from './server.ts';

const ctx = {
  log,
  config: Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => v !== undefined),
  ) as Record<string, string>,
  platformVersion: '0.1.0',
};

const pluginRegistry = new PluginRegistry(ctx);

// Load plugins from environment variable EARTHROPY_PLUGINS (comma-separated
// plugin module paths). Dynamic import keeps this forward-compatible with
// the full config-driven loader that lands in v0.2.
const pluginPaths = (process.env.EARTHROPY_PLUGINS ?? '')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

for (const path of pluginPaths) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const mod = await import(path);
    // Convention: default export is the Plugin, or a factory returning Plugin.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const plugin = typeof mod.default === 'function' ? mod.default() : mod.default;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    pluginRegistry.register(plugin);
  } catch (err) {
    log.error('mcp_cli.plugin_load_failed', { path, err: String(err) });
  }
}

await pluginRegistry.initAll();

const server = createEarthropyMcpServer({ pluginRegistry });
const transport = new StdioServerTransport();

process.on('SIGINT', async () => {
  await pluginRegistry.destroyAll();
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await pluginRegistry.destroyAll();
  await server.close();
  process.exit(0);
});

await server.connect(transport);

log.info('mcp_server.started', { transport: 'stdio' });
