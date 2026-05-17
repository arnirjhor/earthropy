import { render } from '@react-email/components';
import { createElement } from 'react';
/**
 * Snapshot tests for the VerifyEmail React Email component.
 * Tests en (LTR) and ar (RTL) renders.
 */
import { describe, expect, it } from 'vitest';
import { VerifyEmail } from './verify-email.tsx';

const BASE_URL = 'https://earthropy.test';

describe('VerifyEmail component', () => {
  it('renders valid HTML for en locale', async () => {
    const html = await render(
      createElement(VerifyEmail, {
        verifyUrl: `${BASE_URL}/en/verify-email/testtoken`,
        locale: 'en',
      }),
    );

    expect(html).toContain('DOCTYPE html');
    expect(html).toContain('testtoken');
    // should not have dir="rtl" for LTR locale
    expect(html).not.toContain('dir="rtl"');
  });

  it('renders with dir="rtl" for ar locale', async () => {
    const html = await render(
      createElement(VerifyEmail, {
        verifyUrl: `${BASE_URL}/ar/verify-email/testtoken`,
        locale: 'ar',
      }),
    );

    expect(html).toContain('DOCTYPE html');
    expect(html).toContain('testtoken');
    expect(html).toContain('rtl');
  });

  it('generates plain text without HTML tags', async () => {
    const text = await render(
      createElement(VerifyEmail, {
        verifyUrl: `${BASE_URL}/en/verify-email/testtoken`,
        locale: 'en',
      }),
      { plainText: true },
    );

    expect(text).not.toMatch(/<[^>]+>/);
    expect(text).toContain('testtoken');
  });

  it('matches HTML snapshot for en', async () => {
    const html = await render(
      createElement(VerifyEmail, {
        verifyUrl: `${BASE_URL}/en/verify-email/snap`,
        locale: 'en',
      }),
    );
    expect(html).toMatchSnapshot();
  });

  it('matches HTML snapshot for ar', async () => {
    const html = await render(
      createElement(VerifyEmail, {
        verifyUrl: `${BASE_URL}/ar/verify-email/snap`,
        locale: 'ar',
      }),
    );
    expect(html).toMatchSnapshot();
  });
});
