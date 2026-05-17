/**
 * recordEvent — inserts a reputation_events row and updates users.reputation atomically.
 *
 * Ground truth is the events table; users.reputation is a denormalized cache recomputed
 * by summing all events for the user (see B-REP-1 spec).
 */

import { db } from '@repo/database/client';
import { reputationEvents, users } from '@repo/database/schema';
import { eq, sql } from 'drizzle-orm';
import { DELTAS } from './index.ts';

export type ReputationEventKind = keyof typeof DELTAS;

export interface RecordEventInput {
  userId: string;
  kind: ReputationEventKind;
  sourceId?: string;
  reason?: string;
}

export interface RecordedEvent {
  id: string;
  userId: string;
  kind: ReputationEventKind;
  delta: number;
  reason: string | null;
  sourceId: string | null;
  createdAt: Date;
}

/**
 * Insert a reputation_events row and atomically update users.reputation.
 *
 * Uses a single Drizzle transaction so either both writes land or neither does.
 * The delta is looked up from DELTAS — callers cannot pass arbitrary deltas.
 */
export async function recordEvent(input: RecordEventInput): Promise<RecordedEvent> {
  const { userId, kind, sourceId, reason } = input;
  const delta = DELTAS[kind];

  const result = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(reputationEvents)
      .values({
        userId,
        kind,
        delta,
        sourceId: sourceId ?? null,
        reason: reason ?? null,
      })
      .returning({
        id: reputationEvents.id,
        userId: reputationEvents.userId,
        kind: reputationEvents.kind,
        delta: reputationEvents.delta,
        reason: reputationEvents.reason,
        sourceId: reputationEvents.sourceId,
        createdAt: reputationEvents.createdAt,
      });

    if (!inserted) throw new Error('recordEvent: insert returned no rows');

    // Update denormalized cache: increment by delta (not recompute from sum,
    // which would be an extra query; the sum stays accurate via the events table).
    await tx
      .update(users)
      .set({
        reputation: sql`${users.reputation} + ${delta}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return inserted;
  });

  return {
    id: result.id,
    userId: result.userId,
    kind: result.kind as ReputationEventKind,
    delta: result.delta,
    reason: result.reason,
    sourceId: result.sourceId,
    createdAt: result.createdAt,
  };
}
