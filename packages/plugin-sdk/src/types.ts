// Core Plugin SDK types. Every extension point in Earthropy flows through
// these interfaces. The design mirrors packages/moderation/src/provider.ts:
// Earthropy code depends on these interfaces, never on concrete plugins.

import type { log } from '@repo/observability/log';

// ---------------------------------------------------------------------------
// Hook points — named extension points that plugins can attach handlers to.
// ---------------------------------------------------------------------------

export type HookName =
  | 'beforeModeration'
  | 'afterModeration'
  | 'beforePublish'
  | 'afterPublish'
  | 'onReputationChange'
  | 'onGroupJoin'
  | 'onNotification';

/** Payloads for each hook point. Handlers receive a strongly-typed payload. */
export interface HookPayloads {
  beforeModeration: {
    readonly text: string;
    readonly locale: string;
    readonly targetType: 'post' | 'comment';
    readonly authorId: string;
    readonly groupId: string;
  };
  afterModeration: {
    readonly targetId: string;
    readonly targetType: 'post' | 'comment';
    readonly verdict: 'auto_publish' | 'hold_for_review' | 'auto_reject';
    readonly provider: string;
    readonly scores: Readonly<Record<string, number>>;
  };
  beforePublish: {
    readonly postId: string;
    readonly authorId: string;
    readonly groupId: string;
    readonly title: string;
  };
  afterPublish: {
    readonly postId: string;
    readonly authorId: string;
    readonly groupId: string;
    readonly title: string;
    readonly publishedAt: string;
  };
  onReputationChange: {
    readonly userId: string;
    readonly delta: number;
    readonly newReputation: number;
    readonly reason: string;
  };
  onGroupJoin: {
    readonly userId: string;
    readonly groupId: string;
    readonly role: 'owner' | 'moderator' | 'member';
  };
  onNotification: {
    readonly userId: string;
    readonly kind: string;
    readonly payload: Readonly<Record<string, unknown>>;
  };
}

/** A hook handler function for a given hook point. */
export type HookHandler<N extends HookName> = (payload: HookPayloads[N]) => Promise<void>;

/** Map of hook names to the handlers a plugin provides. */
export type PluginHooks = Partial<{
  [N in HookName]: HookHandler<N>;
}>;

// ---------------------------------------------------------------------------
// PluginContext — capabilities passed to a plugin during init.
// ---------------------------------------------------------------------------

/** Subset of the logger interface from @repo/observability. */
export type Logger = typeof log;

/**
 * Context injected into every plugin during initialisation.
 * Self-hosters who replace infrastructure components can adjust what gets
 * injected here without changing plugin code.
 */
export interface PluginContext {
  /** Structured logger. Never use console.log in plugins. */
  readonly log: Logger;
  /** Runtime configuration values available to the plugin. */
  readonly config: Readonly<Record<string, string | undefined>>;
  /** Earthropy platform version. Plugins may gate behaviour on this. */
  readonly platformVersion: string;
}

// ---------------------------------------------------------------------------
// Plugin interface
// ---------------------------------------------------------------------------

export interface Plugin {
  /** Unique identifier. Reverse-DNS style recommended: `com.example.my-plugin`. */
  readonly id: string;
  /** Human-readable display name. */
  readonly name: string;
  /** Semver string. */
  readonly version: string;
  /** Hook handlers this plugin provides. */
  readonly hooks: PluginHooks;
  /**
   * Called once during registry startup. Plugins should open connections,
   * validate config, etc. here. Throw to signal init failure.
   */
  init(ctx: PluginContext): Promise<void>;
  /**
   * Called when the plugin is unregistered or the process is shutting down.
   * Plugins should close connections, flush buffers, etc. here.
   */
  destroy(): Promise<void>;
  /**
   * Optional health check. The registry calls this periodically.
   * Returns `true` if the plugin is operating normally.
   */
  health?(): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// PluginManifest — lightweight descriptor used in config files.
// ---------------------------------------------------------------------------

/**
 * Static descriptor loaded from config before the plugin module is imported.
 * Lets the registry log available plugins without importing their code.
 */
export interface PluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly enabled: boolean;
}
