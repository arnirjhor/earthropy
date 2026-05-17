/**
 * Unit tests for PostCreateForm.
 *
 * Tests:
 * 1. Preview toggle renders sanitized markdown (XSS stripped).
 * 2. Char counter reflects body length.
 * 3. SDG multi-select defaults to the group's SDG set with the primary pre-selected.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PostCreateForm } from './_form.tsx';

// ── Mock server action ─────────────────────────────────────────────────────────

vi.mock('@/app/[locale]/(authenticated)/p/_actions.ts', () => ({
  createPostAction: vi.fn().mockResolvedValue({ ok: false, error: 'mocked' }),
}));

// ── Mock next/navigation (useRouter) ──────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/en/g/test-group/post/new',
  useSearchParams: () => new URLSearchParams(),
}));

// ── Mock next-intl (not wired in tests) ────────────────────────────────────────

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

// ── Mock marked + DOMPurify so tests are deterministic ─────────────────────────

vi.mock('marked', () => ({
  marked: (md: string) => `<p>${md}</p>`,
}));

vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) => html.replace(/<script[\s\S]*?<\/script>/gi, ''),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const BODY_MAX = 50_000;

const defaultProps = {
  groupId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  groupSlug: 'test-group',
  locale: 'en',
  groupSdgIds: [13, 7] as number[],
  groupPrimarySdgId: 13 as number,
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('PostCreateForm', () => {
  it('renders the title, body, and submit fields', () => {
    render(<PostCreateForm {...defaultProps} />);
    expect(screen.getByRole('textbox', { name: /title/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /body/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create post/i })).toBeInTheDocument();
  });

  it('char counter shows correct remaining count and updates on input', async () => {
    const user = userEvent.setup();
    render(<PostCreateForm {...defaultProps} />);

    const textarea = screen.getByRole('textbox', { name: /body/i });

    // Initial state: full limit available
    expect(screen.getByText(new RegExp(`${BODY_MAX}`, 'i'))).toBeInTheDocument();

    // Type some text
    await user.type(textarea, 'Hello world');
    const remaining = BODY_MAX - 'Hello world'.length;
    expect(screen.getByText(new RegExp(`${remaining}`, 'i'))).toBeInTheDocument();
  });

  it('preview tab shows rendered markdown output', async () => {
    const user = userEvent.setup();
    render(<PostCreateForm {...defaultProps} />);

    const textarea = screen.getByRole('textbox', { name: /body/i });
    await user.type(textarea, '**bold**');

    // Click the Preview tab
    const previewTab = screen.getByRole('tab', { name: /preview/i });
    await user.click(previewTab);

    // Preview pane should contain rendered content (from our mock: <p>**bold**</p>)
    await waitFor(() => {
      const preview = screen.getByTestId('markdown-preview');
      expect(preview).toBeInTheDocument();
    });
  });

  it('preview sanitizes XSS — script tags are stripped', async () => {
    const user = userEvent.setup();
    render(<PostCreateForm {...defaultProps} />);

    const textarea = screen.getByRole('textbox', { name: /body/i });
    await user.type(textarea, '<script>alert("xss")</script>safe text');

    const previewTab = screen.getByRole('tab', { name: /preview/i });
    await user.click(previewTab);

    await waitFor(() => {
      const preview = screen.getByTestId('markdown-preview');
      // Script tag should be gone
      expect(preview.innerHTML).not.toContain('<script>');
      // But harmless content remains
      expect(preview.innerHTML).toContain('safe text');
    });
  });

  it('SDG multi-select defaults to group SDG ids with group primary pre-selected', () => {
    render(<PostCreateForm {...defaultProps} />);

    // SDG 13 (group primary) should be checked
    const sdg13Checkbox = screen.getByRole('checkbox', { name: /SDG 13/i });
    expect(sdg13Checkbox).toBeChecked();

    // SDG 7 (additional group SDG) should be checked
    const sdg7Checkbox = screen.getByRole('checkbox', { name: /SDG 7/i });
    expect(sdg7Checkbox).toBeChecked();

    // SDG 1 (not in group SDGs) should not be checked
    const sdg1Checkbox = screen.getByRole('checkbox', { name: /SDG 1:/i });
    expect(sdg1Checkbox).not.toBeChecked();
  });

  it('SDG 13 is the primary SDG (radio checked)', () => {
    render(<PostCreateForm {...defaultProps} />);

    // The primary radio for SDG 13 should be checked
    const primary13Radio = screen.getByRole('radio', { name: /primary SDG 13/i });
    expect(primary13Radio).toBeChecked();
  });
});
