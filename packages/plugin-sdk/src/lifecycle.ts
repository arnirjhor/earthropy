// Plugin lifecycle helpers — init, destroy, and health-check logic.
// These wrap the raw Plugin interface so the PluginRegistry stays clean.

import { log } from '@repo/observability/log';
import type { Plugin, PluginContext } from './types.ts';

export type PluginState = 'registered' | 'initialised' | 'failed' | 'destroyed';

export interface PluginRecord {
  readonly plugin: Plugin;
  state: PluginState;
  error?: string;
}

/** Initialise a plugin, capturing state transitions. */
export async function initPlugin(record: PluginRecord, ctx: PluginContext): Promise<void> {
  const { id, name } = record.plugin;
  try {
    await record.plugin.init(ctx);
    record.state = 'initialised';
    log.info('plugin.init_ok', { pluginId: id, pluginName: name });
  } catch (err) {
    record.state = 'failed';
    record.error = err instanceof Error ? err.message : String(err);
    log.error('plugin.init_failed', { pluginId: id, pluginName: name, err: record.error });
  }
}

/** Destroy a plugin, capturing state transitions. */
export async function destroyPlugin(record: PluginRecord): Promise<void> {
  const { id, name } = record.plugin;
  if (record.state === 'destroyed') return;
  try {
    await record.plugin.destroy();
    record.state = 'destroyed';
    log.info('plugin.destroy_ok', { pluginId: id, pluginName: name });
  } catch (err) {
    log.error('plugin.destroy_failed', {
      pluginId: id,
      pluginName: name,
      err: err instanceof Error ? err.message : String(err),
    });
    // Still mark as destroyed; the process is likely shutting down anyway.
    record.state = 'destroyed';
  }
}

/**
 * Run a health check for a plugin.
 * Returns `null` when the plugin does not implement `health()`.
 */
export async function checkPluginHealth(record: PluginRecord): Promise<boolean | null> {
  if (record.state !== 'initialised') return false;
  if (record.plugin.health == null) return null;
  try {
    return await record.plugin.health();
  } catch (err) {
    log.warn('plugin.health_error', {
      pluginId: record.plugin.id,
      err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
