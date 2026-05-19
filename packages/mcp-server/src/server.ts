// Earthropy MCP server factory.
// Creates and configures the McpServer instance with all tool registrations.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { log } from '@repo/observability/log';
import type { PluginRegistry } from '@repo/plugin-sdk/registry';
import { registerTools } from './tools.ts';

export interface CreateServerOptions {
  readonly pluginRegistry: PluginRegistry;
  /** Server version surfaced in MCP protocol handshake. Default: '0.1.0'. */
  readonly version?: string;
}

/**
 * Construct and configure the Earthropy McpServer.
 * Caller is responsible for connecting it to a transport.
 */
export function createEarthropyMcpServer(opts: CreateServerOptions): McpServer {
  const version = opts.version ?? '0.1.0';

  const server = new McpServer(
    { name: 'earthropy', version },
    {
      instructions:
        'Earthropy is a platform for coordinating global action on the 17 UN Sustainable Development Goals (SDGs). ' +
        'Use getSDGs to discover available SDGs before filtering groups or posts. ' +
        'Posts require at least one SDG id (1–17). ' +
        'createPost triggers the AI moderation pipeline; newly created posts may be in "pending_ai" status.',
    },
  );

  registerTools(server, { pluginRegistry: opts.pluginRegistry });

  log.info('mcp_server.created', { version, tools: 5 });

  return server;
}
