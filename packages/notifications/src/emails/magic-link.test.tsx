import { render } from '@react-email/components';
import { createElement } from 'react';
/**
 * Snapshot tests for the MagicLink React Email component.
 * Tests en (LTR) and ar (RTL) renders.
 */
import { describe, expect, it } from 'vitest';
import { MagicLink } from './magic-link.tsx';

const BASE_URL = 'https://earthropy.test';

describe('MagicLink component', () => {
  it('renders valid HTML for en locale', async () => {
    const html = await render(
      createElement(MagicLink, {
        signInUrl: `${BASE_URL}/en/signin/magic/testtoken`,
        locale: 'en',
      }),
    );

    expect(html).toContain('DOCTYPE html');
    expect(html).toContain('testtoken');
    expect(html).not.toContain('dir="rtl"');
  });

  it('renders with dir="rtl" for ar locale', async () => {
    const html = await render(
      createElement(MagicLink, {
        signInUrl: `${BASE_URL}/ar/signin/magic/testtoken`,
        locale: 'ar',
      }),
    );

    expect(html).toContain('DOCTYPE html');
    expect(html).toContain('testtoken');
    expect(html).toContain('rtl');
  });

  it('generates plain text without HTML tags', async () => {
    const text = await render(
      createElement(MagicLink, {
        signInUrl: `${BASE_URL}/en/signin/magic/testtoken`,
        locale: 'en',
      }),
      { plainText: true },
    );

    expect(text).not.toMatch(/<[^>]+>/);
    expect(text).toContain('testtoken');
  });

  it('matches HTML snapshot for en', async () => {
    const html = await render(
      createElement(MagicLink, {
        signInUrl: `${BASE_URL}/en/signin/magic/snap`,
        locale: 'en',
      }),
    );
    expect(html).toMatchSnapshot();
  });

  it('matches HTML snapshot for ar', async () => {
    const html = await render(
      createElement(MagicLink, {
        signInUrl: `${BASE_URL}/ar/signin/magic/snap`,
        locale: 'ar',
      }),
    );
    expect(html).toMatchSnapshot();
  });
});
