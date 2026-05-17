/**
 * Integration tests for the moderation worker.
 *
 * No live Redis: BullMQ's Queue.add() uses Lua scripts that ioredis-mock
 * cannot run. We therefore exercise the worker's business logic by calling
 * the exported processor functions directly:
 *
 *   processModerationJob(data, provider)
 *   handleFailedModerationJob(data, err, dlq, jobId?)
 *
 * This covers the same surface area that the spec requires — DB row inserted
 * with the right verdict, status transitioned, DLQ populated on failure —
 * without requiring a real Redis instance in CI.
 *
 * What is tested:
 *  1. Benign post → auto_publish decision row + published status.
 *  2. Moderate comment → hold_for_review decision row + pending_review status.
 *  3. High-score post → auto_reject decision row + rejected status.
 *  4. Provider failure path → hold_for_review decision row + DLQ entry.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Types ──────────────────────────────────────────────────────────────────
import type { ModerationInput, ModerationProvider, ModerationResult } from '@repo/moderation';
import type { ModerationJobData } from '@repo/queue';

// ── Fake DB ────────────────────────────────────────────────────────────────
interface FakeDecisionRow {
  targetType: string;
  targetId: string;
  provider: string;
  model: string;
  scores: Record<string, number>;
  verdict: string;
  reasoning: string | null | undefined;
  reviewerId: undefined;
}

const fakeDecisionStore: FakeDecisionRow[] = [];
const fakeStatusStore: Record<string, string> = {};

vi.mock('@repo/database/client', () => ({
  db: {
    insert: () => ({
      values: (row: FakeDecisionRow) => {
        fakeDecisionStore.push({ ...row });
        return Promise.resolve();
      },
    }),
  },
}));

vi.mock('@repo/posts', () => ({
  updatePostStatus: async (id: string, { newStatus }: { newStatus: string }) => {
    fakeStatusStore[id] = newStatus;
    return { id, status: newStatus };
  },
}));

vi.mock('@repo/comments', () => ({
  updateCommentStatus: async (id: string, { newStatus }: { newStatus: string }) => {
    fakeStatusStore[id] = newStatus;
    return { id, status: newStatus };
  },
}));

// ── Import worker functions after mocks ────────────────────────────────────
import {
  handleFailedModerationJob,
  processModerationJob,
} from './moderation.ts';

// ── Test data ──────────────────────────────────────────────────────────────
const POST_ID = '11111111-2222-3333-4444-555555555555';
const COMMENT_ID = 'aaaabbbb-cccc-dddd-eeee-ffffffffffff';

const BENIGN_POST_DATA: ModerationJobData = {
  targetType: 'post',
  targetId: POST_ID,
  text: 'A great contribution to SDG 13 work.',
  locale: 'en',
  context: { groupSdgCodes: ['13'], authorReputation: 200, targetType: 'post' },
};

const HELD_COMMENT_DATA: ModerationJobData = {
  targetType: 'comment',
  targetId: COMMENT_ID,
  text: 'This is somewhat aggressive text.',
  locale: 'en',
  context: { groupSdgCodes: ['5'], authorReputation: 50, targetType: 'comment' },
};

const REJECTED_POST_DATA: ModerationJobData = {
  targetType: 'post',
  targetId: '22222222-3333-4444-5555-666666666666',
  text: '[clear violation]',
  locale: 'en',
  context: { groupSdgCodes: ['1'], authorReputation: 10, targetType: 'post' },
};

function makeBenignProvider(): ModerationProvider {
  return {
    classify: async (_: ModerationInput): Promise<ModerationResult> => ({
      scores: { toxicity: 0.02, off_topic: 0.1 },
      verdict: 'auto_publish',
      reasoning: 'No issues detected.',
      provider: 'fixture',
      model: 'fixture-1.0',
    }),
  };
}

function makeHeldProvider(): ModerationProvider {
  return {
    classify: async (_: ModerationInput): Promise<ModerationResult> => ({
      scores: { toxicity: 0.4, harassment: 0.35 },
      verdict: 'hold_for_review',
      reasoning: 'Moderate toxicity detected.',
      provider: 'fixture',
      model: 'fixture-1.0',
    }),
  };
}

function makeRejectedProvider(): ModerationProvider {
  return {
    classify: async (_: ModerationInput): Promise<ModerationResult> => ({
      scores: { toxicity: 0.95, hate: 0.9 },
      verdict: 'auto_reject',
      reasoning: 'Clear violation.',
      provider: 'fixture',
      model: 'fixture-1.0',
    }),
  };
}

function makeFailingProvider(): ModerationProvider {
  return {
    classify: async (_: ModerationInput): Promise<never> => {
      throw new Error('provider network failure');
    },
  };
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

beforeEach(() => {
  fakeDecisionStore.length = 0;
  Object.keys(fakeStatusStore).forEach((k) => {
    delete fakeStatusStore[k];
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('processModerationJob', () => {
  describe('benign post (auto_publish)', () => {
    it('inserts a decision row with verdict=auto_publish', async () => {
      await processModerationJob(BENIGN_POST_DATA, makeBenignProvider());

      expect(fakeDecisionStore).toHaveLength(1);
      const row = fakeDecisionStore[0];
      expect(row).toBeDefined();
      if (!row) return;
      expect(row.verdict).toBe('auto_publish');
      expect(row.targetType).toBe('post');
      expect(row.targetId).toBe(POST_ID);
      expect(row.provider).toBe('fixture');
      expect(row.model).toBe('fixture-1.0');
      expect(row.reasoning).toBe('No issues detected.');
    });

    it('transitions post to published status', async () => {
      await processModerationJob(BENIGN_POST_DATA, makeBenignProvider());
      expect(fakeStatusStore[POST_ID]).toBe('published');
    });
  });

  describe('held comment (hold_for_review)', () => {
    it('inserts a decision row with verdict=hold_for_review', async () => {
      await processModerationJob(HELD_COMMENT_DATA, makeHeldProvider());

      expect(fakeDecisionStore).toHaveLength(1);
      const row = fakeDecisionStore[0];
      expect(row).toBeDefined();
      if (!row) return;
      expect(row.verdict).toBe('hold_for_review');
      expect(row.targetType).toBe('comment');
      expect(row.targetId).toBe(COMMENT_ID);
    });

    it('transitions comment to pending_review status', async () => {
      await processModerationJob(HELD_COMMENT_DATA, makeHeldProvider());
      expect(fakeStatusStore[COMMENT_ID]).toBe('pending_review');
    });
  });

  describe('rejected post (auto_reject)', () => {
    it('inserts a decision row with verdict=auto_reject', async () => {
      await processModerationJob(REJECTED_POST_DATA, makeRejectedProvider());

      const row = fakeDecisionStore[0];
      expect(row).toBeDefined();
      expect(row?.verdict).toBe('auto_reject');
    });

    it('transitions post to rejected status', async () => {
      await processModerationJob(REJECTED_POST_DATA, makeRejectedProvider());
      expect(fakeStatusStore[REJECTED_POST_DATA.targetId]).toBe('rejected');
    });
  });

  describe('classify input mapping', () => {
    it('passes text, locale, and context to the provider', async () => {
      let capturedInput: ModerationInput | undefined;
      const spyProvider: ModerationProvider = {
        classify: async (input: ModerationInput): Promise<ModerationResult> => {
          capturedInput = input;
          return {
            scores: { toxicity: 0.01 },
            verdict: 'auto_publish',
            reasoning: 'ok',
            provider: 'spy',
            model: 'spy-1.0',
          };
        },
      };

      await processModerationJob(BENIGN_POST_DATA, spyProvider);

      expect(capturedInput?.text).toBe(BENIGN_POST_DATA.text);
      expect(capturedInput?.locale).toBe('en');
      expect(capturedInput?.context.groupSdgCodes).toStrictEqual(['13']);
      expect(capturedInput?.context.authorReputation).toBe(200);
      expect(capturedInput?.context.targetType).toBe('post');
    });
  });
});

describe('handleFailedModerationJob', () => {
  it('writes a hold_for_review decision with empty scores on failure', async () => {
    const dlqStore: Array<{ name: string; data: unknown }> = [];
    const fakeDlq = {
      add: async (name: string, data: unknown) => {
        dlqStore.push({ name, data });
        return Promise.resolve();
      },
    };

    const err = new Error('network timeout');
    await handleFailedModerationJob(BENIGN_POST_DATA, err, fakeDlq, 'job-abc');

    expect(fakeDecisionStore).toHaveLength(1);
    const row = fakeDecisionStore[0];
    expect(row).toBeDefined();
    if (!row) return;
    expect(row.verdict).toBe('hold_for_review');
    expect(row.scores).toStrictEqual({});
    expect(row.reasoning).toBe('provider unavailable after retries; queued for human review');
    expect(row.targetId).toBe(POST_ID);
  });

  it('pushes a failed-moderation entry to the DLQ', async () => {
    const dlqStore: Array<{ name: string; data: unknown }> = [];
    const fakeDlq = {
      add: async (name: string, data: unknown) => {
        dlqStore.push({ name, data });
        return Promise.resolve();
      },
    };

    const err = new Error('provider network failure');
    await handleFailedModerationJob(BENIGN_POST_DATA, err, fakeDlq, 'job-xyz');

    expect(dlqStore).toHaveLength(1);
    expect(dlqStore[0]?.name).toBe('failed-moderation');
    const dlqData = dlqStore[0]?.data as Record<string, unknown>;
    expect(dlqData.originalJobId).toBe('job-xyz');
    expect(dlqData.targetType).toBe('post');
    expect(dlqData.targetId).toBe(POST_ID);
    expect(dlqData.error).toBe('provider network failure');
  });

  it('still writes the decision even when DLQ.add throws', async () => {
    const throwingDlq = {
      add: async () => {
        throw new Error('DLQ unavailable');
      },
    };

    const err = new Error('provider error');
    // Should not throw despite DLQ failure
    await expect(
      handleFailedModerationJob(BENIGN_POST_DATA, err, throwingDlq),
    ).resolves.toBeUndefined();

    // Decision row must still be written
    expect(fakeDecisionStore).toHaveLength(1);
    expect(fakeDecisionStore[0]?.verdict).toBe('hold_for_review');
  });

  it('provider failure during processModerationJob throws (caller handles retry)', async () => {
    await expect(
      processModerationJob(BENIGN_POST_DATA, makeFailingProvider()),
    ).rejects.toThrow('provider network failure');
  });
});
