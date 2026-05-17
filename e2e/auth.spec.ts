/**
 * E2E auth flow tests.
 *
 * Depends on:
 * - The app running on http://localhost:3000
 * - MailHog running on http://localhost:8025
 * - A fresh database (or unique emails per run)
 *
 * The Playwright config for these tests lives in playwright.auth.config.ts
 * (or, when running in full-suite mode, the baseURL is http://localhost:3000).
 */

import { expect, test } from '@playwright/test';

// ── Helpers ────────────────────────────────────────────────────────────────────

const MAILHOG_API = 'http://localhost:8025/api/v2/messages';

/** Poll MailHog until an email for `toAddress` arrives (max 10s). */
async function waitForEmail(toAddress: string): Promise<{
  subject: string;
  body: string;
}> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const res = await fetch(MAILHOG_API);
    const data = (await res.json()) as {
      items: Array<{
        Content: {
          Headers: { Subject: string[]; To: string[] };
          Body: string;
        };
        Raw: { To: string[] };
      }>;
    };

    const msg = data.items.find((m) =>
      m.Raw.To.some((addr) => addr.toLowerCase().includes(toAddress.toLowerCase())),
    );

    if (msg) {
      return {
        subject: msg.Content.Headers.Subject?.[0] ?? '',
        body: msg.Content.Body,
      };
    }

    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for email to ${toAddress}`);
}

/** Extract a URL from an email body that contains `pathFragment`. */
function extractLink(body: string, pathFragment: string): string {
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/https?:\/\/\S+/g);
    if (match) {
      const url = match.find((u) => u.includes(pathFragment));
      if (url) return url.replace(/[>=]$/, '');
    }
  }
  // Try the whole body as one string
  const allMatches = body.match(/https?:\/\/\S+/g) ?? [];
  const found = allMatches.find((u) => u.includes(pathFragment));
  if (found) return found.replace(/[>=]$/, '');
  throw new Error(`Could not find link containing "${pathFragment}" in email body`);
}

function uniqueEmail(prefix = 'user'): string {
  return `${prefix}+${Date.now()}@example.com`;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Sign-up → verify → sign-in flow', () => {
  test('full round-trip: sign up, verify email via MailHog, sign in, land on dashboard', async ({
    page,
  }) => {
    const email = uniqueEmail('signup');
    const password = 'SecurePass1234';

    // 1. Navigate to sign-up
    await page.goto('/en/signup');
    await expect(page.locator('h1')).toBeVisible();

    // 2. Fill and submit the sign-up form
    await page.fill('[name="email"]', email);
    await page.fill('[name="password"]', password);
    await page.fill('[name="handle"]', `handle${Date.now()}`);
    await page.click('[type="submit"]');

    // 3. Should land on check-your-email page
    await expect(page).toHaveURL(/check-your-email/);

    // 4. Fetch the verification email from MailHog
    const emailData = await waitForEmail(email);
    const verifyLink = extractLink(emailData.body, 'verify-email');

    // 5. Navigate to the verification interstitial
    await page.goto(verifyLink);
    await expect(page.locator('h1')).toBeVisible();

    // 6. Submit the confirmation form (GET-interstitial pattern)
    await page.click('[type="submit"]');

    // 7. Should land on dashboard (authenticated)
    await expect(page).toHaveURL(/\/(en|ar|fr|es|zh|hi|pt|ru|sw)\/?$/);
    // The dashboard shows a "Welcome" heading
    await expect(page.locator('h1')).toContainText(/welcome/i);
  });
});

test.describe('Magic-link sign-in', () => {
  test('request magic link, click via MailHog, sign in', async ({ page, context }) => {
    const email = uniqueEmail('magic');
    const password = 'MagicPass5678';

    // Pre-create and verify a user account
    await page.goto('/en/signup');
    await page.fill('[name="email"]', email);
    await page.fill('[name="password"]', password);
    await page.fill('[name="handle"]', `magichandle${Date.now()}`);
    await page.click('[type="submit"]');

    const signupEmail = await waitForEmail(email);
    const verifyLink = extractLink(signupEmail.body, 'verify-email');
    await page.goto(verifyLink);
    await page.click('[type="submit"]');

    // Sign out first
    await page.goto('/en/signout');

    // Now request a magic link
    await page.goto('/en/signin');
    // Click "magic link" tab
    await page.click('[data-value="magic"]');
    await page.fill('[name="email"]', email);
    await page.click('[type="submit"]');

    await expect(page).toHaveURL(/check-your-email/);

    const magicEmail = await waitForEmail(email);
    const magicLink = extractLink(magicEmail.body, 'signin/magic');

    // Interstitial: GET does NOT consume the token
    const interstitialPage = await context.newPage();
    await interstitialPage.goto(magicLink);
    await expect(interstitialPage.locator('h1')).toBeVisible();

    // POST confirms sign-in
    await interstitialPage.click('[type="submit"]');
    await expect(interstitialPage).toHaveURL(/\/(en|ar|fr|es|zh|hi|pt|ru|sw)\/?$/);
    await expect(interstitialPage.locator('h1')).toContainText(/welcome/i);
  });
});

test.describe('Password reset round-trip', () => {
  test('request reset, click via MailHog, set new password, sign in', async ({ page }) => {
    const email = uniqueEmail('reset');
    const password = 'OriginalPass9876';
    const newPassword = 'NewResetPass1234';

    // Pre-create and verify account
    await page.goto('/en/signup');
    await page.fill('[name="email"]', email);
    await page.fill('[name="password"]', password);
    await page.fill('[name="handle"]', `resethandle${Date.now()}`);
    await page.click('[type="submit"]');

    const signupEmail = await waitForEmail(email);
    const verifyLink = extractLink(signupEmail.body, 'verify-email');
    await page.goto(verifyLink);
    await page.click('[type="submit"]');

    // Navigate to forgot-password
    await page.goto('/en/forgot-password');
    await page.fill('[name="email"]', email);
    await page.click('[type="submit"]');

    await expect(page).toHaveURL(/check-your-email/);

    const resetEmail = await waitForEmail(email);
    const resetLink = extractLink(resetEmail.body, 'reset-password');

    await page.goto(resetLink);
    await expect(page.locator('h1')).toBeVisible();

    await page.fill('[name="password"]', newPassword);
    await page.click('[type="submit"]');

    // Should be signed in on dashboard
    await expect(page).toHaveURL(/\/(en|ar|fr|es|zh|hi|pt|ru|sw)\/?$/);

    // Sign out and sign back in with new password
    await page.goto('/en/signout');
    await page.goto('/en/signin');
    await page.fill('[name="email"]', email);
    await page.fill('[name="password"]', newPassword);
    await page.click('[type="submit"]');

    await expect(page).toHaveURL(/\/(en|ar|fr|es|zh|hi|pt|ru|sw)\/?$/);
  });
});

test.describe('Wrong password enumeration safety', () => {
  test('same generic error whether email exists or not', async ({ page }) => {
    // Sign in with a non-existent email
    await page.goto('/en/signin');
    await page.fill('[name="email"]', 'ghost@nonexistent.example.com');
    await page.fill('[name="password"]', 'anypassword');
    await page.click('[type="submit"]');

    const ghostError = await page.locator('[role="alert"], [data-error="form"]').textContent();

    // Sign in with an existing email (created inline here with wrong password)
    const existingEmail = uniqueEmail('wrongpw');
    // Create the user first
    await page.goto('/en/signup');
    await page.fill('[name="email"]', existingEmail);
    await page.fill('[name="password"]', 'CorrectPass1234');
    await page.fill('[name="handle"]', `wrongpwhandle${Date.now()}`);
    await page.click('[type="submit"]');

    await page.goto('/en/signin');
    await page.fill('[name="email"]', existingEmail);
    await page.fill('[name="password"]', 'wrongpassword');
    await page.click('[type="submit"]');

    const existsError = await page.locator('[role="alert"], [data-error="form"]').textContent();

    // Both errors must be byte-identical (no enumeration)
    expect(ghostError?.trim()).toBe(existsError?.trim());
  });
});

test.describe('Magic-link interstitial prevents pre-fetch consumption', () => {
  test('GET on magic link URL does not consume the token', async ({ page, context }) => {
    const email = uniqueEmail('prefetch');
    const password = 'PrefetchPass1234';

    // Create and verify account
    await page.goto('/en/signup');
    await page.fill('[name="email"]', email);
    await page.fill('[name="password"]', password);
    await page.fill('[name="handle"]', `prefetchhandle${Date.now()}`);
    await page.click('[type="submit"]');

    const signupEmail = await waitForEmail(email);
    const verifyLink = extractLink(signupEmail.body, 'verify-email');
    await page.goto(verifyLink);
    await page.click('[type="submit"]');

    await page.goto('/en/signout');

    // Request magic link
    await page.goto('/en/signin');
    await page.click('[data-value="magic"]');
    await page.fill('[name="email"]', email);
    await page.click('[type="submit"]');

    const magicEmail = await waitForEmail(email);
    const magicLink = extractLink(magicEmail.body, 'signin/magic');

    // Simulate a pre-fetcher: GET the link without clicking the confirm button
    const prefetchPage = await context.newPage();
    await prefetchPage.goto(magicLink);
    // Just the interstitial renders — no session created yet
    await expect(prefetchPage.locator('[type="submit"]')).toBeVisible();
    await prefetchPage.close();

    // The real user navigates and submits — the token is still valid
    const realPage = await context.newPage();
    await realPage.goto(magicLink);
    await realPage.click('[type="submit"]');
    await expect(realPage).toHaveURL(/\/(en|ar|fr|es|zh|hi|pt|ru|sw)\/?$/);
    await realPage.close();
  });
});
