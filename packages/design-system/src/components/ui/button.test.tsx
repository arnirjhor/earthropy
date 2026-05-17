import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button.tsx';

describe('Button', () => {
  it('renders with default variant classes consuming design tokens', () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toBeTruthy();
    // Default variant should have bg-[var(--color-text)] or similar token-based class
    const cls = btn.className;
    // Must reference a CSS variable token class (not a raw hex)
    expect(cls).toMatch(/bg-\[var\(--color-/);
  });

  it('renders the outline variant', () => {
    render(<Button variant="outline">Cancel</Button>);
    const btn = screen.getByRole('button', { name: 'Cancel' });
    expect(btn.className).toMatch(/border/);
  });

  it('renders the ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole('button', { name: 'Ghost' });
    expect(btn).toBeTruthy();
  });

  it('renders the destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>);
    const btn = screen.getByRole('button', { name: 'Delete' });
    expect(btn).toBeTruthy();
  });

  it('applies font-mono class for Field Record label treatment', () => {
    render(<Button>Action</Button>);
    const btn = screen.getByRole('button', { name: 'Action' });
    // Button labels use Plex Mono per spec
    expect(btn.className).toMatch(/font-mono/);
  });

  it('triggers onClick when clicked', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<Button onClick={handler}>Click me</Button>);
    await user.click(screen.getByRole('button', { name: 'Click me' }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('triggers onClick with Enter key', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<Button onClick={handler}>Enter me</Button>);
    screen.getByRole('button', { name: 'Enter me' }).focus();
    await user.keyboard('{Enter}');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('triggers onClick with Space key', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<Button onClick={handler}>Space me</Button>);
    screen.getByRole('button', { name: 'Space me' }).focus();
    await user.keyboard(' ');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(
      <Button disabled onClick={handler}>
        Disabled
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Disabled' });
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(handler).not.toHaveBeenCalled();
  });

  it('renders size sm', () => {
    render(<Button size="sm">Small</Button>);
    const btn = screen.getByRole('button', { name: 'Small' });
    expect(btn).toBeTruthy();
  });

  it('renders size lg', () => {
    render(<Button size="lg">Large</Button>);
    const btn = screen.getByRole('button', { name: 'Large' });
    expect(btn).toBeTruthy();
  });

  it('renders as a custom element via asChild', () => {
    render(
      <Button asChild>
        <a href="/about">Link button</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Link button' });
    expect(link).toBeTruthy();
    expect(link.tagName).toBe('A');
  });
});
