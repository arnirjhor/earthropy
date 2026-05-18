/**
 * E2E: Axe accessibility audit across all canonical routes.
 *
 * Asserts zero serious/critical violations per route.
 * Moderate violations are allowed but should be tracked.
 *
 * Public routes are tested without auth.
 * Authenticated routes sign up a fresh user via MailHog, then test each route.
 * Routes that require specific resources (group slug, post id, user handle)
 * are set up inline.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const MAILHOG_API = 'http://localhost:8025/api/v2/messages';
const APP_BASE = 'http://localhost:3011';

// ── Helpers ────────────────────────────────────────────────────────────────────

function uniqueEmail(prefix = 'a11y'): string {
  return `${prefix}+${Date.now()}@example.com`;
}

async function waitForEmail(toAddress: string): Promise<{ subject: string; body: string }> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const res = await fetch(MAILHOG_API);
    const data = (await res.json()) as {
      items: Array<{
        Content: { Headers: { Subject: string[]; To: string[] }; Body: string };
        Raw: { To: string[] };
      }>;
    };
    const msg = data.items.find((m) =>
      m.Raw.To.some((addr) => addr.toLowerCase().includes(toAddress.toLowerCase())),
    );
    if (msg) {
      return { subject: msg.Content.Headers.Subject?.[0] ?? '', body: msg.Content.Body };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for email to ${toAddress}`);
}

function extractLink(body: string, pathFragment: string): string {
  const allMatches = body.match(/https?:\/\/\S+/g) ?? [];
  const found = allMatches.find((u) => u.includes(pathFragment));
  if (found) return found.replace(/[>=]$/, '');
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/https?:\/\/\S+/g);
    if (match) {
      const url = match.find((u) => u.includes(pathFragment));
      if (url) return url.replace(/[>=]$/, '');
    }
  }
  throw new Error(`Could not find link containing "${pathFragment}" in email body`);
}

type Page = Parameters<Parameters<typeof test>[1]>[0];

/** Sign up fresh user + verify email → signed-in session. Returns { handle }. */
async function signUpAndVerify(page: Page): Promise<{ email: string; handle: string }> {
  const email = uniqueEmail('a11y-auth');
  const password = 'A11yTestPass1234';
  const handle = `a11ytest${Date.now()}`;

  await page.goto(`${APP_BASE}/en/signup`);
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.fill('[name="handle"]', handle);
  await page.click('[type="submit"]');

  await expect(page).toHaveURL(/check-your-email/, { timeout: 30_000 });

  const emailData = await waitForEmail(email);
  const verifyLink = extractLink(emailData.body, 'verify-email');
  await page.goto(verifyLink);
  await page.click('[type="submit"]');

  await expect(page).toHaveURL(/\/(en|ar|fr|es|zh|hi|pt|ru|sw)\/?$/, { timeout: 30_000 });
  return { email, handle };
}

/** Create a group and return its slug. Requires signed-in state. */
async function createGroup(page: Page): Promise<string> {
  await page.goto(`${APP_BASE}/en/g/new`);
  await expect(page.locator('h1')).toBeVisible();

  const groupName = `A11y Test Group ${Date.now()}`;
  await page.fill('[name="name"]', groupName);
  await page.waitForTimeout(600);
  const slugValue = await page.inputValue('[name="slug"]');

  await page.click('[data-sdg-id="13"] [type="checkbox"]');
  await page.click('[type="submit"]');
  await expect(page).toHaveURL(/\/g\/[a-z0-9-]+$/);

  return slugValue;
}

/** Create a post in the given group and return its id. Requires signed-in state + membership. */
async function createPost(page: Page, slug: string): Promise<string> {
  await page.goto(`${APP_BASE}/en/g/${slug}/post/new`);
  await expect(page.locator('h1')).toBeVisible();

  await page.fill('[name="title"]', 'A11y test post for accessibility audit');
  await page.fill('[name="body"]', 'Test post body for the a11y audit run.');
  await page.click('[type="submit"]');

  await expect(page).toHaveURL(new RegExp(`/g/${slug}/p/[a-z0-9-]+`));
  const url = page.url();
  const match = url.match(/\/p\/([a-z0-9-]+)/);
  return match?.[1] ?? '';
}

