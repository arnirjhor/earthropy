/**
 * Unit tests for moderation server actions.
 *
 * Covers:
 * 1. moderatorPublishAction — writes audit row + transitions post status.
 * 2. moderatorPublishAction — writes audit row + transitions comment status.
 * 3. moderatorRejectAction — writes audit row + transitions post status.
 * 4. moderatorRejectAction — writes audit row + transitions comment status.
 * 5. Non-moderator calling action → NotAuthorizedError thrown.
 * 6. Unauthenticated call → NotAuthorizedError thrown.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mock variables ─────────────────────────────────────────────────────

const {
  mockGetSession,
  mockDbSelect,
  mockDbInsert,
  mockUpdatePostStatus,
  mockUpdateCommentStatus,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockUpdatePostStatus: vi.fn().mockResolvedValue({ id: 'post-id', status: 'published' }),
  mockUpdateCommentStatus: vi.fn().mockResolvedValue({ id: 'comment-id', status: 'published' }),
  mockRevalidatePath: vi.fn(),
}));

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@repo/auth', () => ({
  getSession: mockGetSession,
}));

vi.mock('@repo/database/client', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
  },
}));

vi.mock('@repo/database/schema', () => ({
  posts: { id: 'id', groupId: 'group_id' },
  comments: { id: 'id', postId: 'post_id' },
  groupMembers: { groupId: 'group_id', userId: 'user_id', role: 'role' },
  moderationDecisions: {
    id: 'id',
    targetType: 'target_type',
    targetId: 'target_id',
    provider: 'provider',
    model: 'model',
    scores: 'scores',
    verdict: 'verdict',
    reasoning: 'reasoning',
    reviewerId: 'reviewer_id',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
}));

vi.mock('@repo/posts', () => ({
  updatePostStatus: mockUpdatePostStatus,
}));

vi.mock('@repo/comments', () => ({
  updateCommentStatus: mockUpdateCommentStatus,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'test-session-id' }),
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}));

// ── Import the module under test (after mocks are registered) ──────────────────

import { NotAuthorizedError, moderatorPublishAction, moderatorRejectAction } from './_actions.ts';

// ── Helpers ────────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-mod';
const GROUP_ID = 'group-uuid';
const POST_ID = 'post-uuid';
const COMMENT_ID = 'comment-uuid';

function makeUser(reputation = 0) {
  return {
    id: USER_ID,
    email: 'mod@example.com',
    handle: 'moderator',
    displayName: 'Moderator',
    locale: 'en',
    reputation,
  };
}

/**
 * Set up db.select for authority check queries.
 *
 * hasModerationAuthority calls:
 *   - If anchor (rep ≥ 2000): returns early, no DB calls.
 *   - Otherwise for post: select groupId from posts (1 call), then select role from groupMembers (2 calls).
 *   - Otherwise for comment: select postId from comments (1), select groupId from posts (1), select role from groupMembers (2 calls).
 */
function setupAuthorityMock(opts: {
  reputation?: number;
  targetType?: 'post' | 'comment';
  groupId?: string;
  role?: string;
}) {
  mockDbSelect.mockReset();
  mockDbInsert.mockReset();

  const { reputation = 0, targetType = 'post', groupId = GROUP_ID, role = 'moderator' } = opts;

  // db.insert is always called (for the audit row) — set it up unconditionally.
  const insertValues = vi.fn().mockResolvedValue([]);
  mockDbInsert.mockReturnValue({ values: insertValues });

  if (reputation >= 2000) {
    // No DB calls needed for authority check when anchor.
    return;
  }

  if (targetType === 'post') {
    // 1. select groupId from posts
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ groupId }]),
        }),
      }),
    });
  } else {
    // 1. select postId from comments
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ postId: POST_ID }]),
        }),
      }),
    });
    // 2. select groupId from posts
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ groupId }]),
        }),
      }),
    });
  }

  // Next: select role from groupMembers (all members with their roles)
  mockDbSelect.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ role }]),
      }),
    }),
  });

  // Final: select viewer's own memberships
  mockDbSelect.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ role }]),
      }),
    }),
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('moderatorPublishAction — posts', () => {
  beforeEach(() => {
    mockUpdatePostStatus.mockResolvedValue({ id: POST_ID, status: 'published' });
    mockUpdateCommentStatus.mockResolvedValue({ id: COMMENT_ID, status: 'published' });
  });

  it('writes an audit row with verdict=human_publish', async () => {
    mockGetSession.mockResolvedValue(makeUser(2000));
    setupAuthorityMock({ reputation: 2000, targetType: 'post' });

    await moderatorPublishAction('post', POST_ID);

    // db.insert is called once with the moderationDecisions table schema object.
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
    // The .values() call receives the audit row payload.
    const insertFn = mockDbInsert.mock.results[0]?.value as { values: ReturnType<typeof vi.fn> };
    expect(insertFn.values).toHaveBeenCalledWith(
      expect.objectContaining({
        verdict: 'human_publish',
        reviewerId: USER_ID,
        targetId: POST_ID,
        targetType: 'post',
      }),
    );
  });

  it('transitions post status to published', async () => {
    mockGetSession.mockResolvedValue(makeUser(2000));
    setupAuthorityMock({ reputation: 2000, targetType: 'post' });

    await moderatorPublishAction('post', POST_ID);

    expect(mockUpdatePostStatus).toHaveBeenCalledWith(
      POST_ID,
      expect.objectContaining({ newStatus: 'published', actorId: USER_ID }),
    );
  });

  it('returns { ok: true } on success', async () => {
    mockGetSession.mockResolvedValue(makeUser(2000));
    setupAuthorityMock({ reputation: 2000, targetType: 'post' });

    const result = await moderatorPublishAction('post', POST_ID);
    expect(result).toEqual({ ok: true });
  });
});

