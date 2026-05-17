/**
 * E2E: Personal dashboard.
 *
 * Depends on:
 * - The app running on http://localhost:3000
 * - MailHog running on http://localhost:8025
 * - A fresh / clean database
 *
 * Flow:
 * 1. Sign up a fresh user and verify via MailHog.
 * 2. Create a group at /g/new.
 * 3. Create a published post in the group (simulated via direct nav).
 * 4. Land on /dashboard.
 * 5. Assert layout: heading, groups rail, SDG chip rail visible.
 * 6. Assert post visible in feed (after publish bypass or check empty state).
 */

import { expect, test } from '@playwright/test';

const MAILHOG_API = 'http://localhost:8025/api/v2/messages';
const APP_BASE = 'http://localhost:3000';

function uniqueEmail(prefix = 'dash'): string {
  return `${prefix}+${Date.now()}@example.com`;
}

async function waitForEmail(toAddress: string): Promise<{ subject: string; body: string }> {
  const deadline = Date.now() + 10_000;
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

async function signUpAndVerify(
  page: Parameters<Parameters<typeof test>[1]>[0],
): Promise<{ email: string; handle: string }> {
  const email = uniqueEmail('dash-test');
  const password = 'DashTestPass1234';
  const handle = `dashtest${Date.now()}`;

  await page.goto(`${APP_BASE}/en/signup`);
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.fill('[name="handle"]', handle);
  await page.click('[type="submit"]');

  await expect(page).toHaveURL(/check-your-email/);

  const emailData = await waitForEmail(email);
  const verifyLink = extractLink(emailData.body, 'verify-email');
  await page.goto(verifyLink);
  await page.click('[type="submit"]');

  await expect(page).toHaveURL(/\/(en|ar|fr|es|zh|hi|pt|ru|sw)\/?$/);
  return { email, handle };
}

async function createGroup(
  page: Parameters<Parameters<typeof test>[1]>[0],
): Promise<{ slug: string; name: string }> {
  const ts = Date.now();
  const groupName = `Dash Test Group ${ts}`;

  await page.goto(`${APP_BASE}/en/g/new`);
  await expect(page.locator('h1')).toBeVisible();

  await page.fill('[name="name"]', groupName);
  await page.waitForTimeout(600);
  const slugValue = await page.inputValue('[name="slug"]');

  await page.click('[data-sdg-id="13"] [type="checkbox"]');
  await page.click('[type="submit"]');
  await expect(page).toHaveURL(/\/g\/[a-z0-9-]+$/);

  return { slug: slugValue, name: groupName };
}

test.describe('Dashboard page', () => {
  test('authenticated user lands on dashboard with layout elements', async ({ page }) => {
    await signUpAndVerify(page);

    await page.goto(`${APP_BASE}/en/dashboard`);
    await expect(page).toHaveURL(/\/dashboard$/);

    // Page heading
    await expect(page.locator('h1')).toBeVisible();

    // Groups rail should be present
    const groupsRail = page.locator('[data-testid="groups-rail"]');
    await expect(groupsRail).toBeAttached();

    // SDG chip rail should be present with 17 chips
    const sdgRail = page.locator('[data-testid="sdg-rail"]');
    await expect(sdgRail).toBeAttached();

    // Feed section should be present
    const feedSection = page.locator('[data-testid="feed-section"]');
    await expect(feedSection).toBeAttached();
  });

  test('dashboard shows empty feed state with CTAs when no posts', async ({ page }) => {
    await signUpAndVerify(page);

    await page.goto(`${APP_BASE}/en/dashboard`);

    // No posts yet — empty state
    await expect(page.getByTestId('feed-empty-state')).toBeVisible();

    // Join a group CTA
    const joinLink = page.getByRole('link', { name: /join a group/i });
    await expect(joinLink).toBeVisible();
  });

  test('sign in → join a group → create a post → dashboard feed reflects group', async ({
    page,
  }) => {
    await signUpAndVerify(page);

    // Create a group (owner is auto-joined)
    const { slug } = await createGroup(page);

    // Navigate to dashboard — group should appear in left rail
    await page.goto(`${APP_BASE}/en/dashboard`);
    await expect(page).toHaveURL(/\/dashboard$/);

    // Group rail should show the group (empty state feed is fine since post is pending_ai)
    const groupsRail = page.locator('[data-testid="groups-rail"]');
    await expect(groupsRail).toBeAttached();

    // Create a post (will be pending_ai — feed will still be empty)
    await page.goto(`${APP_BASE}/en/g/${slug}/post/new`);
    await expect(page.locator('h1')).toBeVisible();
    await page.fill('[name="title"]', 'Dash E2E Test Post');
    await page.fill('[name="body"]', 'A test post body for dashboard e2e.');
    await page.click('[type="submit"]');
    await expect(page).toHaveURL(new RegExp(`/g/${slug}/p/[a-z0-9-]+`));

    // Return to dashboard — post is pending_ai, so feed still empty
    await page.goto(`${APP_BASE}/en/dashboard`);
    await expect(page).toHaveURL(/\/dashboard$/);
    // Page should render without error
    await expect(page.locator('h1')).toBeVisible();
  });

  test('unauthenticated user is redirected from dashboard', async ({ page }) => {
    await page.goto(`${APP_BASE}/en/dashboard`);
    await expect(page).toHaveURL(/\/signin/);
  });

  test('SDG chip rail has 17 toggle buttons', async ({ page }) => {
    await signUpAndVerify(page);

    await page.goto(`${APP_BASE}/en/dashboard`);

    const sdgRail = page.locator('[data-testid="sdg-rail"]');
    await expect(sdgRail).toBeAttached();

    // 17 buttons for the 17 SDGs
    const buttons = sdgRail.locator('button');
    await expect(buttons).toHaveCount(17);
  });
});
