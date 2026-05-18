/**
 * Transparency page data queries.
 *
 * All queries are scoped to the last 30 days.
 * Exported as a single `getTransparencyStats` function so the page can call it
 * server-side, and tests can mock just this module.
 */
import { db } from '@repo/database/client';
import { appeals, moderationDecisions } from '@repo/database/schema';
import { count, gte, isNotNull, isNull, sql } from 'drizzle-orm';

// ── Types ──────────────────────────────────────────────────────────────────────

export type Verdict =
  | 'auto_publish'
  | 'hold_for_review'
  | 'auto_reject'
  | 'human_publish'
  | 'human_reject';

export interface VerdictCount {
  verdict: Verdict;
  count: number;
}

export interface CategoryRow {
  verdict: Verdict;
  category: string;
  count: number;
}

export interface AppealsStats {
  pending: number;
  resolved: number;
  medianDaysToResolution: number | null;
}

export interface ProviderRow {
  provider: string;
  count: number;
}

export interface TransparencyStats {
  verdictCounts: VerdictCount[];
  topCategoriesByVerdict: CategoryRow[];
  appeals: AppealsStats;
  providers: ProviderRow[];
  windowDays: number;
  hasDecisions: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function thirtyDaysAgo(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
}

// ── Queries ────────────────────────────────────────────────────────────────────

async function fetchVerdictCounts(since: Date): Promise<VerdictCount[]> {
  const rows = await db
    .select({
      verdict: moderationDecisions.verdict,
      count: count(),
    })
    .from(moderationDecisions)
    .where(gte(moderationDecisions.createdAt, since))
    .groupBy(moderationDecisions.verdict);

  return rows.map((r) => ({ verdict: r.verdict as Verdict, count: Number(r.count) }));
}

/**
 * Top-3 categories per verdict, mined from the `scores` jsonb column.
 *
 * Each row in `moderation_decisions.scores` is a JSON object like:
 *   { toxicity: 0.12, hate: 0.04, spam: 0.91, ... }
 *
 * We unnest the keys via `jsonb_each`, count how many decisions per
 * (verdict, category_key) and take the top 3 per verdict.
 */
async function fetchTopCategoriesByVerdict(since: Date): Promise<CategoryRow[]> {
  // Use raw SQL with jsonb_each to expand the scores object into rows.
  const result = await db.execute<{ verdict: string; category: string; cnt: string }>(sql`
    WITH expanded AS (
      SELECT
        md.verdict,
        kv.key   AS category,
        kv.value AS score
      FROM moderation_decisions md,
           LATERAL jsonb_each(md.scores) AS kv
      WHERE md.created_at >= ${since}
    ),
    counted AS (
      SELECT
        verdict,
        category,
        COUNT(*)::int AS cnt
      FROM expanded
      GROUP BY verdict, category
    ),
    ranked AS (
      SELECT
        verdict,
        category,
        cnt,
        ROW_NUMBER() OVER (PARTITION BY verdict ORDER BY cnt DESC) AS rn
      FROM counted
    )
    SELECT verdict, category, cnt
    FROM ranked
    WHERE rn <= 3
    ORDER BY verdict, cnt DESC
  `);

  return Array.from(result).map((r) => ({
    verdict: r.verdict as Verdict,
    category: r.category,
    count: Number(r.cnt),
  }));
}

async function fetchAppealsStats(): Promise<AppealsStats> {
  const [pendingRows, resolvedRows, medianResult] = await Promise.all([
    // Pending (no resolvedAt)
    db
      .select({ count: count() })
      .from(appeals)
      .where(isNull(appeals.resolvedAt)),

    // Resolved
    db
      .select({ count: count() })
      .from(appeals)
      .where(isNotNull(appeals.resolvedAt)),

    // Median days to resolution using date_part
    db.execute<{ median_days: string | null }>(sql`
      SELECT
        PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY
            date_part('epoch', resolved_at - created_at) / 86400.0
        ) AS median_days
      FROM appeals
      WHERE resolved_at IS NOT NULL
    `),
  ]);

  const pending = Number(pendingRows[0]?.count ?? 0);
  const resolved = Number(resolvedRows[0]?.count ?? 0);
  const medianRows = Array.from(medianResult);
  const medianRaw = medianRows[0]?.median_days;
  const medianDaysToResolution =
    medianRaw !== null && medianRaw !== undefined ? Number(medianRaw) : null;

  return { pending, resolved, medianDaysToResolution };
}

async function fetchProviderCounts(since: Date): Promise<ProviderRow[]> {
  const rows = await db
    .select({
      provider: moderationDecisions.provider,
      count: count(),
    })
    .from(moderationDecisions)
    .where(gte(moderationDecisions.createdAt, since))
    .groupBy(moderationDecisions.provider)
    .orderBy(sql`count(*) DESC`);

  return rows.map((r) => ({ provider: r.provider, count: Number(r.count) }));
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function getTransparencyStats(): Promise<TransparencyStats> {
  const since = thirtyDaysAgo();

  const [verdictCounts, topCategoriesByVerdict, appealsStats, providers] = await Promise.all([
    fetchVerdictCounts(since),
    fetchTopCategoriesByVerdict(since),
    fetchAppealsStats(),
    fetchProviderCounts(since),
  ]);

  const hasDecisions = verdictCounts.length > 0;

  return {
    verdictCounts,
    topCategoriesByVerdict,
    appeals: appealsStats,
    providers,
    windowDays: 30,
    hasDecisions,
  };
}
