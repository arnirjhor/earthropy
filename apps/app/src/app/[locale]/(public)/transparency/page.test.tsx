/**
 * Unit tests for /transparency page.
 *
 * Mocks `_queries.ts` to avoid hitting the database. Tests:
 *  1. Correct numbers render when data is present.
 *  2. Empty state when no decisions exist.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// Mock the queries module before importing the page
vi.mock('./_queries.ts', () => ({
  getTransparencyStats: vi.fn(),
}));

// Mock next-intl server
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...(rest as Record<string, unknown>)}>
      {children}
    </a>
  ),
}));

import type * as React from 'react';
import { getTransparencyStats } from './_queries.ts';
import TransparencyPage from './page.tsx';

const mockedGetStats = vi.mocked(getTransparencyStats);

const EMPTY_STATS = {
  verdictCounts: [],
  topCategoriesByVerdict: [],
  appeals: { pending: 0, resolved: 0, medianDaysToResolution: null },
  providers: [],
  windowDays: 30,
  hasDecisions: false,
};

const FULL_STATS = {
  verdictCounts: [
    { verdict: 'auto_publish' as const, count: 120 },
    { verdict: 'hold_for_review' as const, count: 15 },
    { verdict: 'auto_reject' as const, count: 8 },
    { verdict: 'human_publish' as const, count: 5 },
    { verdict: 'human_reject' as const, count: 3 },
  ],
  topCategoriesByVerdict: [
    { verdict: 'auto_reject' as const, category: 'spam', count: 6 },
    { verdict: 'auto_reject' as const, category: 'toxicity', count: 2 },
    { verdict: 'hold_for_review' as const, category: 'misinformation', count: 9 },
    { verdict: 'hold_for_review' as const, category: 'off-topic', count: 6 },
    { verdict: 'human_reject' as const, category: 'hate', count: 3 },
  ],
  appeals: { pending: 4, resolved: 12, medianDaysToResolution: 2.5 },
  providers: [
    { provider: 'anthropic', count: 130 },
    { provider: 'ollama-llama-guard', count: 11 },
    { provider: 'human', count: 8 },
  ],
  windowDays: 30,
  hasDecisions: true,
};

describe('TransparencyPage — empty state', () => {
  it('renders empty state message when no decisions exist', async () => {
    mockedGetStats.mockResolvedValue(EMPTY_STATS);

    const page = await TransparencyPage({
      params: Promise.resolve({ locale: 'en' }),
    });
    render(page);

    expect(screen.getByTestId('transparency-empty')).toBeInTheDocument();
    expect(screen.getByText('No decisions in the last 30 days.')).toBeInTheDocument();
  });

  it('does not render verdict table when empty', async () => {
    mockedGetStats.mockResolvedValue(EMPTY_STATS);

    const page = await TransparencyPage({
      params: Promise.resolve({ locale: 'en' }),
    });
    render(page);

    expect(screen.queryByTestId('verdict-counts-table')).not.toBeInTheDocument();
  });
});

describe('TransparencyPage — with data', () => {
  it('renders "Last 30 days" section heading', async () => {
    mockedGetStats.mockResolvedValue(FULL_STATS);

    const page = await TransparencyPage({
      params: Promise.resolve({ locale: 'en' }),
    });
    render(page);

    expect(screen.getByTestId('section-last-30-days')).toBeInTheDocument();
  });

  it('renders verdict counts for all five verdicts', async () => {
    mockedGetStats.mockResolvedValue(FULL_STATS);

    const page = await TransparencyPage({
      params: Promise.resolve({ locale: 'en' }),
    });
    render(page);

    const table = screen.getByTestId('verdict-counts-table');
    expect(table).toBeInTheDocument();

    // Numbers must be in the document
    expect(screen.getByTestId('verdict-count-auto_publish')).toHaveTextContent('120');
    expect(screen.getByTestId('verdict-count-hold_for_review')).toHaveTextContent('15');
    expect(screen.getByTestId('verdict-count-auto_reject')).toHaveTextContent('8');
    expect(screen.getByTestId('verdict-count-human_publish')).toHaveTextContent('5');
    expect(screen.getByTestId('verdict-count-human_reject')).toHaveTextContent('3');
  });

  it('renders "By category" section with top categories', async () => {
    mockedGetStats.mockResolvedValue(FULL_STATS);

    const page = await TransparencyPage({
      params: Promise.resolve({ locale: 'en' }),
    });
    render(page);

    expect(screen.getByTestId('section-by-category')).toBeInTheDocument();
    expect(screen.getByText('spam')).toBeInTheDocument();
    expect(screen.getByText('misinformation')).toBeInTheDocument();
  });

  it('renders "Appeals" section with pending and resolved counts', async () => {
    mockedGetStats.mockResolvedValue(FULL_STATS);

    const page = await TransparencyPage({
      params: Promise.resolve({ locale: 'en' }),
    });
    render(page);

    expect(screen.getByTestId('section-appeals')).toBeInTheDocument();
    expect(screen.getByTestId('appeals-pending')).toHaveTextContent('4');
    expect(screen.getByTestId('appeals-resolved')).toHaveTextContent('12');
    expect(screen.getByTestId('appeals-median')).toHaveTextContent('2.5');
  });

  it('renders "Providers" section with provider names and counts', async () => {
    mockedGetStats.mockResolvedValue(FULL_STATS);

    const page = await TransparencyPage({
      params: Promise.resolve({ locale: 'en' }),
    });
    render(page);

    expect(screen.getByTestId('section-providers')).toBeInTheDocument();
    expect(screen.getByTestId('provider-count-anthropic')).toHaveTextContent('130');
    expect(screen.getByTestId('provider-count-ollama-llama-guard')).toHaveTextContent('11');
    expect(screen.getByTestId('provider-count-human')).toHaveTextContent('8');
  });

  it('renders link to moderation policy', async () => {
    mockedGetStats.mockResolvedValue(FULL_STATS);

    const page = await TransparencyPage({
      params: Promise.resolve({ locale: 'en' }),
    });
    render(page);

    const policyLink = screen.getByRole('link', { name: /moderation policy/i });
    expect(policyLink).toBeInTheDocument();
    expect(policyLink).toHaveAttribute('href', '/docs/moderation-policy.md');
  });

  it('renders null median gracefully when no resolved appeals', async () => {
    mockedGetStats.mockResolvedValue({
      ...FULL_STATS,
      appeals: { pending: 2, resolved: 0, medianDaysToResolution: null },
    });

    const page = await TransparencyPage({
      params: Promise.resolve({ locale: 'en' }),
    });
    render(page);

    expect(screen.getByTestId('appeals-median')).toHaveTextContent('—');
  });
});
