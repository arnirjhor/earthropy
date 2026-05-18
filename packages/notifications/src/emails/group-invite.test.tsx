/**
 * Snapshot tests for the GroupInvite React Email component.
 * Tests en (LTR) and ar (RTL) renders.
 */
import { render } from '@react-email/components';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { GroupInvite } from './group-invite.tsx';

const BASE_URL = 'https://earthropy.test';

describe('GroupInvite component', () => {
  it('renders valid HTML for en locale', async () => {
    const html = await render(
      createElement(GroupInvite, {
        inviteUrl: `${BASE_URL}/en/invite/testtoken`,
        groupName: 'Climate Warriors',
        inviterName: 'Alice',
        role: 'member',
        locale: 'en',
      }),
    );

    expect(html).toContain('DOCTYPE html');
    expect(html).toContain('testtoken');
    expect(html).toContain('Climate Warriors');
    expect(html).not.toContain('dir="rtl"');
  });

  it('renders with dir="rtl" for ar locale', async () => {
    const html = await render(
      createElement(GroupInvite, {
        inviteUrl: `${BASE_URL}/ar/invite/testtoken`,
        groupName: 'مجموعة المناخ',
        inviterName: 'أحمد',
        role: 'member',
        locale: 'ar',
      }),
    );

    expect(html).toContain('DOCTYPE html');
    expect(html).toContain('testtoken');
    expect(html).toContain('rtl');
  });

  it('generates plain text without HTML tags', async () => {
    const text = await render(
      createElement(GroupInvite, {
        inviteUrl: `${BASE_URL}/en/invite/testtoken`,
        groupName: 'Climate Warriors',
        inviterName: 'Alice',
        role: 'member',
        locale: 'en',
      }),
      { plainText: true },
    );

    expect(text).not.toMatch(/<[^>]+>/);
    expect(text).toContain('testtoken');
  });

  it('matches HTML snapshot for en', async () => {
    const html = await render(
      createElement(GroupInvite, {
        inviteUrl: `${BASE_URL}/en/invite/snap`,
        groupName: 'Snapshot Group',
        inviterName: 'Bob',
        role: 'member',
        locale: 'en',
      }),
    );
    expect(html).toMatchSnapshot();
  });

  it('matches HTML snapshot for ar', async () => {
    const html = await render(
      createElement(GroupInvite, {
        inviteUrl: `${BASE_URL}/ar/invite/snap`,
        groupName: 'مجموعة',
        inviterName: 'يوسف',
        role: 'member',
        locale: 'ar',
      }),
    );
    expect(html).toMatchSnapshot();
  });
});
