// Hook system — define hook points and call handlers registered by plugins.
// Hooks are fire-and-forget: failures in one handler are logged and skipped;
// they never block the main Earthropy pipeline.

import { log } from '@repo/observability/log';
import type { HookHandler, HookName, HookPayloads } from './types.ts';

type HandlerEntry<N extends HookName> = {
  readonly pluginId: string;
  readonly handler: HookHandler<N>;
};

// Use a Map keyed by HookName. Each value is an array of registered handlers.
// The type assertion is safe: we control all writes via registerHook/unregisterHooks.
type HookRegistry = {
  [N in HookName]: HandlerEntry<N>[];
};

function makeEmptyRegistry(): HookRegistry {
  return {
    beforeModeration: [],
    afterModeration: [],
    beforePublish: [],
    afterPublish: [],
    onReputationChange: [],
    onGroupJoin: [],
    onNotification: [],
  };
}

/**
 * HookBus manages handler registration and dispatch for all Earthropy hook
 * points. One shared instance is used by the PluginRegistry.
 */
export class HookBus {
  private readonly registry: HookRegistry = makeEmptyRegistry();

  /** Register a handler for a hook from a named plugin. */
  register<N extends HookName>(hookName: N, pluginId: string, handler: HookHandler<N>): void {
    (this.registry[hookName] as HandlerEntry<N>[]).push({ pluginId, handler });
    log.debug('hook.registered', { hookName, pluginId });
  }

  /** Remove all handlers registered by a plugin. */
  unregisterPlugin(pluginId: string): void {
    for (const hookName of Object.keys(this.registry) as HookName[]) {
      const before = (this.registry[hookName] as HandlerEntry<HookName>[]).length;
      (this.registry[hookName] as HandlerEntry<HookName>[]) = (
        this.registry[hookName] as HandlerEntry<HookName>[]
      ).filter((e) => e.pluginId !== pluginId);
      const after = (this.registry[hookName] as HandlerEntry<HookName>[]).length;
      if (before !== after) {
        log.debug('hook.unregistered', { hookName, pluginId, removed: before - after });
      }
    }
  }

  /**
   * Call all handlers registered for a hook point with the given payload.
   * Runs handlers sequentially. Failures are caught, logged, and skipped
   * so that a broken plugin cannot block the pipeline.
   */
  async call<N extends HookName>(hookName: N, payload: HookPayloads[N]): Promise<void> {
    const handlers = this.registry[hookName] as HandlerEntry<N>[];
    if (handlers.length === 0) return;
    log.debug('hook.call', { hookName, handlerCount: handlers.length });
    for (const { pluginId, handler } of handlers) {
      try {
        await handler(payload);
      } catch (err) {
        log.error('hook.handler_error', {
          hookName,
          pluginId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  /** List registered handler counts per hook (useful for diagnostics). */
  stats(): Record<HookName, number> {
    return Object.fromEntries(
      (Object.keys(this.registry) as HookName[]).map((n) => [
        n,
        (this.registry[n] as HandlerEntry<HookName>[]).length,
      ]),
    ) as Record<HookName, number>;
  }
}
