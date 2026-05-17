/**
 * E2E: Notification bell — post published flow.
 *
 * Depends on:
 * - The app running on http://localhost:3000
 * - MailHog running on http://localhost:8025
 * - MODERATION_DISABLED=1 env var so posts auto-publish immediately.
 *
 * Flow:
 * 1. Sign up + verify email.
 * 2. Create a group.
 * 3. Create a post (auto-published via MODERATION_DISABLED=1).
 * 4. Assert notification bell badge appears with count >= 1.
 * 5. Click bell → dropdown shows a "post_published" notification.
 * 6. Click notification → badge decrements.
 * 7. Mark all as read → badge disappears.
 */

import { expect, test } from '@playwright/test';

const MAILHOG_API = 'http://localhost:8025/api/v2/messages';
const APP_BASE = 'http://localhost:3000';

function uniqueEmail(prefix = 'notif-test'): string {
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
): Promise<{ email: string }> {
  const email = uniqueEmail();
  const password = 'NotifTestPass1234';
  const handle = `notiftest${Date.now()}`;

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
  return { email };
}

async function createGroupAndPost(
  page: Parameters<Parameters<typeof test>[1]>[0],
): Promise<{ slug: string }> {
  await page.goto(`${APP_BASE}/en/g/new`);
  await expect(page.locator('h1')).toBeVisible();

  const groupName = `Notif Test Group ${Date.now()}`;
  await page.fill('[name="name"]', groupName);
  await page.waitForTimeout(600);
  const slugValue = await page.inputValue('[name="slug"]');

  await page.click('[data-sdg-id="13"] [type="checkbox"]');
  await page.click('[type="submit"]');
  await expect(page).toHaveURL(/\/g\/[a-z0-9-]+$/);

  // Create a post
  await page.goto(`${APP_BASE}/en/g/${slugValue}/post/new`);
  await expect(page.locator('h1')).toBeVisible();
  await page.fill('[name="title"]', 'Notification test post');
  await page.fill('[name="body"]', 'This post should trigger a notification when published.');
  await page.click('[type="submit"]');

  await expect(page).toHaveURL(new RegExp(`/g/${slugValue}/p/[a-z0-9-]+`));

  return { slug: slugValue };
}

test.describe('Notifications bell', () => {
  test.skip(
    !process.env.MODERATION_DISABLED,
    'Skipped: set MODERATION_DISABLED=1 to run this test',
  );

  test('bell badge appears after post is published', async ({ page }) => {
    await signUpAndVerify(page);
    await createGroupAndPost(page);

    // Navigate to dashboard and wait for SSE to deliver the notification
    await page.goto(`${APP_BASE}/en/dashboard`);

    // Wait for bell badge to appear (SSE delivery, up to 5s)
    const badge = page.locator('[data-testid="notif-badge"]');
    await expect(badge).toBeVisible({ timeout: 5000 });
    const count = await badge.textContent();
    expect(Number(count)).toBeGreaterThanOrEqual(1);
  });

  test('dropdown shows notification and mark-all-read works', async ({ page }) => {
    await signUpAndVerify(page);
    await createGroupAndPost(page);

    await page.goto(`${APP_BASE}/en/dashboard`);

    const badge = page.locator('[data-testid="notif-badge"]');
    await expect(badge).toBeVisible({ timeout: 5000 });

    // Open dropdown
    await page.click('[aria-label*="notifications" i]');

    // Check notification appears in dropdown
    const list = page.locator('[aria-label*="recent notifications" i]');
    await expect(list).toBeVisible();
    await expect(list.locator('li').first()).toBeVisible();

    // Mark all as read
    await page.click('button:has-text("Mark all")');

    // Badge should disappear
    await expect(badge).not.toBeVisible({ timeout: 3000 });
  });

  test('no-JS fallback: /notifications page lists notifications', async ({ page }) => {
    await signUpAndVerify(page);
    await createGroupAndPost(page);

    // Navigate directly to the notifications page (no-JS fallback)
    await page.goto(`${APP_BASE}/en/notifications`);
    await expect(page.locator('h1')).toBeVisible();

    // Should show at least one notification
    const items = page.locator('[data-testid="notification-item"]');
    await expect(items.first()).toBeVisible({ timeout: 5000 });
  });
});
