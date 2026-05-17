/**
 * Unit tests for the MarkdownBody component.
 *
 * DOMPurify is not available in jsdom without extra setup so we mock it.
 * marked is mocked for determinism.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ── Mocks (declared before importing subject) ──────────────────────────────

vi.mock('marked', () => ({
  marked: (md: string) => `<p>${md}</p>`,
}));

vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) => html.replace(/<script[\s\S]*?<\/script>/gi, '[removed]'),
  },
}));

import { MarkdownBody } from './markdown.tsx';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('MarkdownBody', () => {
  it('renders markdown as html', () => {
    render(<MarkdownBody md="hello world" />);
    const el = screen.getByTestId('markdown-body');
    expect(el).toBeInTheDocument();
    expect(el.innerHTML).toContain('hello world');
  });

  it('strips script tags (XSS protection)', () => {
    render(<MarkdownBody md='<script>alert("xss")</script>safe' />);
    const el = screen.getByTestId('markdown-body');
    expect(el.innerHTML).not.toContain('<script>');
    expect(el.innerHTML).toContain('safe');
  });

  it('accepts a custom className', () => {
    render(<MarkdownBody md="text" className="custom-class" />);
    const el = screen.getByTestId('markdown-body');
    expect(el.classList.contains('custom-class')).toBe(true);
  });
});
