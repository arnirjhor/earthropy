/**
 * E2E: Group creation flow.
 *
 * Depends on:
 * - The app running on http://localhost:3000
 * - MailHog running on http://localhost:8025
 * - A fresh / clean database
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
  // line-by-line fallback
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/https?:\/\/\S+/g);
    if (match) {
      const url = match.find((u) => u.includes(pathFragment));
      if (url) return url.replace(/[>=]$/, '');
    }
  }
  throw new Error(`Could not find link containing "${pathFragment}" in email body`);
}

/** Sign up a fresh user, verify email via MailHog, and return to a signed-in state. */
async function signUpAndVerify(page: Parameters<Parameters<typeof test>[1]>[0]): Promise<void> {
  const email = uniqueEmail('group-test');
  const password = 'GroupTestPass1234';
  const handle = `grptest${Date.now()}`;

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

test.describe('Group creation', () => {
  test('create a group via /g/new and land on its page', async ({ page }) => {
    await signUpAndVerify(page);

    // Navigate to the create group page
    await page.goto(`${APP_BASE}/en/g/new`);
    await expect(page.locator('h1')).toBeVisible();

    const groupName = `Climate Alliance ${Date.now()}`;

    // Fill name
    await page.fill('[name="name"]', groupName);

    // Wait for slug to auto-fill
    await page.waitForTimeout(600);
    const slugValue = await page.inputValue('[name="slug"]');
    expect(slugValue).toMatch(/climate-alliance/);

    // Fill description
    await page.fill('[name="description"]', 'A test group focused on climate action.');

    // Select SDG 13 (Climate Action) — click the checkbox
    await page.click('[data-sdg-id="13"] [type="checkbox"]');

    // Select SDG 7 (Affordable and Clean Energy)
    await page.click('[data-sdg-id="7"] [type="checkbox"]');

    // SDG 13 should be primary (first selected); confirm or click its radio
    const sdg13Radio = page.locator('[data-sdg-id="13"] [type="radio"]');
    if ((await sdg13Radio.count()) > 0) {
      await sdg13Radio.click();
    }

    // Set visibility to public (default)
    const publicRadio = page.locator('[name="visibility"][value="public"]');
    if (await publicRadio.isVisible()) {
      await publicRadio.click();
    }

    // Submit
    await page.click('[type="submit"]');

    // Should redirect to /g/<slug>
    await expect(page).toHaveURL(/\/g\/[a-z0-9-]+$/);

    // Page should render the group name
    await expect(page.locator('h1, [data-group-name]')).toContainText(groupName);
  });
});