function assertNoSeriousCritical(
  results: Awaited<ReturnType<InstanceType<typeof AxeBuilder>['analyze']>>,
  route: string,
) {
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  if (serious.length > 0) {
    const summary = serious
      .map((v) => `[${v.impact}] ${v.id}: ${v.description}`)
      .join('\n  ');
    throw new Error(`${route} has ${serious.length} serious/critical violation(s):\n  ${summary}`);
  }
  expect(serious).toHaveLength(0);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Wait for the page to fully render. */
async function waitForPage(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

// ── Public routes ──────────────────────────────────────────────────────────────

test.describe('a11y: public routes', () => {
  test('/ (home)', async ({ page }) => {
    await page.goto(`${APP_BASE}/en`);
    await waitForPage(page);
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSeriousCritical(results, '/');
  });

  test('/signup', async ({ page }) => {
    await page.goto(`${APP_BASE}/en/signup`);
    await waitForPage(page);
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSeriousCritical(results, '/signup');
  });

  test('/signin', async ({ page }) => {
    await page.goto(`${APP_BASE}/en/signin`);
    await waitForPage(page);
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSeriousCritical(results, '/signin');
  });

  test('/forgot-password', async ({ page }) => {
    await page.goto(`${APP_BASE}/en/forgot-password`);
    await waitForPage(page);
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSeriousCritical(results, '/forgot-password');
  });

  test('/g (group browse)', async ({ page }) => {
    await page.goto(`${APP_BASE}/en/g`);
    await waitForPage(page);
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSeriousCritical(results, '/g');
  });

  test('/sdg/climate-action', async ({ page }) => {
    await page.goto(`${APP_BASE}/en/sdg/climate-action`);
    await waitForPage(page);
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSeriousCritical(results, '/sdg/climate-action');
  });

  test('/transparency', async ({ page }) => {
    await page.goto(`${APP_BASE}/en/transparency`);
    await waitForPage(page);
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSeriousCritical(results, '/transparency');
  });
});

// ── Authenticated routes ───────────────────────────────────────────────────────

test.describe('a11y: authenticated routes', () => {
  let slug = '';
  let postId = '';
  let userHandle = '';
  // Shared auth state — saved once in beforeAll, reused by every test.
  // This avoids creating a new user per test which would exhaust the
  // signup rate limit (5/hour per IP) with 9+ tests.
  let sharedStorageState: string = '';

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      const { handle } = await signUpAndVerify(page);
      userHandle = handle;
      slug = await createGroup(page);
      postId = await createPost(page, slug);
      // Persist the session so every test can restore it without a new signup.
      sharedStorageState = JSON.stringify(await context.storageState());
    } finally {
      await context.close();
    }
  });

  /** Restore the shared signed-in session onto the page's browser context. */
  async function restoreSession(page: Page): Promise<void> {
    if (!sharedStorageState) throw new Error('beforeAll did not set sharedStorageState');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = JSON.parse(sharedStorageState) as any;
    if (state.cookies?.length) {
      await page.context().addCookies(state.cookies);
    }
    for (const origin of state.origins ?? []) {
      for (const entry of origin.localStorage ?? []) {
        await page.evaluate(
          ({ key, value }: { key: string; value: string }) => localStorage.setItem(key, value),
          { key: entry.name as string, value: entry.value as string },
        );
      }
    }
  }

  /** Navigate to APP_BASE/en first (needed to set cookies on the right origin), then restore session. */
  async function signInViaSession(page: Page): Promise<void> {
    await page.goto(`${APP_BASE}/en`);
    await restoreSession(page);
  }

  test('/dashboard', async ({ page }) => {
    await signInViaSession(page);
    await page.goto(`${APP_BASE}/en/dashboard`);
    await waitForPage(page);
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSeriousCritical(results, '/dashboard');
  });

  test('/account', async ({ page }) => {
    await signInViaSession(page);
    await page.goto(`${APP_BASE}/en/account`);
    await waitForPage(page);
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSeriousCritical(results, '/account');
  });

  test('/g/<slug> (group detail — as member)', async ({ page }) => {
    test.skip(!slug, 'group not created in beforeAll');
    await signInViaSession(page);
    await page.goto(`${APP_BASE}/en/g/${slug}`);
    await waitForPage(page);
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSeriousCritical(results, `/g/${slug}`);
  });

  test('/g/<slug>/post/new (post create)', async ({ page }) => {
    test.skip(!slug, 'group not created in beforeAll');
    // The beforeAll user already owns the group — reuse that session directly.
    await signInViaSession(page);
    await page.goto(`${APP_BASE}/en/g/${slug}/post/new`);
    await waitForPage(page);
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSeriousCritical(results, '/g/<slug>/post/new');
  });

  test('/g/<slug>/p/<id> (post detail)', async ({ page }) => {
    test.skip(!slug || !postId, 'group/post not created in beforeAll');
    await signInViaSession(page);
    await page.goto(`${APP_BASE}/en/g/${slug}/p/${postId}`);
    await waitForPage(page);
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSeriousCritical(results, '/g/<slug>/p/<id>');
  });

  test('/u/<handle>/reputation', async ({ page }) => {
    test.skip(!userHandle, 'user handle not set in beforeAll');
    await signInViaSession(page);
    await page.goto(`${APP_BASE}/en/u/${userHandle}/reputation`);
    await waitForPage(page);
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSeriousCritical(results, '/u/<handle>/reputation');
  });

  test('/moderation (redirects to dashboard when no authority)', async ({ page }) => {
    await signInViaSession(page);
    // Fresh user has reputation 0 — no moderation authority → redirected to /dashboard
    await page.goto(`${APP_BASE}/en/moderation`);
    await waitForPage(page);
    // The page will either show the moderation queue OR redirect to dashboard.
    // Either way we run axe on whatever rendered.
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSeriousCritical(results, '/moderation');
  });

  test('/moderation/appeals (redirects to dashboard when no authority)', async ({ page }) => {
    await signInViaSession(page);
    await page.goto(`${APP_BASE}/en/moderation/appeals`);
    await waitForPage(page);
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSeriousCritical(results, '/moderation/appeals');
  });

  test('/g/<slug>/members (only owner can access)', async ({ page }) => {
    test.skip(!slug, 'group not created in beforeAll');
    // The beforeAll user already owns `slug` — restore that session directly.
    await signInViaSession(page);
    await page.goto(`${APP_BASE}/en/g/${slug}/members`);
    await waitForPage(page);
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSeriousCritical(results, '/g/<slug>/members');
  });
});
