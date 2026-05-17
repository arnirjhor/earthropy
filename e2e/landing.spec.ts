import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en');
  });

  test('renders the hero headline', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
  });

  test('shows the 17-cell SDG color bar', async ({ page }) => {
    const cells = page.locator('.sdg-color-bar__cell');
    await expect(cells).toHaveCount(17);
  });

  test('passes axe a11y check (no serious/critical)', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    const violations = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(violations).toHaveLength(0);
  });
});
