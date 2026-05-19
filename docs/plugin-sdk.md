# Plugin SDK

`@repo/plugin-sdk` is Earthropy's first-class extension system. It lets third-party code (and Earthropy's own optional features) attach to named lifecycle points without modifying core packages.

The design follows the same interface-first pattern as `packages/moderation/src/provider.ts`: Earthropy's core code never imports a concrete plugin. It only knows about `Plugin`, `PluginContext`, and `HookName`.

---

## Architecture overview

```
PluginRegistry          ← single coordinator; holds all plugins
  │
  ├── HookBus           ← dispatches events to registered handlers
  │     └── HookHandler[]  per HookName
  │
  └── Plugin (×N)
        ├── init(ctx)   ← called at startup
        ├── destroy()   ← called at shutdown
        ├── health()    ← optional; called periodically
        └── hooks       ← map of HookName → handler
```

Calls to `registry.call('afterPublish', payload)` fan out to every handler registered for that hook, sequentially. Handler failures are caught and logged; they never abort the main pipeline.

---

## Writing a plugin

A plugin is any object implementing the `Plugin` interface from `@repo/plugin-sdk`.

```typescript
import type { Plugin, PluginContext } from '@repo/plugin-sdk';

export function createMyPlugin(): Plugin {
  let ctx: PluginContext | null = null;

  return {
    id: 'com.example.my-plugin',   // reverse-DNS, must be globally unique
    name: 'My Plugin',
    version: '1.0.0',

    hooks: {
      async afterPublish(payload) {
        ctx?.log.info('my_plugin.post_published', { postId: payload.postId });
      },
    },

    async init(pluginCtx) {
      ctx = pluginCtx;
      // Open connections, validate config, etc.
      const apiKey = pluginCtx.config.MY_PLUGIN_API_KEY;
      if (!apiKey) throw new Error('MY_PLUGIN_API_KEY is required');
    },

    async destroy() {
      ctx = null;
      // Close connections, flush buffers.
    },

    async health() {
      return ctx !== null;
    },
  };
}
```

### Plugin rules

- `id` must be unique across all loaded plugins.
- `init` throws to signal startup failure. The registry marks the plugin as `failed` and skips wiring its hooks — the application still starts.
- `destroy` is always called on unregister or shutdown, even if `init` failed.
- Use `ctx.log` (structured logger). Never use `console.log`.
- Use `ctx.config` for environment values. Never read `process.env` directly.
- All hooks are async and fire-and-forget from the platform's perspective.

---

## Available hook points

| Hook name | When it fires | Payload fields |
|---|---|---|
| `beforeModeration` | Before AI classifies a post or comment | `text`, `locale`, `targetType`, `authorId`, `groupId` |
| `afterModeration` | After AI returns a verdict | `targetId`, `targetType`, `verdict`, `provider`, `scores` |
| `beforePublish` | Before a post transitions to published | `postId`, `authorId`, `groupId`, `title` |
| `afterPublish` | After a post is published | `postId`, `authorId`, `groupId`, `title`, `publishedAt` |
| `onReputationChange` | After a user's reputation is updated | `userId`, `delta`, `newReputation`, `reason` |
| `onGroupJoin` | After a user joins a group | `userId`, `groupId`, `role` |
| `onNotification` | After a notification is dispatched | `userId`, `kind`, `payload` |

TypeScript enforces payload shapes via the `HookPayloads` mapped type in `packages/plugin-sdk/src/types.ts`.

---

## Registering plugins

Plugins are registered before the server starts. There is no dynamic runtime registration in v0.2.

```typescript
import { PluginRegistry } from '@repo/plugin-sdk';
import { createMyPlugin } from './my-plugin';

const ctx = {
  log,
  config: process.env as Record<string, string | undefined>,
  platformVersion: '0.2.0',
};

const registry = new PluginRegistry(ctx);
registry.register(createMyPlugin());

await registry.initAll();

// Dispatch hooks from your pipeline:
await registry.call('afterPublish', { postId, authorId, groupId, title, publishedAt });

// On shutdown:
await registry.destroyAll();
```

---

## MCP server

`@repo/mcp-server` exposes Earthropy actions as [Model Context Protocol](https://modelcontextprotocol.io/) tools for AI agents (Claude Desktop, Claude API agents, etc.).

### Tools

| Tool | Description |
|---|---|
| `getSDGs` | Returns all 17 UN SDGs with codes, names, and colors |
| `listGroups` | Paginated group listing with optional SDG id and visibility filters |
| `getGroup` | Fetch a single group by slug |
| `createPost` | Create a post in a group (triggers AI moderation pipeline) |
| `getModeratedPosts` | List posts by moderation status |

### Running the MCP server (stdio transport)

```bash
# Development
pnpm --filter @repo/mcp-server dev

# With plugins loaded from env
EARTHROPY_PLUGINS=./path/to/my-plugin.ts pnpm --filter @repo/mcp-server dev
```

The server communicates over stdio (JSON-RPC). Connect it in Claude Desktop via `mcpServers` in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "earthropy": {
      "command": "node",
      "args": ["/path/to/packages/mcp-server/dist/cli.js"],
      "env": {
        "DATABASE_URL": "postgres://...",
        "REDIS_URL": "redis://..."
      }
    }
  }
}
```

### Using the MCP server programmatically

```typescript
import { createEarthropyMcpServer } from '@repo/mcp-server';
import { PluginRegistry } from '@repo/plugin-sdk';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const registry = new PluginRegistry(ctx);
await registry.initAll();

const server = createEarthropyMcpServer({ pluginRegistry: registry });
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## Example plugin walkthrough

`packages/plugin-sdk/src/examples/webhook-plugin.ts` demonstrates the full lifecycle.

**What it does:**
- On `afterPublish` and `afterModeration`, POSTs a JSON payload to a configurable URL.
- Optionally signs the payload with HMAC-SHA256 (header: `X-Earthropy-Signature`).
- Implements `health()` with a HEAD check against the webhook URL.

**Configuration:**

| Env var | Required | Description |
|---|---|---|
| `WEBHOOK_PLUGIN_URL` | Yes | HTTP(S) endpoint to deliver events to |
| `WEBHOOK_PLUGIN_SECRET` | No | Secret for HMAC-SHA256 request signing |

**Using it:**

```typescript
import { createWebhookPlugin } from '@repo/plugin-sdk/examples/webhook-plugin';

const registry = new PluginRegistry({
  log,
  config: { WEBHOOK_PLUGIN_URL: 'https://example.com/hooks', WEBHOOK_PLUGIN_SECRET: 'secret' },
  platformVersion: '0.2.0',
});

registry.register(createWebhookPlugin());
await registry.initAll();
```

---

## Corp-agnostic guarantee

The plugin system itself has no vendor lock-in. The `Plugin` interface, `PluginContext`, and `HookBus` contain no references to Anthropic, Resend, or any other external service. Self-hosters can load any plugin that implements the `Plugin` interface, including plugins that use entirely different infrastructure.
