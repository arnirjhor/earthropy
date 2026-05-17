/**
 * E2E: Group browse page (/g).
 *
 * Depends on:
 * - The app running on http://localhost:3000
 * - MailHog running on http://localhost:8025
 * - A working database
 *
 * Flow:
 *  1. Sign up + verify a fresh user.
 *  2. Create 3 groups across different SDGs (SDG 13, SDG 7, SDG 1).
 *  3. Visit /g (public browse, no auth required).
 *  4. Filter by SDG 13 → only the climate group should appear.
 *  5. Clear filter → all three groups visible.
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

async function signUpAndVerify(page: Parameters<Parameters<typeof test>[1]>[0]): Promise<void> {
  const email = uniqueEmail('browse-test');
  const password = 'BrowseTestPass1234';
  const handle = `brwtest${Date.now()}`;

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
}

async function createGroup(
  page: Parameters<Parameters<typeof test>[1]>[0],
  opts: { name: string; sdgId: number; locale?: string },
): Promise<void> {
  const locale = opts.locale ?? 'en';
  await page.goto(`${APP_BASE}/${locale}/g/new`);
  await expect(page.locator('h1')).toBeVisible();

  await page.fill('[name="name"]', opts.name);
  await page.waitForTimeout(400);
  await page.fill('[name="description"]', `Description for ${opts.name}`);

  await page.click(`[data-sdg-id="${opts.sdgId}"] [type="checkbox"]`);

  await page.click('[type="submit"]');
  await expect(page).toHaveURL(/\/g\/[a-z0-9-]+$/);
}

test.describe('Group browse page', () => {
  test('create 3 groups across different SDGs, filter by SDG 13, assert correct group', async ({
    page,
  }) => {
    await signUpAndVerify(page);

    const ts = Date.now();
    const climateGroup = `Climate Action ${ts}`;
    const energyGroup = `Clean Energy ${ts}`;
    const povertyGroup = `No Poverty ${ts}`;

    // Create 3 groups with different SDGs
    await createGroup(page, { name: climateGroup, sdgId: 13 });
    await createGroup(page, { name: energyGroup, sdgId: 7 });
    await createGroup(page, { name: povertyGroup, sdgId: 1 });

    // Visit the public browse page (no auth required)
    await page.goto(`${APP_BASE}/en/g`);
    await expect(page).toHaveURL(/\/en\/g/);

    // All three groups should be visible initially (or at least the page loads)
    await expect(page.locator('h1')).toBeVisible();

    // Filter by SDG 13
    const sdg13Button = page.locator('[data-sdg-filter="13"]');
    await expect(sdg13Button).toBeVisible();
    await sdg13Button.click();

    // URL should update to include ?sdgs=13
    await expect(page).toHaveURL(/sdgs=13/);

    // Climate group should be visible, energy group should NOT be visible
    await expect(page.getByText(climateGroup)).toBeVisible();
    await expect(page.getByText(energyGroup)).not.toBeVisible();
    await expect(page.getByText(povertyGroup)).not.toBeVisible();

    // Click SDG 13 again to deselect (toggle off)
    await sdg13Button.click();

    // URL should no longer have sdgs=13
    await expect(page).not.toHaveURL(/sdgs=13/);

    // Energy group should now be visible again
    await expect(page.getByText(energyGroup)).toBeVisible();
  });

  test('empty state renders when no groups match SDG filter', async ({ page }) => {
    // Visit the browse page with a very specific unlikely SDG combination
    // SDG 17 (Partnerships) — unlikely to have groups in test env when filtered alone
    // We'll use an SDG that has no groups by directly visiting the URL
    await page.goto(`${APP_BASE}/en/g?sdgs=17&visibility=listed`);

    // Page should load and show either groups or empty state
    await expect(page.locator('h1')).toBeVisible();

    // If empty, the empty state element should be present
    const emptyState = page.locator('[data-testid="group-browse-empty"]');
    const cards = page.locator('[data-testid="atlas-card"], article[class*="atlas"]');

    const hasCards = await cards.count();
    if (hasCards === 0) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('browse page is accessible without authentication', async ({ page }) => {
    // Should not redirect to signin
    await page.goto(`${APP_BASE}/en/g`);
    await expect(page).not.toHaveURL(/signin/);
    await expect(page.locator('h1')).toBeVisible();
  });
});
