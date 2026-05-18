/**
 * Tests for the _appeal-form client component.
 *
 * Covers:
 * 1. Submit success — form calls submitAppealAction with correct args.
 * 2. Already-appealed error — action returning already_appealed shows inline error.
 * 3. Unauthenticated error — surfaces error message.
 * 4. RTL — dir="auto" on the form.
 * 5. Appeal button labelled correctly.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ── Hoisted mock variables ─────────────────────────────────────────────────────

const { mockSubmitAppealAction, mockRouterRefresh } = vi.hoisted(() => ({
  mockSubmitAppealAction: vi.fn(),
  mockRouterRefresh: vi.fn(),
}));

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/app/[locale]/(authenticated)/moderation/_appeal-actions.ts', () => ({
  submitAppealAction: mockSubmitAppealAction,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

// ── Import component after mocks ───────────────────────────────────────────────

import { AppealForm } from './_appeal-form.tsx';

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AppealForm — submit success', () => {
  it('calls submitAppealAction with targetType, targetId, and message', async () => {
    mockSubmitAppealAction.mockResolvedValue({ ok: true });

    render(
      <AppealForm
        targetType="post"
        targetId="post-uuid-123"
        submitLabel="Submit appeal"
        submittingLabel="Submitting..."
        placeholderText="Explain your appeal"
        cancelLabel="Cancel"
      />,
    );

    // Expand the form by clicking "Submit appeal" trigger first
    const triggerButton = screen.getByRole('button', { name: /appeal/i });
    fireEvent.click(triggerButton);

    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'This was incorrectly rejected.' } });

    const submitBtn = screen.getByTestId('appeal-submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSubmitAppealAction).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: 'post',
          targetId: 'post-uuid-123',
          message: 'This was incorrectly rejected.',
        }),
      );
    });
  });

  it('calls router.refresh on success', async () => {
    mockSubmitAppealAction.mockResolvedValue({ ok: true });

    render(
      <AppealForm
        targetType="post"
        targetId="post-uuid-123"
        submitLabel="Submit appeal"
        submittingLabel="Submitting..."
        placeholderText="Explain your appeal"
        cancelLabel="Cancel"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /appeal/i }));
    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'My appeal message.' } });
    fireEvent.click(screen.getByTestId('appeal-submit'));

    await waitFor(() => {
      expect(mockRouterRefresh).toHaveBeenCalled();
    });
  });
});

describe('AppealForm — already-appealed error', () => {
  it('shows error message when action returns already_appealed', async () => {
    mockSubmitAppealAction.mockResolvedValue({ ok: false, error: 'already_appealed' });

    render(
      <AppealForm
        targetType="post"
        targetId="post-uuid-456"
        submitLabel="Submit appeal"
        submittingLabel="Submitting..."
        placeholderText="Explain your appeal"
        cancelLabel="Cancel"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /appeal/i }));
    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Second appeal.' } });
    fireEvent.click(screen.getByTestId('appeal-submit'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert').textContent).toContain('already_appealed');
    });
  });
});

describe('AppealForm — unauthenticated error', () => {
  it('shows error message when unauthenticated', async () => {
    mockSubmitAppealAction.mockResolvedValue({ ok: false, error: 'unauthenticated' });

    render(
      <AppealForm
        targetType="comment"
        targetId="comment-uuid-789"
        submitLabel="Submit appeal"
        submittingLabel="Submitting..."
        placeholderText="Explain your appeal"
        cancelLabel="Cancel"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /appeal/i }));
    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Unfair rejection.' } });
    fireEvent.click(screen.getByTestId('appeal-submit'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('unauthenticated');
    });
  });
});

describe('AppealForm — RTL', () => {
  it('renders form with dir="auto"', async () => {
    render(
      <AppealForm
        targetType="post"
        targetId="post-uuid-rtl"
        submitLabel="Submit appeal"
        submittingLabel="Submitting..."
        placeholderText="Explain your appeal"
        cancelLabel="Cancel"
      />,
    );

    // Expand the form
    fireEvent.click(screen.getByRole('button', { name: /appeal/i }));
    await screen.findByRole('textbox');

    const form = document.querySelector('form[data-testid="appeal-form"]');
    expect(form).toHaveAttribute('dir', 'auto');
  });
});
