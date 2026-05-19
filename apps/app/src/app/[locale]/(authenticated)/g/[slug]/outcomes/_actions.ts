'use server';

// SPDX-License-Identifier: AGPL-3.0-or-later
//
// NOTE: All outcome values are self-attested by the reporting user/group.
// Earthropy does not verify reported numbers against external data sources.

import { getSession } from '@repo/auth';
import { db } from '@repo/database/client';
import { groupMembers, outcomes, sdgIndicators } from '@repo/database/schema';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';

// ── Session helper ─────────────────────────────────────────────────────────────

async function requireSession() {
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) return null;
  return getSession(sessionId);
}

// ── Action result types ────────────────────────────────────────────────────────

export type ActionError = { ok: false; error: string };
export type ActionOk<T> = { ok: true; data: T };
export type ActionResult<T> = ActionOk<T> | ActionError;

// ── Zod schemas ────────────────────────────────────────────────────────────────

const ReportOutcomeSchema = z.object({
  groupId: z.string().uuid(),
  indicatorId: z.string().uuid(),
  value: z
    .string()
    .regex(/^-?\d+(\.\d+)?$/, 'value must be a number')
    .transform(Number),
  description: z.string().min(1).max(2000).trim(),
  evidenceUrl: z
    .string()
    .url()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v)),
  reportedAt: z
    .string()
    .datetime()
    .transform((v) => new Date(v)),
});

// ── reportOutcomeAction ────────────────────────────────────────────────────────

/**
 * Report a measurable outcome for a group against an SDG indicator.
 *
 * Only group members may report outcomes.
 */
export async function reportOutcomeAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const raw = {
    groupId: formData.get('groupId'),
    indicatorId: formData.get('indicatorId'),
    value: formData.get('value'),
    description: formData.get('description'),
    evidenceUrl: formData.get('evidenceUrl') ?? '',
    reportedAt: formData.get('reportedAt') ?? new Date().toISOString(),
  };

  const parsed = ReportOutcomeSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors.map((e) => e.message).join('; ') };
  }

  const data = parsed.data;

  // Verify caller is a member of the group
  const membership = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, data.groupId), eq(groupMembers.userId, user.id)));

  if (membership.length === 0) {
    return { ok: false, error: 'not_a_member' };
  }

  // Verify indicator exists and get its unit
  const indicatorRows = await db
    .select({ unit: sdgIndicators.unit })
    .from(sdgIndicators)
    .where(eq(sdgIndicators.id, data.indicatorId));

  const indicator = indicatorRows[0];
  if (!indicator) return { ok: false, error: 'indicator_not_found' };

  const [inserted] = await db
    .insert(outcomes)
    .values({
      groupId: data.groupId,
      indicatorId: data.indicatorId,
      reportedBy: user.id,
      value: String(data.value),
      unit: indicator.unit,
      description: data.description,
      evidenceUrl: data.evidenceUrl ?? null,
      reportedAt: data.reportedAt,
    })
    .returning({ id: outcomes.id });

  if (!inserted) return { ok: false, error: 'insert_failed' };

  revalidatePath('/[locale]/(authenticated)/g/[slug]', 'page');
  return { ok: true, data: { id: inserted.id } };
}

// ── Outcome row type for listOutcomes ──────────────────────────────────────────

export interface OutcomeRow {
  id: string;
  indicatorCode: string;
  indicatorName: string;
  value: string;
  unit: string;
  description: string;
  evidenceUrl: string | null;
  reportedAt: Date;
  reporterHandle: string;
}

// ── listOutcomes ───────────────────────────────────────────────────────────────

/**
 * List all outcomes for a group, most recent first.
 * Public read — no auth required.
 */
export async function listOutcomes(groupId: string): Promise<OutcomeRow[]> {
  const { users } = await import('@repo/database/schema');

  const rows = await db
    .select({
      id: outcomes.id,
      indicatorCode: sdgIndicators.code,
      indicatorName: sdgIndicators.name,
      value: outcomes.value,
      unit: outcomes.unit,
      description: outcomes.description,
      evidenceUrl: outcomes.evidenceUrl,
      reportedAt: outcomes.reportedAt,
      reporterHandle: users.handle,
    })
    .from(outcomes)
    .innerJoin(sdgIndicators, eq(outcomes.indicatorId, sdgIndicators.id))
    .innerJoin(users, eq(outcomes.reportedBy, users.id))
    .where(eq(outcomes.groupId, groupId))
    .orderBy(desc(outcomes.reportedAt));

  return rows;
}

// ── Progress row type for getGroupProgress ─────────────────────────────────────

export interface ProgressRow {
  indicatorId: string;
  indicatorCode: string;
  indicatorName: string;
  unit: string;
  latestValue: string;
  reportCount: number;
  latestReportedAt: Date;
}

// ── getGroupProgress ───────────────────────────────────────────────────────────

/**
 * Aggregate outcomes by indicator for a group.
 * Returns one row per indicator reported, with the latest value and report count.
 * Public read — no auth required.
 */
export async function getGroupProgress(groupId: string): Promise<ProgressRow[]> {
  const rows = await db
    .select({
      indicatorId: sdgIndicators.id,
      indicatorCode: sdgIndicators.code,
      indicatorName: sdgIndicators.name,
      unit: sdgIndicators.unit,
      latestValue: sql<string>`(
        SELECT value FROM outcomes o2
        WHERE o2.group_id = ${groupId}
          AND o2.indicator_id = ${sdgIndicators.id}
        ORDER BY o2.reported_at DESC
        LIMIT 1
      )`,
      reportCount: sql<number>`COUNT(${outcomes.id})::int`,
      latestReportedAt: sql<Date>`MAX(${outcomes.reportedAt})`,
    })
    .from(outcomes)
    .innerJoin(sdgIndicators, eq(outcomes.indicatorId, sdgIndicators.id))
    .where(eq(outcomes.groupId, groupId))
    .groupBy(sdgIndicators.id, sdgIndicators.code, sdgIndicators.name, sdgIndicators.unit)
    .orderBy(asc(sdgIndicators.code));

  return rows;
}

// ── listOutcomesBySdg ──────────────────────────────────────────────────────────

export interface SdgImpactRow {
  groupId: string;
  groupName: string;
  groupSlug: string;
  indicatorCode: string;
  indicatorName: string;
  value: string;
  unit: string;
  reportedAt: Date;
}

/**
 * Aggregate outcomes across all groups for a given SDG.
 * Used by the SDG hub page Impact section.
 * Public read — no auth required.
 */
export async function listOutcomesBySdg(sdgId: number): Promise<SdgImpactRow[]> {
  const { groups } = await import('@repo/database/schema');

  const rows = await db
    .select({
      groupId: groups.id,
      groupName: groups.name,
      groupSlug: groups.slug,
      indicatorCode: sdgIndicators.code,
      indicatorName: sdgIndicators.name,
      value: outcomes.value,
      unit: outcomes.unit,
      reportedAt: outcomes.reportedAt,
    })
    .from(outcomes)
    .innerJoin(sdgIndicators, eq(outcomes.indicatorId, sdgIndicators.id))
    .innerJoin(groups, eq(outcomes.groupId, groups.id))
    .where(eq(sdgIndicators.sdgId, sdgId))
    .orderBy(desc(outcomes.reportedAt))
    .limit(50);

  return rows;
}
