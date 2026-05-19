import { describe, expect, it, vi } from 'vitest';

// Mock heavy deps before importing the module under test
vi.mock('@repo/auth', () => ({
  getSession: vi.fn(),
}));
vi.mock('@repo/database/client', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: () => ({ value: 'test-session' }) }),
}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { getSession } from '@repo/auth';
import { reportOutcomeAction } from './_actions.ts';

describe('reportOutcomeAction', () => {
  it('returns unauthenticated error when session is null', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const formData = new FormData();
    const result = await reportOutcomeAction(formData);

    expect(result).toEqual({ ok: false, error: 'unauthenticated' });
  });

  it('returns validation error for missing required fields', async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      handle: 'testuser',
      displayName: 'Test',
      locale: 'en',
      reputation: 0,
    });

    const formData = new FormData();
    // Missing groupId, indicatorId, value, description, reportedAt
    const result = await reportOutcomeAction(formData);

    expect(result.ok).toBe(false);
  });

  it('returns validation error for non-numeric value', async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      handle: 'testuser',
      displayName: 'Test',
      locale: 'en',
      reputation: 0,
    });

    const formData = new FormData();
    formData.set('groupId', 'group-uuid');
    formData.set('indicatorId', 'indicator-uuid');
    formData.set('value', 'not-a-number');
    formData.set('description', 'Some description');
    formData.set('reportedAt', new Date().toISOString());
    const result = await reportOutcomeAction(formData);

    expect(result.ok).toBe(false);
  });
});
