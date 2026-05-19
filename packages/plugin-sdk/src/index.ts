// Public API for @repo/plugin-sdk.
// Import specific sub-paths for tree-shaking.

export type {
  HookHandler,
  HookName,
  HookPayloads,
  Logger,
  Plugin,
  PluginContext,
  PluginHooks,
  PluginManifest,
} from './types.ts';

export { HookBus } from './hooks.ts';

export { PluginRegistry } from './registry.ts';
export type { RegistryStatus } from './registry.ts';

export { checkPluginHealth, destroyPlugin, initPlugin } from './lifecycle.ts';
export type { PluginRecord, PluginState } from './lifecycle.ts';
