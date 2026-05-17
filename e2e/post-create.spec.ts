/**
 * E2E: Post creation flow.
 *
 * Depends on:
 * - The app running on http://localhost:3000
 * - MailHog running on http://localhost:8025
 * - A fresh / clean database
 *
 * Flow:
 * 1. Sign up a fresh user and verify via MailHog.
 * 2. Create a group at /g/new.
 * 3. Navigate to /g/<slug>/post/new.
 * 4. Fill title, body, SDG selection.
 * 5. Submit.
 * 6. Assert redirect to /g/<slug>/p/<id> showing pending_ai status.
 */

import { expect, test } from '@playwright/test';

const MAILHOG_API = 'http://localhost:8025/api/v2/messages';
const APP_BASE = 'http://localhost:3000';

function uniqueEmail(prefix = 'user'): string {
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

/** Sign up a fresh user, verify email via MailHog, and return the signed-in state. */
async function signUpAndVerify(page: Parameters<Parameters<typeof test>[1]>[0]): Promise<void> {
  const email = uniqueEmail('post-test');
  const password = 'PostTestPass1234';
  const handle = `posttest${Date.now()}`;

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

  // Should land on dashboard
  await expect(page).toHaveURL(/\/(en|ar|fr|es|zh|hi|pt|ru|sw)\/?$/);
}

/** Create a group and return its slug. */
async function createGroup(page: Parameters<Parameters<typeof test>[1]>[0]): Promise<string> {
  await page.goto(`${APP_BASE}/en/g/new`);
  await expect(page.locator('h1')).toBeVisible();

  const groupName = `Post Test Group ${Date.now()}`;
  await page.fill('[name="name"]', groupName);

  // Wait for slug to auto-fill
  await page.waitForTimeout(600);
  const slugValue = await page.inputValue('[name="slug"]');

  // Select SDG 13 (Climate Action) as primary
  await page.click('[data-sdg-id="13"] [type="checkbox"]');

  // Submit
  await page.click('[type="submit"]');

  // Should redirect to /g/<slug>
  await expect(page).toHaveURL(/\/g\/[a-z0-9-]+$/);

  return slugValue;
}

test.describe('Post creation', () => {
  test('sign up → create group → create post → land on post detail showing pending_ai', async ({
    page,
  }) => {
    await signUpAndVerify(page);

    const slug = await createGroup(page);

    // Navigate to the post creation page
    await page.goto(`${APP_BASE}/en/g/${slug}/post/new`);
    await expect(page.locator('h1')).toBeVisible();

    // Fill the title
    await page.fill('[name="title"]', 'My first test post about climate action');

    // Fill the body
    const bodyText =
      '## Climate Action\n\nWe need urgent action on climate change. **Bold steps** are required.';
    await page.fill('[name="body"]', bodyText);

    // SDG 13 should already be selected (inherited from group defaults)
    const sdg13Checkbox = page.locator('[data-sdg-id="13"] [type="checkbox"]');
    await expect(sdg13Checkbox).toBeChecked();

    // Submit the form
    await page.click('[type="submit"]');

    // Should redirect to /g/<slug>/p/<id>
    await expect(page).toHaveURL(new RegExp(`/g/${slug}/p/[a-z0-9-]+`));

    // Post detail page should show pending_ai status
    await expect(page.locator('[data-post-status]')).toContainText(/pending.ai/i);
  });

  test('navigating to /g/<slug>/post/new without auth redirects to signin', async ({ page }) => {
    // Use a fake slug — auth check happens before group lookup
    await page.goto(`${APP_BASE}/en/g/some-group/post/new`);

    // Should redirect to signin
    await expect(page).toHaveURL(/\/signin/);
  });
});