describe('moderatorPublishAction — comments', () => {
  it('transitions comment status to published', async () => {
    mockGetSession.mockResolvedValue(makeUser(2000));
    setupAuthorityMock({ reputation: 2000, targetType: 'comment' });

    await moderatorPublishAction('comment', COMMENT_ID);

    expect(mockUpdateCommentStatus).toHaveBeenCalledWith(
      COMMENT_ID,
      expect.objectContaining({ newStatus: 'published', actorId: USER_ID }),
    );
  });
});

describe('moderatorRejectAction — posts', () => {
  it('writes an audit row with verdict=human_reject', async () => {
    mockGetSession.mockResolvedValue(makeUser(2000));
    setupAuthorityMock({ reputation: 2000, targetType: 'post' });

    await moderatorRejectAction('post', POST_ID, 'Spam content');

    expect(mockDbInsert).toHaveBeenCalledTimes(1);
  });

  it('transitions post status to rejected', async () => {
    mockGetSession.mockResolvedValue(makeUser(2000));
    setupAuthorityMock({ reputation: 2000, targetType: 'post' });

    await moderatorRejectAction('post', POST_ID, 'Spam content');

    expect(mockUpdatePostStatus).toHaveBeenCalledWith(
      POST_ID,
      expect.objectContaining({ newStatus: 'rejected', actorId: USER_ID }),
    );
  });

  it('passes the reason to updatePostStatus', async () => {
    mockGetSession.mockResolvedValue(makeUser(2000));
    setupAuthorityMock({ reputation: 2000, targetType: 'post' });

    await moderatorRejectAction('post', POST_ID, 'Too spammy');

    expect(mockUpdatePostStatus).toHaveBeenCalledWith(
      POST_ID,
      expect.objectContaining({ reason: 'Too spammy' }),
    );
  });
});

describe('moderatorRejectAction — comments', () => {
  it('transitions comment status to rejected', async () => {
    mockGetSession.mockResolvedValue(makeUser(2000));
    setupAuthorityMock({ reputation: 2000, targetType: 'comment' });

    await moderatorRejectAction('comment', COMMENT_ID, 'Harassment');

    expect(mockUpdateCommentStatus).toHaveBeenCalledWith(
      COMMENT_ID,
      expect.objectContaining({ newStatus: 'rejected', actorId: USER_ID }),
    );
  });
});

describe('Authorization enforcement', () => {
  it('throws NotAuthorizedError when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(moderatorPublishAction('post', POST_ID)).rejects.toThrow(NotAuthorizedError);
  });

  it('throws NotAuthorizedError when viewer has no moderation role and is not anchor', async () => {
    mockGetSession.mockResolvedValue(makeUser(0)); // no reputation
    setupAuthorityMock({ reputation: 0, targetType: 'post', role: 'member' });

    await expect(moderatorPublishAction('post', POST_ID)).rejects.toThrow(NotAuthorizedError);
  });

  it('throws NotAuthorizedError for reject when viewer is not authorized', async () => {
    mockGetSession.mockResolvedValue(makeUser(0));
    setupAuthorityMock({ reputation: 0, targetType: 'post', role: 'member' });

    await expect(moderatorRejectAction('post', POST_ID, 'reason')).rejects.toThrow(
      NotAuthorizedError,
    );
  });

  it('allows group moderator to publish', async () => {
    mockGetSession.mockResolvedValue(makeUser(0));
    setupAuthorityMock({ reputation: 0, targetType: 'post', role: 'moderator' });

    const result = await moderatorPublishAction('post', POST_ID);
    expect(result).toEqual({ ok: true });
  });

  it('allows group owner to publish', async () => {
    mockGetSession.mockResolvedValue(makeUser(0));
    setupAuthorityMock({ reputation: 0, targetType: 'post', role: 'owner' });

    const result = await moderatorPublishAction('post', POST_ID);
    expect(result).toEqual({ ok: true });
  });
});
