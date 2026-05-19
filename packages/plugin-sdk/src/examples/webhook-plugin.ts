// Example plugin — WebhookPlugin.
// Fires HTTP POST requests to a configurable URL on afterPublish and
// afterModeration events. Demonstrates the full plugin lifecycle pattern.
//
// Self-hosters can configure this via WEBHOOK_PLUGIN_URL (and optionally
// WEBHOOK_PLUGIN_SECRET for HMAC-SHA256 signatures).

import type { Plugin, PluginContext } from '../types.ts';

interface WebhookPluginConfig {
  readonly url: string;
  readonly secret?: string;
}

type WebhookBody =
  | { readonly event: 'afterPublish'; readonly data: Record<string, unknown> }
  | { readonly event: 'afterModeration'; readonly data: Record<string, unknown> };

function buildConfig(ctx: PluginContext): WebhookPluginConfig {
  const url = ctx.config.WEBHOOK_PLUGIN_URL;
  if (!url) {
    throw new Error('WebhookPlugin requires WEBHOOK_PLUGIN_URL in config');
  }
  return { url, secret: ctx.config.WEBHOOK_PLUGIN_SECRET };
}

async function fire(
  cfg: WebhookPluginConfig,
  body: WebhookBody,
  ctx: PluginContext,
): Promise<void> {
  const payload = JSON.stringify(body);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (cfg.secret) {
    // HMAC-SHA256 signature over the raw JSON body.
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(cfg.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    headers['X-Earthropy-Signature'] = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  const res = await fetch(cfg.url, { method: 'POST', headers, body: payload });
  if (!res.ok) {
    ctx.log.warn('webhook_plugin.delivery_failed', {
      event: body.event,
      status: res.status,
      url: cfg.url,
    });
  } else {
    ctx.log.debug('webhook_plugin.delivered', { event: body.event, status: res.status });
  }
}

export function createWebhookPlugin(): Plugin {
  let cfg: WebhookPluginConfig | null = null;
  let ctx: PluginContext | null = null;

  return {
    id: 'org.earthropy.examples.webhook',
    name: 'Webhook Plugin',
    version: '0.1.0',

    hooks: {
      async afterPublish(payload) {
        if (cfg == null || ctx == null) return;
        await fire(cfg, { event: 'afterPublish', data: { ...payload } }, ctx);
      },

      async afterModeration(payload) {
        if (cfg == null || ctx == null) return;
        await fire(cfg, { event: 'afterModeration', data: { ...payload } }, ctx);
      },
    },

    async init(pluginCtx: PluginContext) {
      ctx = pluginCtx;
      cfg = buildConfig(pluginCtx);
      pluginCtx.log.info('webhook_plugin.init', { url: cfg.url, signed: cfg.secret != null });
    },

    async destroy() {
      cfg = null;
      ctx = null;
    },

    async health() {
      if (cfg == null) return false;
      try {
        const res = await fetch(cfg.url, { method: 'HEAD' });
        return res.ok || res.status < 500;
      } catch {
        return false;
      }
    },
  };
}
