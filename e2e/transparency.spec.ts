/**
 * E2E: Transparency page (/transparency).
 *
 * Depends on:
 * - The app running on http://localhost:3000
 * - A working database (may or may not have moderation data)
 *
 * Only asserts that section headings render and the moderation policy link
 * is present — data content varies by environment.
 */
import { expect, test } from '@playwright/test';

const APP_BASE = 'http://localhost:3000';

test.describe('Transparency page', () => {
  test('renders without authentication', async ({ page }) => {
    await page.goto(`${APP_BASE}/en/transparency`);
    await expect(page).not.toHaveURL(/signin/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('renders page heading "Transparency"', async ({ page }) => {
    await page.goto(`${APP_BASE}/en/transparency`);
    await expect(page.locator('h1')).toHaveText('Transparency');
  });

  test('renders "Read our moderation policy" link', async ({ page }) => {
    await page.goto(`${APP_BASE}/en/transparency`);
    const link = page.getByRole('link', { name: /moderation policy/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/docs/moderation-policy.md');
  });

  test('renders section headings or empty state', async ({ page }) => {
    await page.goto(`${APP_BASE}/en/transparency`);

    const emptyState = page.getByTestId('transparency-empty');
    const verdictSection = page.getByTestId('section-last-30-days');

    const hasEmpty = await emptyState.isVisible().catch(() => false);
    const hasData = await verdictSection.isVisible().catch(() => false);

    // Must render one or the other
    expect(hasEmpty || hasData).toBe(true);

    // If data is present, the remaining sections must also be present
    if (hasData) {
      await expect(page.getByTestId('section-by-category')).toBeVisible();
      await expect(page.getByTestId('section-appeals')).toBeVisible();
      await expect(page.getByTestId('section-providers')).toBeVisible();
    }
  });
});
