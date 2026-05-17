import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './dialog.tsx';

function TestDialog({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger asChild>
        <button type="button">Open dialog</button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Test Dialog</DialogTitle>
        <DialogDescription>A dialog for testing.</DialogDescription>
        <p>Dialog body content</p>
      </DialogContent>
    </Dialog>
  );
}

describe('Dialog', () => {
  it('is closed by default — trigger button is visible, content is not', () => {
    render(<TestDialog />);
    expect(screen.getByRole('button', { name: 'Open dialog' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens when the trigger is clicked', async () => {
    const user = userEvent.setup();
    render(<TestDialog />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByText('Test Dialog')).toBeTruthy();
      expect(screen.getByText('Dialog body content')).toBeTruthy();
    });
  });

  it('closes when Escape is pressed (keyboard close)', async () => {
    const user = userEvent.setup();
    render(<TestDialog />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('closes when the built-in close button is clicked', async () => {
    const user = userEvent.setup();
    render(<TestDialog />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    // DialogContent renders a close button with "Close" SR text
    const closeBtn = screen.getByRole('button', { name: /close/i });
    await user.click(closeBtn);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('focus is trapped inside when open — Tab stays inside dialog', async () => {
    const user = userEvent.setup();
    render(<TestDialog />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    // Tab through elements; focus should remain within the dialog
    await user.tab();
    const focused = document.activeElement;
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(focused)).toBe(true);
  });

  it('renders with defaultOpen=true', async () => {
    render(<TestDialog defaultOpen />);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
    });
  });
});
