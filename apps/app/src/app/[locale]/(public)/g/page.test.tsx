/**
 * Unit tests for /g (group browse) page.
 * Tests URL → query params mapping and render logic without hitting the DB.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// Mock listGroups before importing the page
vi.mock('@repo/groups', () => ({
  listGroups: vi.fn(),
}));

// Mock next-intl server
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  setRequestLocale: vi.fn(),
}));

// Mock next/link — pass all props through so data-testid, rel, etc. work
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

// Mock next/navigation (used by client filter components)
vi.mock('next/navigation', () => ({
  useRouter: vi.fn().mockReturnValue({ push: vi.fn() }),
  usePathname: vi.fn().mockReturnValue('/en/g'),
  useSearchParams: vi.fn().mockReturnValue(new URLSearchParams()),
}));

// Mock the client filter components so the server page renders in jsdom
vi.mock('./_sdg-filter.tsx', () => ({
  SdgFilter: ({ activeSdgIds }: { activeSdgIds: number[]; filterLabel: string }) => (
    <div data-testid="sdg-filter" data-active={activeSdgIds.join(',')} />
  ),
}));

vi.mock('./_visibility-filter.tsx', () => ({
  VisibilityFilter: ({
    activeVisibility,
  }: {
    activeVisibility: string;
    label: string;
    publicLabel: string;
    listedLabel: string;
    bothLabel: string;
  }) => <div data-testid="visibility-filter" data-active={activeVisibility} />,
}));

// Mock design-system
vi.mock('@repo/design-system', () => ({
  AtlasCard: ({
    group,
  }: {
    group: {
      name: string;
      href: string;
      primarySdgId: number;
      memberCount: number;
      description: string;
    };
  }) => (
    <article data-testid="atlas-card" data-href={group.href}>
      <span>{group.name}</span>
    </article>
  ),
  SdgChip: ({ sdg }: { sdg: number }) => <span data-testid={`sdg-chip-${sdg}`}>SDG {sdg}</span>,
}));

// Mock @repo/sdg
vi.mock('@repo/sdg', () => ({
  SDGS: Array.from({ length: 17 }, (_, i) => ({
    id: i + 1,
    code: `sdg-${i + 1}`,
    shortName: `Goal ${i + 1}`,
    name: `SDG ${i + 1}`,
    color: '#000000',
  })),
  getSdgById: (id: number) => ({
    id,
    code: `sdg-${id}`,
    shortName: `Goal ${id}`,
    name: `SDG ${id}`,
    color: '#000000',
  }),
  isSdgId: (v: unknown) => typeof v === 'number' && v >= 1 && v <= 17,
  isSdgCode: () => false,
  getSdgByCode: () => null,
}));

import { listGroups } from '@repo/groups';
import type * as React from 'react';
import GroupBrowsePage from './page.tsx';

const mockedListGroups = vi.mocked(listGroups);

import type { SdgId } from '@repo/sdg';

function makeGroup(
  overrides: Partial<{ id: string; name: string; slug: string; primarySdgId: SdgId }> = {},
) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    slug: overrides.slug ?? 'test-group',
    name: overrides.name ?? 'Test Group',
    description: 'A test group',
    visibility: 'public' as const,
    primarySdgId: (overrides.primarySdgId ?? 1) as SdgId,
    memberCount: 5,
    preferredLocale: 'en',
    locationText: null,
    createdBy: 'user-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

describe('GroupBrowsePage — URL param parsing', () => {
  beforeEach(() => {
    mockedListGroups.mockResolvedValue({ rows: [], total: 0 });
  });

  it('calls listGroups with default visibility=public when no searchParams', async () => {
    const page = await GroupBrowsePage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({}),
    });
    render(page);

    expect(mockedListGroups).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: 'public', offset: 0, limit: 24 }),
    );
  });

  it('passes parsed sdgIds when ?sdgs=1,7,13', async () => {
    const page = await GroupBrowsePage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({ sdgs: '1,7,13' }),
    });
    render(page);

    expect(mockedListGroups).toHaveBeenCalledWith(expect.objectContaining({ sdgIds: [1, 7, 13] }));
  });

  it('passes offset based on ?page=2 with 24 per page', async () => {
    const page = await GroupBrowsePage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({ page: '2' }),
    });
    render(page);

    expect(mockedListGroups).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 24, limit: 24 }),
    );
  });

  it('respects ?visibility=listed', async () => {
    const page = await GroupBrowsePage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({ visibility: 'listed' }),
    });
    render(page);

    expect(mockedListGroups).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: 'listed' }),
    );
  });

  it('ignores invalid sdg ids in ?sdgs param', async () => {
    const page = await GroupBrowsePage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({ sdgs: '0,13,99,abc' }),
    });
    render(page);

    expect(mockedListGroups).toHaveBeenCalledWith(expect.objectContaining({ sdgIds: [13] }));
  });
});

describe('GroupBrowsePage — empty state', () => {
  it('renders empty state when no groups returned', async () => {
    mockedListGroups.mockResolvedValue({ rows: [], total: 0 });

    const page = await GroupBrowsePage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({}),
    });
    render(page);

    expect(screen.getByTestId('group-browse-empty')).toBeInTheDocument();
  });

  it('does not render empty state when groups exist', async () => {
    mockedListGroups.mockResolvedValue({
      rows: [makeGroup()],
      total: 1,
    });

    const page = await GroupBrowsePage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({}),
    });
    render(page);

    expect(screen.queryByTestId('group-browse-empty')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('atlas-card')).toHaveLength(1);
  });
});

describe('GroupBrowsePage — card hrefs', () => {
  it('each card links to /[locale]/g/[slug]', async () => {
    const g = makeGroup({ slug: 'climate-action' });
    mockedListGroups.mockResolvedValue({ rows: [g], total: 1 });

    const page = await GroupBrowsePage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({}),
    });
    render(page);

    const card = screen.getByTestId('atlas-card');
    expect(card).toHaveAttribute('data-href', '/en/g/climate-action');
  });
});

describe('GroupBrowsePage — SDG filter', () => {
  it('renders the SDG filter component', async () => {
    mockedListGroups.mockResolvedValue({ rows: [], total: 0 });

    const page = await GroupBrowsePage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({}),
    });
    render(page);

    // SdgFilter is mocked; verify it's rendered
    expect(screen.getByTestId('sdg-filter')).toBeInTheDocument();
  });

  it('passes active sdgIds from URL to SdgFilter', async () => {
    mockedListGroups.mockResolvedValue({ rows: [], total: 0 });

    const page = await GroupBrowsePage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({ sdgs: '7,13' }),
    });
    render(page);

    const filter = screen.getByTestId('sdg-filter');
    // data-active contains the active SDG ids (sorted by parseSearchParams)
    expect(filter.getAttribute('data-active')).toContain('7');
    expect(filter.getAttribute('data-active')).toContain('13');
  });
});

describe('GroupBrowsePage — pagination', () => {
  it('renders next page link when there are more results', async () => {
    const rows = Array.from({ length: 24 }, (_, i) =>
      makeGroup({ id: `id-${i}`, slug: `slug-${i}` }),
    );
    mockedListGroups.mockResolvedValue({ rows, total: 30 });

    const page = await GroupBrowsePage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({}),
    });
    render(page);

    expect(screen.getByTestId('pagination-next')).toBeInTheDocument();
  });

  it('does not render prev link on page 1', async () => {
    mockedListGroups.mockResolvedValue({ rows: [], total: 0 });

    const page = await GroupBrowsePage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({}),
    });
    render(page);

    expect(screen.queryByTestId('pagination-prev')).not.toBeInTheDocument();
  });

  it('renders prev page link on page 2', async () => {
    mockedListGroups.mockResolvedValue({ rows: [], total: 50 });

    const page = await GroupBrowsePage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({ page: '2' }),
    });
    render(page);

    expect(screen.getByTestId('pagination-prev')).toBeInTheDocument();
  });
});
