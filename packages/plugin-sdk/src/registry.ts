// PluginRegistry — single entry point for registering, managing, and calling
// plugins. Wires together lifecycle management and the hook bus.

import { log } from '@repo/observability/log';
import { HookBus } from './hooks.ts';
import { checkPluginHealth, destroyPlugin, initPlugin } from './lifecycle.ts';
import type { PluginRecord, PluginState } from './lifecycle.ts';
import type { HookName, HookPayloads, Plugin, PluginContext } from './types.ts';

export interface RegistryStatus {
  readonly pluginId: string;
  readonly pluginName: string;
  readonly version: string;
  readonly state: PluginState;
  readonly error?: string;
}

/**
 * PluginRegistry is the central coordinator for all plugins.
 *
 * Typical usage:
 *   const registry = new PluginRegistry(ctx);
 *   registry.register(myPlugin);
 *   await registry.initAll();
 *   // ... application runs ...
 *   await registry.destroyAll();
 */
export class PluginRegistry {
  private readonly records = new Map<string, PluginRecord>();
  readonly hooks: HookBus = new HookBus();

  constructor(private readonly ctx: PluginContext) {}

  /**
   * Register a plugin. Does not initialise it — call `initAll()` or
   * `initPlugin()` explicitly. Plugins loaded from config are registered
   * before the server starts; no dynamic registration at runtime.
   */
  register(plugin: Plugin): void {
    if (this.records.has(plugin.id)) {
      log.warn('plugin.already_registered', { pluginId: plugin.id });
      return;
    }
    this.records.set(plugin.id, { plugin, state: 'registered' });
    log.info('plugin.registered', { pluginId: plugin.id, pluginName: plugin.name });
  }

  /**
   * Unregister a plugin. If it is initialised, `destroy()` is called first.
   * Hook handlers registered by this plugin are removed.
   */
  async unregister(pluginId: string): Promise<void> {
    const record = this.records.get(pluginId);
    if (record == null) {
      log.warn('plugin.not_found', { pluginId });
      return;
    }
    if (record.state === 'initialised') {
      await destroyPlugin(record);
    }
    this.hooks.unregisterPlugin(pluginId);
    this.records.delete(pluginId);
    log.info('plugin.unregistered', { pluginId });
  }

  getPlugin(id: string): Plugin | undefined {
    return this.records.get(id)?.plugin;
  }

  listPlugins(): readonly Plugin[] {
    return Array.from(this.records.values()).map((r) => r.plugin);
  }

  status(): readonly RegistryStatus[] {
    return Array.from(this.records.values()).map((r) => ({
      pluginId: r.plugin.id,
      pluginName: r.plugin.name,
      version: r.plugin.version,
      state: r.state,
      error: r.error,
    }));
  }

  /** Initialise all registered plugins and wire their hooks into the bus. */
  async initAll(): Promise<void> {
    log.info('plugin_registry.init_start', { count: this.records.size });
    for (const record of this.records.values()) {
      await initPlugin(record, this.ctx);
      if (record.state === 'initialised') {
        this._wireHooks(record.plugin);
      }
    }
    log.info('plugin_registry.init_done', { hookStats: this.hooks.stats() });
  }

  /** Destroy all initialised plugins in reverse registration order. */
  async destroyAll(): Promise<void> {
    const records = Array.from(this.records.values()).reverse();
    for (const record of records) {
      await destroyPlugin(record);
      this.hooks.unregisterPlugin(record.plugin.id);
    }
    log.info('plugin_registry.destroyed');
  }

  /** Run health checks for all initialised plugins. */
  async healthAll(): Promise<Record<string, boolean | null>> {
    const result: Record<string, boolean | null> = {};
    for (const record of this.records.values()) {
      result[record.plugin.id] = await checkPluginHealth(record);
    }
    return result;
  }

  /**
   * Dispatch a hook to all registered handlers.
   * Convenience wrapper over `this.hooks.call(...)`.
   */
  async call<N extends HookName>(hookName: N, payload: HookPayloads[N]): Promise<void> {
    return this.hooks.call(hookName, payload);
  }

  private _wireHooks(plugin: Plugin): void {
    for (const [hookName, handler] of Object.entries(plugin.hooks)) {
      if (handler != null) {
        this.hooks.register(
          hookName as HookName,
          plugin.id,
          handler as Parameters<HookBus['register']>[2],
        );
      }
    }
  }
}
