# Outcome Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let groups link to UN SDG indicators and report measurable, self-attested progress toward those indicators.

**Architecture:** SDG indicator metadata lives in `packages/sdg/` as a typed static array (no DB table needed for the metadata itself). The DB gets two tables: `sdg_indicators` (seeded from the static data) and `outcomes` (group-reported measurements). Server actions handle writes; group detail and SDG hub pages show the results. All reported values are self-attested — external verification is explicitly out of scope and noted in code comments.

**Tech Stack:** TypeScript strict, Drizzle ORM, postgres-js, Next.js 16 Server Components, `'use client'` only for interactive forms, Zod for input validation, Vitest for tests.

---

## File Map

**Create:**
- `packages/sdg/src/indicators.ts` — static typed array of ~34 actionable UN SDG indicators (~2 per SDG)
- `packages/sdg/src/indicators.test.ts` — unit tests for indicator lookup helpers
- `packages/database/src/schema/outcomes.ts` — `sdg_indicators` + `outcomes` + `outcome_posts` Drizzle schema + relations
- `packages/database/src/seed-indicators.ts` — idempotent seed script for `sdg_indicators`
- `apps/app/src/app/[locale]/(authenticated)/g/[slug]/outcomes/_actions.ts` — `reportOutcomeAction`, `listOutcomesAction`, `getGroupProgressAction`
- `apps/app/src/app/[locale]/(authenticated)/g/[slug]/outcomes/_actions.test.ts` — unit tests for actions
- `apps/app/src/app/[locale]/(authenticated)/g/[slug]/outcomes/_report-form.tsx` — `'use client'` form for reporting an outcome
- `apps/app/src/app/[locale]/(authenticated)/g/[slug]/outcomes/_report-form.test.tsx` — render test

**Modify:**
- `packages/sdg/src/index.ts` — re-export `indicators.ts` exports
- `packages/database/src/schema/index.ts` — export `outcomes.ts`
- `packages/database/package.json` — add `"seed-indicators"` script
- `apps/app/src/app/[locale]/(authenticated)/g/[slug]/page.tsx` — add Outcomes section after Posts

**Migration (auto-generated):**
- `packages/database/drizzle/0002_outcomes.sql` — Drizzle-generated SQL for new tables

---

## Task 1: SDG Indicator Metadata

**Files:**
- Create: `packages/sdg/src/indicators.ts`
- Create: `packages/sdg/src/indicators.test.ts`
- Modify: `packages/sdg/src/index.ts`

- [ ] **Step 1: Create `packages/sdg/src/indicators.ts`**

```typescript
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Static metadata for a curated subset of UN SDG indicators (~2 per goal).
// Source: https://unstats.un.org/sdgs/indicators/indicators-list/
//
// NOTE: These are the ~34 most community-actionable indicators, not the full
// ~230. Self-reported values on this platform are NOT externally verified.
// All numbers are self-attested by the reporting group.

import type { SdgId } from './types.ts';

export interface SdgIndicator {
  readonly id: string;
  readonly sdgId: SdgId;
  /** Official UN indicator code, e.g. "1.2.1" */
  readonly code: string;
  readonly name: string;
  readonly unit: string;
  readonly description: string;
}

export const INDICATORS: readonly SdgIndicator[] = [
  // SDG 1 — No Poverty
  {
    id: 'sdg-1-1-1',
    sdgId: 1,
    code: '1.1.1',
    name: 'Proportion of population below international poverty line',
    unit: 'percentage',
    description: 'Percentage of population living on less than $2.15/day (2017 PPP).',
  },
  {
    id: 'sdg-1-2-1',
    sdgId: 1,
    code: '1.2.1',
    name: 'Proportion of population living below national poverty line',
    unit: 'percentage',
    description: 'Percentage of population living below the national poverty line.',
  },
  // SDG 2 — Zero Hunger
  {
    id: 'sdg-2-1-1',
    sdgId: 2,
    code: '2.1.1',
    name: 'Prevalence of undernourishment',
    unit: 'percentage',
    description: 'Percentage of population with caloric intake below minimum dietary energy requirement.',
  },
  {
    id: 'sdg-2-2-1',
    sdgId: 2,
    code: '2.2.1',
    name: 'Prevalence of stunting among children under 5',
    unit: 'percentage',
    description: 'Percentage of children under 5 with height-for-age below -2 standard deviations.',
  },
  // SDG 3 — Good Health and Well-Being
  {
    id: 'sdg-3-1-1',
    sdgId: 3,
    code: '3.1.1',
    name: 'Maternal mortality ratio',
    unit: 'per 100,000 live births',
    description: 'Number of maternal deaths per 100,000 live births.',
  },
  {
    id: 'sdg-3-8-1',
    sdgId: 3,
    code: '3.8.1',
    name: 'Coverage of essential health services',
    unit: 'index score (0–100)',
    description: 'Universal health coverage index based on tracer interventions.',
  },
  // SDG 4 — Quality Education
  {
    id: 'sdg-4-1-1',
    sdgId: 4,
    code: '4.1.1',
    name: 'Proportion of children achieving minimum proficiency in reading',
    unit: 'percentage',
    description: 'Percentage of children at end of primary achieving minimum proficiency in reading.',
  },
  {
    id: 'sdg-4-6-1',
    sdgId: 4,
    code: '4.6.1',
    name: 'Literacy rate of population 15–24 years',
    unit: 'percentage',
    description: 'Percentage of people aged 15–24 who can read and write.',
  },
  // SDG 5 — Gender Equality
  {
    id: 'sdg-5-5-1',
    sdgId: 5,
    code: '5.5.1',
    name: 'Proportion of seats held by women in national parliament',
    unit: 'percentage',
    description: 'Percentage of parliamentary seats in a single or lower chamber held by women.',
  },
  {
    id: 'sdg-5-b-1',
    sdgId: 5,
    code: '5.b.1',
    name: 'Proportion of women who own a mobile telephone',
    unit: 'percentage',
    description: 'Percentage of women who own a mobile telephone.',
  },
  // SDG 6 — Clean Water and Sanitation
  {
    id: 'sdg-6-1-1',
    sdgId: 6,
    code: '6.1.1',
    name: 'Proportion of population using safely managed drinking water',
    unit: 'percentage',
    description: 'Percentage of population using safely managed drinking water services.',
  },
  {
    id: 'sdg-6-2-1',
    sdgId: 6,
    code: '6.2.1',
    name: 'Proportion of population using safely managed sanitation services',
    unit: 'percentage',
    description: 'Percentage of population using safely managed sanitation services including handwashing.',
  },
  // SDG 7 — Affordable and Clean Energy
  {
    id: 'sdg-7-1-1',
    sdgId: 7,
    code: '7.1.1',
    name: 'Proportion of population with access to electricity',
    unit: 'percentage',
    description: 'Percentage of population with access to electricity.',
  },
  {
    id: 'sdg-7-2-1',
    sdgId: 7,
    code: '7.2.1',
    name: 'Renewable energy share in total final energy consumption',
    unit: 'percentage',
    description: 'Percentage of renewable energy in total final energy consumption.',
  },
  // SDG 8 — Decent Work and Economic Growth
  {
    id: 'sdg-8-5-2',
    sdgId: 8,
    code: '8.5.2',
    name: 'Unemployment rate',
    unit: 'percentage',
    description: 'Percentage of labor force that is unemployed.',
  },
  {
    id: 'sdg-8-10-1',
    sdgId: 8,
    code: '8.10.1',
    name: 'Adults with a bank account',
    unit: 'per 100,000 adults',
    description: 'Number of commercial bank branches and ATMs per 100,000 adults.',
  },
  // SDG 9 — Industry, Innovation and Infrastructure
  {
    id: 'sdg-9-1-2',
    sdgId: 9,
    code: '9.1.2',
    name: 'Passenger and freight volumes',
    unit: 'passenger-km / tonne-km',
    description: 'Total air and road passenger and freight volumes.',
  },
  {
    id: 'sdg-9-c-1',
    sdgId: 9,
    code: '9.c.1',
    name: 'Proportion of population covered by a mobile network',
    unit: 'percentage',
    description: 'Percentage of population covered by at least a 4G mobile network.',
  },
  // SDG 10 — Reduced Inequalities
  {
    id: 'sdg-10-1-1',
    sdgId: 10,
    code: '10.1.1',
    name: 'Growth rates of household income of the bottom 40%',
    unit: 'percentage',
    description: 'Growth rates of per capita household income of the bottom 40% of the population.',
  },
  {
    id: 'sdg-10-7-2',
    sdgId: 10,
    code: '10.7.2',
    name: 'Countries with migration policies facilitating orderly migration',
    unit: 'count',
    description: 'Number of countries with migration policies facilitating orderly and safe migration.',
  },
  // SDG 11 — Sustainable Cities and Communities
  {
    id: 'sdg-11-1-1',
    sdgId: 11,
    code: '11.1.1',
    name: 'Proportion of population living in slums',
    unit: 'percentage',
    description: 'Percentage of urban population living in slum households.',
  },
  {
    id: 'sdg-11-6-2',
    sdgId: 11,
    code: '11.6.2',
    name: 'Annual mean PM2.5 concentration in cities',
    unit: 'µg/m³',
    description: 'Annual mean concentration of fine particulate matter (PM2.5) in cities.',
  },
  // SDG 12 — Responsible Consumption and Production
  {
    id: 'sdg-12-2-2',
    sdgId: 12,
    code: '12.2.2',
    name: 'Domestic material consumption per capita',
    unit: 'tonnes per capita',
    description: 'Total amount of materials used domestically per person per year.',
  },
  {
    id: 'sdg-12-5-1',
    sdgId: 12,
    code: '12.5.1',
    name: 'National recycling rate',
    unit: 'percentage',
    description: 'Percentage of material flows that are recycled.',
  },
  // SDG 13 — Climate Action
  {
    id: 'sdg-13-2-2',
    sdgId: 13,
    code: '13.2.2',
    name: 'Total greenhouse gas emissions per year',
    unit: 'megatonnes CO₂ equivalent',
    description: 'Annual total greenhouse gas emissions in megatonnes of CO₂ equivalent.',
  },
  {
    id: 'sdg-13-3-1',
    sdgId: 13,
    code: '13.3.1',
    name: 'Countries integrating climate change mitigation into policies',
    unit: 'count',
    description: 'Number of countries with policies addressing climate change mitigation.',
  },
  // SDG 14 — Life Below Water
  {
    id: 'sdg-14-1-1',
    sdgId: 14,
    code: '14.1.1',
    name: 'Index of coastal eutrophication and floating plastic debris',
    unit: 'index score',
    description: 'Composite index measuring coastal eutrophication and marine plastic litter.',
  },
  {
    id: 'sdg-14-5-1',
    sdgId: 14,
    code: '14.5.1',
    name: 'Coverage of protected areas in relation to marine areas',
    unit: 'percentage',
    description: 'Percentage of marine areas designated as protected.',
  },
  // SDG 15 — Life on Land
  {
    id: 'sdg-15-1-1',
    sdgId: 15,
    code: '15.1.1',
    name: 'Forest area as a proportion of total land area',
    unit: 'percentage',
    description: 'Percentage of total land area covered by forest.',
  },
  {
    id: 'sdg-15-2-1',
    sdgId: 15,
    code: '15.2.1',
    name: 'Progress towards sustainable forest management',
    unit: 'index score (0–100)',
    description: 'Composite index of sustainable forest management dimensions.',
  },
  // SDG 16 — Peace, Justice and Strong Institutions
  {
    id: 'sdg-16-1-1',
    sdgId: 16,
    code: '16.1.1',
    name: 'Number of victims of intentional homicide per 100,000 population',
    unit: 'per 100,000 population',
    description: 'Rate of intentional homicide victims per 100,000 population.',
  },
  {
    id: 'sdg-16-6-1',
    sdgId: 16,
    code: '16.6.1',
    name: 'Primary government expenditures as a proportion of original approved budget',
    unit: 'percentage',
    description: 'Percentage of primary government expenditures relative to approved budget.',
  },
  // SDG 17 — Partnerships for the Goals
  {
    id: 'sdg-17-8-1',
    sdgId: 17,
    code: '17.8.1',
    name: 'Proportion of individuals using the internet',
    unit: 'percentage',
    description: 'Percentage of individuals who have used the internet in the last 3 months.',
  },
  {
    id: 'sdg-17-19-2',
    sdgId: 17,
    code: '17.19.2',
    name: 'Countries with completed birth and death registration',
    unit: 'percentage',
    description: 'Percentage of countries that have achieved 100% birth and death registration.',
  },
] as const;

const BY_ID = new Map<string, SdgIndicator>(INDICATORS.map((i) => [i.id, i]));
const BY_CODE = new Map<string, SdgIndicator>(INDICATORS.map((i) => [i.code, i]));
const BY_SDG = new Map<SdgId, SdgIndicator[]>();

for (const indicator of INDICATORS) {
  const existing = BY_SDG.get(indicator.sdgId) ?? [];
  existing.push(indicator);
  BY_SDG.set(indicator.sdgId, existing);
}

export function getIndicatorById(id: string): SdgIndicator {
  const indicator = BY_ID.get(id);
  if (!indicator) throw new Error(`Unknown indicator id: ${id}`);
  return indicator;
}

export function getIndicatorByCode(code: string): SdgIndicator {
  const indicator = BY_CODE.get(code);
  if (!indicator) throw new Error(`Unknown indicator code: ${code}`);
  return indicator;
}

export function getIndicatorsBySdgId(sdgId: SdgId): readonly SdgIndicator[] {
  return BY_SDG.get(sdgId) ?? [];
}
```

- [ ] **Step 2: Write `packages/sdg/src/indicators.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { INDICATORS, getIndicatorByCode, getIndicatorById, getIndicatorsBySdgId } from './indicators.ts';

describe('INDICATORS', () => {
  it('has exactly 34 entries', () => {
    expect(INDICATORS.length).toBe(34);
  });

  it('covers all 17 SDGs', () => {
    const sdgIds = new Set(INDICATORS.map((i) => i.sdgId));
    expect(sdgIds.size).toBe(17);
    for (let id = 1; id <= 17; id++) {
      expect(sdgIds.has(id as 1)).toBe(true);
    }
  });

  it('has unique codes', () => {
    const codes = INDICATORS.map((i) => i.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it('has unique ids', () => {
    const ids = INDICATORS.map((i) => i.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('getIndicatorById', () => {
  it('returns the correct indicator for sdg-15-2-1', () => {
    const indicator = getIndicatorById('sdg-15-2-1');
    expect(indicator.code).toBe('15.2.1');
    expect(indicator.sdgId).toBe(15);
  });

  it('throws for unknown id', () => {
    expect(() => getIndicatorById('does-not-exist')).toThrow('Unknown indicator id');
  });
});

describe('getIndicatorByCode', () => {
  it('returns indicator for code 13.2.2', () => {
    const indicator = getIndicatorByCode('13.2.2');
    expect(indicator.id).toBe('sdg-13-2-2');
    expect(indicator.sdgId).toBe(13);
  });

  it('throws for unknown code', () => {
    expect(() => getIndicatorByCode('99.9.9')).toThrow('Unknown indicator code');
  });
});

describe('getIndicatorsBySdgId', () => {
  it('returns 2 indicators for SDG 15', () => {
    const indicators = getIndicatorsBySdgId(15);
    expect(indicators.length).toBe(2);
    expect(indicators.map((i) => i.code).sort()).toEqual(['15.1.1', '15.2.1']);
  });

  it('returns empty array for unknown SDG id', () => {
    // @ts-expect-error testing invalid input
    const indicators = getIndicatorsBySdgId(99);
    expect(indicators).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail (function not yet exported)**

```bash
cd /Users/arnirjhor/Developer/projects/earthropy
pnpm --filter @repo/sdg test
```

Expected: FAIL (modules not found or exports missing)

- [ ] **Step 4: Update `packages/sdg/src/index.ts`**

```typescript
export type { Sdg, SdgCode, SdgId } from './types.ts';
export { SDGS, getSdgById, getSdgByCode, isSdgCode, isSdgId } from './sdgs.ts';
export type { SdgIndicator } from './indicators.ts';
export { INDICATORS, getIndicatorByCode, getIndicatorById, getIndicatorsBySdgId } from './indicators.ts';
```

- [ ] **Step 5: Run tests — all should pass**

```bash
cd /Users/arnirjhor/Developer/projects/earthropy
pnpm --filter @repo/sdg test
```

Expected output (all green):
```
✓ packages/sdg/src/sdgs.test.ts (3 tests)
✓ packages/sdg/src/indicators.test.ts (8 tests)
```

- [ ] **Step 6: Run typecheck for the sdg package**

```bash
cd /Users/arnirjhor/Developer/projects/earthropy
pnpm --filter @repo/sdg typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/sdg/src/indicators.ts packages/sdg/src/indicators.test.ts packages/sdg/src/index.ts
git commit -m "feat(sdg): add curated SDG indicator metadata + lookup helpers"
```

---

## Task 2: Database Schema

**Files:**
- Create: `packages/database/src/schema/outcomes.ts`
- Modify: `packages/database/src/schema/index.ts`

- [ ] **Step 1: Create `packages/database/src/schema/outcomes.ts`**

```typescript
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Outcome tracking tables.
//
// IMPORTANT: All reported outcome values are self-attested by the reporting
// group. Earthropy does not perform external verification of these numbers.
// This is by design — see docs/moderation-policy.md for the transparency model.

import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { groups } from './groups.ts';
import { posts } from './posts.ts';
import { sdgs } from './sdgs.ts';
import { users } from './users.ts';

// ── sdg_indicators ─────────────────────────────────────────────────────────────
// Seeded from @repo/sdg INDICATORS. Rows are never deleted; the static metadata
// in @repo/sdg is the source of truth. DB rows exist for FK integrity on outcomes.

export const sdgIndicators = pgTable(
  'sdg_indicators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sdgId: integer('sdg_id')
      .notNull()
      .references(() => sdgs.id, { onDelete: 'restrict' }),
    /** Matches SdgIndicator.code from @repo/sdg, e.g. "15.2.1". Unique. */
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    unit: text('unit').notNull(),
    description: text('description').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    sdgIdx: index('sdg_indicators_sdg_idx').on(t.sdgId),
  }),
);

// ── outcomes ───────────────────────────────────────────────────────────────────

export const outcomes = pgTable(
  'outcomes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    indicatorId: uuid('indicator_id')
      .notNull()
      .references(() => sdgIndicators.id, { onDelete: 'restrict' }),
    reportedBy: uuid('reported_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    value: numeric('value', { precision: 20, scale: 6 }).notNull(),
    unit: text('unit').notNull(),
    description: text('description').notNull(),
    /** Optional URL to external evidence (press release, report, photo, etc.). */
    evidenceUrl: text('evidence_url'),
    reportedAt: timestamp('reported_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    groupIndicatorIdx: index('outcomes_group_indicator_idx').on(t.groupId, t.indicatorId),
    groupReportedIdx: index('outcomes_group_reported_idx').on(t.groupId, t.reportedAt),
    indicatorIdx: index('outcomes_indicator_idx').on(t.indicatorId),
  }),
);

// ── outcome_posts ──────────────────────────────────────────────────────────────
// Optional junction: link an outcome to one or more posts for context.

export const outcomePosts = pgTable(
  'outcome_posts',
  {
    outcomeId: uuid('outcome_id')
      .notNull()
      .references(() => outcomes.id, { onDelete: 'cascade' }),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.outcomeId, t.postId] }),
    postIdx: index('outcome_posts_post_idx').on(t.postId),
  }),
);

// ── Relations ──────────────────────────────────────────────────────────────────

export const sdgIndicatorsRelations = relations(sdgIndicators, ({ one, many }) => ({
  sdg: one(sdgs, { fields: [sdgIndicators.sdgId], references: [sdgs.id] }),
  outcomes: many(outcomes),
}));

export const outcomesRelations = relations(outcomes, ({ one, many }) => ({
  group: one(groups, { fields: [outcomes.groupId], references: [groups.id] }),
  indicator: one(sdgIndicators, { fields: [outcomes.indicatorId], references: [sdgIndicators.id] }),
  reporter: one(users, { fields: [outcomes.reportedBy], references: [users.id] }),
  linkedPosts: many(outcomePosts),
}));

export const outcomePostsRelations = relations(outcomePosts, ({ one }) => ({
  outcome: one(outcomes, { fields: [outcomePosts.outcomeId], references: [outcomes.id] }),
  post: one(posts, { fields: [outcomePosts.postId], references: [posts.id] }),
}));
```

- [ ] **Step 2: Add exports to `packages/database/src/schema/index.ts`**

Replace the file with:

```typescript
export * from './enums.ts';
export * from './users.ts';
export * from './sdgs.ts';
export * from './groups.ts';
export * from './posts.ts';
export * from './comments.ts';
export * from './moderation.ts';
export * from './reputation.ts';
export * from './notifications.ts';
export * from './outcomes.ts';
```

- [ ] **Step 3: Run typecheck for the database package**

```bash
cd /Users/arnirjhor/Developer/projects/earthropy
pnpm --filter @repo/database typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/database/src/schema/outcomes.ts packages/database/src/schema/index.ts
git commit -m "feat(database): add sdg_indicators, outcomes, outcome_posts schema"
```

---

## Task 3: Drizzle Migration

**Files:**
- Auto-generated: `packages/database/drizzle/0002_outcomes.sql`

- [ ] **Step 1: Generate the migration**

```bash
cd /Users/arnirjhor/Developer/projects/earthropy
pnpm --filter @repo/database generate
```

Expected: creates `packages/database/drizzle/0002_*.sql` (exact filename has a random suffix).

- [ ] **Step 2: Verify the SQL file contains the new tables**

Open the generated `.sql` file. It should contain `CREATE TABLE "sdg_indicators"`, `CREATE TABLE "outcomes"`, and `CREATE TABLE "outcome_posts"` statements.

- [ ] **Step 3: Commit**

```bash
# Replace 0002_*.sql with the actual generated filename
git add packages/database/drizzle/
git commit -m "chore(database): generate migration for outcomes tables"
```

---

## Task 4: Indicator Seed Script

**Files:**
- Create: `packages/database/src/seed-indicators.ts`
- Modify: `packages/database/package.json`

- [ ] **Step 1: Create `packages/database/src/seed-indicators.ts`**

```typescript
/**
 * Seed script: SDG indicators.
 *
 * Inserts rows into `sdg_indicators` from the @repo/sdg static INDICATORS array.
 * Idempotent: upserts on `code` (unique column).
 *
 * Run with: pnpm --filter @repo/database seed-indicators
 */
import { INDICATORS } from '@repo/sdg';
import { db } from './client.ts';
import { sdgIndicators } from './schema/outcomes.ts';

async function main() {
  process.stdout.write('Seeding SDG indicators...\n');

  const rows = INDICATORS.map((indicator) => ({
    sdgId: indicator.sdgId,
    code: indicator.code,
    name: indicator.name,
    unit: indicator.unit,
    description: indicator.description,
  }));

  await db
    .insert(sdgIndicators)
    .values(rows)
    .onConflictDoUpdate({
      target: sdgIndicators.code,
      set: {
        name: sdgIndicators.name,
        unit: sdgIndicators.unit,
        description: sdgIndicators.description,
      },
    });

  process.stdout.write(`Seeded ${rows.length} indicators.\n`);
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`${String(err)}\n`);
  process.exit(1);
});
```

- [ ] **Step 2: Add `seed-indicators` script to `packages/database/package.json`**

In the `"scripts"` section, add after `"seed-groups"`:

```json
"seed-indicators": "tsx src/seed-indicators.ts",
```

The updated scripts section:

```json
"scripts": {
  "typecheck": "tsc --noEmit",
  "generate": "drizzle-kit generate",
  "migrate": "tsx src/migrate.ts",
  "seed": "tsx src/seed.ts",
  "seed-groups": "tsx src/seed-groups.ts",
  "seed-indicators": "tsx src/seed-indicators.ts",
  "studio": "drizzle-kit studio --port 3005",
  "clean": "rm -rf .turbo *.tsbuildinfo dist"
}
```

- [ ] **Step 3: Run typecheck**

```bash
cd /Users/arnirjhor/Developer/projects/earthropy
pnpm --filter @repo/database typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/database/src/seed-indicators.ts packages/database/package.json
git commit -m "feat(database): add seed-indicators script for sdg_indicators table"
```

---

## Task 5: Server Actions

**Files:**
- Create: `apps/app/src/app/[locale]/(authenticated)/g/[slug]/outcomes/_actions.ts`
- Create: `apps/app/src/app/[locale]/(authenticated)/g/[slug]/outcomes/_actions.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `apps/app/src/app/[locale]/(authenticated)/g/[slug]/outcomes/_actions.test.ts`:

```typescript
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
import { db } from '@repo/database/client';
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
```

- [ ] **Step 2: Run tests to verify they fail (module not found)**

```bash
cd /Users/arnirjhor/Developer/projects/earthropy
pnpm --filter @earthropy/app test -- outcomes/_actions.test.ts 2>&1 | head -20
```

Expected: FAIL (module `_actions.ts` not found)

- [ ] **Step 3: Create `apps/app/src/app/[locale]/(authenticated)/g/[slug]/outcomes/_actions.ts`**

```typescript
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
  value: z.string().regex(/^-?\d+(\.\d+)?$/, 'value must be a number').transform(Number),
  description: z.string().min(1).max(2000).trim(),
  evidenceUrl: z
    .string()
    .url()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v)),
  reportedAt: z.string().datetime().transform((v) => new Date(v)),
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/arnirjhor/Developer/projects/earthropy
pnpm --filter @earthropy/app test -- outcomes/_actions.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 5: Run typecheck for the app**

```bash
cd /Users/arnirjhor/Developer/projects/earthropy
pnpm --filter @earthropy/app typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/app/[locale]/\(authenticated\)/g/\[slug\]/outcomes/
git commit -m "feat(app): add outcome server actions (report, list, progress, sdg-impact)"
```

---

## Task 6: Report Outcome Form Component

**Files:**
- Create: `apps/app/src/app/[locale]/(authenticated)/g/[slug]/outcomes/_report-form.tsx`
- Create: `apps/app/src/app/[locale]/(authenticated)/g/[slug]/outcomes/_report-form.test.tsx`

- [ ] **Step 1: Write `_report-form.test.tsx` first**

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReportOutcomeForm } from './_report-form.tsx';

const MOCK_INDICATORS = [
  {
    id: 'ind-uuid-1',
    code: '15.2.1',
    name: 'Progress towards sustainable forest management',
    unit: 'index score (0–100)',
    description: 'Composite index of sustainable forest management dimensions.',
  },
  {
    id: 'ind-uuid-2',
    code: '15.1.1',
    name: 'Forest area as a proportion of total land area',
    unit: 'percentage',
    description: 'Percentage of total land area covered by forest.',
  },
];

describe('ReportOutcomeForm', () => {
  it('renders the indicator select', () => {
    render(
      <ReportOutcomeForm
        groupId="group-uuid"
        indicators={MOCK_INDICATORS}
      />,
    );
    expect(screen.getByRole('combobox', { name: /indicator/i })).toBeInTheDocument();
  });

  it('renders the value input', () => {
    render(
      <ReportOutcomeForm
        groupId="group-uuid"
        indicators={MOCK_INDICATORS}
      />,
    );
    expect(screen.getByRole('spinbutton', { name: /value/i })).toBeInTheDocument();
  });

  it('renders the description textarea', () => {
    render(
      <ReportOutcomeForm
        groupId="group-uuid"
        indicators={MOCK_INDICATORS}
      />,
    );
    expect(screen.getByRole('textbox', { name: /description/i })).toBeInTheDocument();
  });

  it('renders the submit button', () => {
    render(
      <ReportOutcomeForm
        groupId="group-uuid"
        indicators={MOCK_INDICATORS}
      />,
    );
    expect(screen.getByRole('button', { name: /report outcome/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/arnirjhor/Developer/projects/earthropy
pnpm --filter @earthropy/app test -- _report-form.test.tsx 2>&1 | head -20
```

Expected: FAIL (module not found)

- [ ] **Step 3: Create `_report-form.tsx`**

```typescript
'use client';

import { Button } from '@repo/design-system/components/ui';
import { Input } from '@repo/design-system/components/ui';
import { Label } from '@repo/design-system/components/ui';
import { useRouter } from 'next/navigation';
import { useActionState } from 'react';
import { reportOutcomeAction } from './_actions.ts';

// ── Props ──────────────────────────────────────────────────────────────────────

export interface IndicatorOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly unit: string;
  readonly description: string;
}

export interface ReportOutcomeFormProps {
  readonly groupId: string;
  readonly indicators: readonly IndicatorOption[];
  readonly locale?: string;
  readonly groupSlug?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ReportOutcomeForm({ groupId, indicators, locale, groupSlug }: ReportOutcomeFormProps) {
  const router = useRouter();
  const initialState = { ok: false as const, error: '' };

  const [state, formAction, isPending] = useActionState(
    async (_prev: typeof initialState, formData: FormData): Promise<typeof initialState> => {
      const result = await reportOutcomeAction(formData);
      if (!result.ok) return result as typeof initialState;
      if (locale && groupSlug) {
        router.refresh();
      }
      return initialState;
    },
    initialState,
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="reportedAt" value={new Date().toISOString()} />

      {/* Form-level error */}
      {!state.ok && state.error && (
        <div
          role="alert"
          data-error="form"
          className="mb-[var(--spacing-4)] px-[var(--spacing-4)] py-[var(--spacing-3)] bg-[color-mix(in_srgb,var(--color-text)_5%,var(--color-paper))] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[length:var(--text-body-sm)] text-[var(--color-text)] leading-[var(--text-body-sm--line-height)]"
        >
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-[var(--spacing-5)]">
        {/* Indicator select */}
        <div className="flex flex-col gap-[var(--spacing-2)]">
          <Label
            htmlFor="outcome-indicator"
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            Indicator
          </Label>
          <select
            id="outcome-indicator"
            name="indicatorId"
            required
            disabled={isPending}
            aria-label="Indicator"
            className="flex w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[length:var(--text-body-sm)] text-[var(--color-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-paper)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Select an indicator…</option>
            {indicators.map((ind) => (
              <option key={ind.id} value={ind.id}>
                {ind.code} — {ind.name} ({ind.unit})
              </option>
            ))}
          </select>
        </div>

        {/* Value */}
        <div className="flex flex-col gap-[var(--spacing-2)]">
          <Label
            htmlFor="outcome-value"
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            Value
          </Label>
          <Input
            id="outcome-value"
            name="value"
            type="number"
            step="any"
            required
            disabled={isPending}
            aria-label="Value"
            placeholder="e.g. 42.5"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-[var(--spacing-2)]">
          <Label
            htmlFor="outcome-description"
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            Description
          </Label>
          <textarea
            id="outcome-description"
            name="description"
            rows={4}
            maxLength={2000}
            required
            disabled={isPending}
            aria-label="Description"
            placeholder="Describe what was achieved and how the value was measured…"
            className="flex w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[length:var(--text-body-sm)] text-[var(--color-text)] resize-y transition-colors placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-paper)] disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Evidence URL (optional) */}
        <div className="flex flex-col gap-[var(--spacing-2)]">
          <Label
            htmlFor="outcome-evidence"
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            Evidence URL
            <span className="ml-[var(--spacing-2)] text-[var(--color-text-muted)] normal-case tracking-normal font-sans text-[length:var(--text-body-sm)]">
              (optional)
            </span>
          </Label>
          <Input
            id="outcome-evidence"
            name="evidenceUrl"
            type="url"
            disabled={isPending}
            aria-label="Evidence URL"
            placeholder="https://example.org/report.pdf"
          />
          <p className="text-[length:var(--text-mono)] font-mono text-[var(--color-text-muted)]">
            Link to an external source supporting this outcome (report, article, photo, etc.)
          </p>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-[var(--spacing-4)] pt-[var(--spacing-2)]">
          <Button
            type="submit"
            disabled={isPending}
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider"
          >
            {isPending ? 'Reporting…' : 'Report outcome'}
          </Button>
        </div>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Run tests — should pass**

```bash
cd /Users/arnirjhor/Developer/projects/earthropy
pnpm --filter @earthropy/app test -- _report-form.test.tsx
```

Expected: all 4 tests pass.

- [ ] **Step 5: Typecheck**

```bash
cd /Users/arnirjhor/Developer/projects/earthropy
pnpm --filter @earthropy/app typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/app/[locale]/\(authenticated\)/g/\[slug\]/outcomes/
git commit -m "feat(app): add ReportOutcomeForm client component"
```

---

## Task 7: Group Detail Page — Outcomes Section

**Files:**
- Modify: `apps/app/src/app/[locale]/(authenticated)/g/[slug]/page.tsx`

- [ ] **Step 1: Add the Outcomes section to `page.tsx`**

Add the following imports at the top of the file (after existing imports):

```typescript
import { db } from '@repo/database/client';
import { sdgIndicators } from '@repo/database/schema';
import { inArray as drizzleInArray } from 'drizzle-orm';
import { getGroupProgress, listOutcomes } from './outcomes/_actions.ts';
import { ReportOutcomeForm } from './outcomes/_report-form.tsx';
```

Add a helper function before the page component to fetch indicators for a group's SDGs:

```typescript
async function getIndicatorsForGroupSdgs(sdgIds: number[]) {
  if (sdgIds.length === 0) return [];
  return db
    .select({
      id: sdgIndicators.id,
      code: sdgIndicators.code,
      name: sdgIndicators.name,
      unit: sdgIndicators.unit,
      description: sdgIndicators.description,
    })
    .from(sdgIndicators)
    .where(drizzleInArray(sdgIndicators.sdgId, sdgIds));
}
```

Inside `GroupDetailPage`, after the posts fetch, add:

```typescript
  // Fetch outcomes + progress + indicators in parallel
  const groupSdgIds = group.sdgs.map((s) => s.id);
  const [outcomeList, progressRows, groupIndicators] = await Promise.all([
    listOutcomes(group.id),
    getGroupProgress(group.id),
    getIndicatorsForGroupSdgs(groupSdgIds),
  ]);
```

Add the Outcomes section JSX after the closing `</section>` of the Posts section:

```tsx
      {/* ── Outcomes section ──────────────────────────────────────────────── */}
      <section aria-labelledby="outcomes-heading" className="mt-[var(--spacing-12)]">
        <div className="flex items-center justify-between mb-[var(--spacing-6)]">
          <h2
            id="outcomes-heading"
            className="m-0 text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)] font-medium text-[var(--color-text)]"
          >
            Outcomes
          </h2>
        </div>

        {/* Summary / progress table */}
        {progressRows.length > 0 && (
          <div className="mb-[var(--spacing-8)] overflow-x-auto">
            <table className="w-full border-collapse text-[length:var(--text-body-sm)]">
              <caption className="sr-only">Group outcome summary by indicator</caption>
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th
                    scope="col"
                    className="text-left font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] pb-[var(--spacing-2)] pr-[var(--spacing-4)]"
                  >
                    Indicator
                  </th>
                  <th
                    scope="col"
                    className="text-left font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] pb-[var(--spacing-2)] pr-[var(--spacing-4)]"
                  >
                    Latest value
                  </th>
                  <th
                    scope="col"
                    className="text-left font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] pb-[var(--spacing-2)] pr-[var(--spacing-4)]"
                  >
                    Unit
                  </th>
                  <th
                    scope="col"
                    className="text-left font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] pb-[var(--spacing-2)]"
                  >
                    Reports
                  </th>
                </tr>
              </thead>
              <tbody>
                {progressRows.map((row) => (
                  <tr
                    key={row.indicatorId}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="py-[var(--spacing-3)] pr-[var(--spacing-4)] text-[var(--color-text)]">
                      <span className="font-mono text-[length:var(--text-micro)] text-[var(--color-text-muted)] mr-[var(--spacing-2)]">
                        {row.indicatorCode}
                      </span>
                      {row.indicatorName}
                    </td>
                    <td className="py-[var(--spacing-3)] pr-[var(--spacing-4)] font-mono text-[var(--color-text)]">
                      {row.latestValue}
                    </td>
                    <td className="py-[var(--spacing-3)] pr-[var(--spacing-4)] text-[var(--color-text-muted)]">
                      {row.unit}
                    </td>
                    <td className="py-[var(--spacing-3)] font-mono text-[var(--color-text-muted)]">
                      {row.reportCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Report outcome form — members only */}
        {isMember && groupIndicators.length > 0 && (
          <details className="mb-[var(--spacing-8)] border border-[var(--color-border)]" style={{ borderRadius: 'var(--radius-sm)' }}>
            <summary
              className="px-[var(--spacing-5)] py-[var(--spacing-3)] cursor-pointer font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors select-none list-none"
              style={{ transitionDuration: 'var(--duration-base)' }}
            >
              Report outcome
            </summary>
            <div className="px-[var(--spacing-5)] pb-[var(--spacing-5)] pt-[var(--spacing-4)] border-t border-[var(--color-border)]">
              <ReportOutcomeForm
                groupId={group.id}
                indicators={groupIndicators}
                locale={locale}
                groupSlug={slug}
              />
            </div>
          </details>
        )}

        {/* Outcome history list */}
        {outcomeList.length === 0 ? (
          <p
            data-testid="outcomes-empty-state"
            className="text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text-muted)]"
          >
            No outcomes reported yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-[var(--spacing-3)] list-none p-0 m-0" aria-label="Reported outcomes">
            {outcomeList.map((outcome) => (
              <li key={outcome.id} className="m-0 p-0">
                <article
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                >
                  <div className="px-[var(--spacing-5)] py-[var(--spacing-4)]">
                    <div className="flex items-baseline justify-between gap-[var(--spacing-4)] flex-wrap">
                      <span className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
                        {outcome.indicatorCode}
                      </span>
                      <time
                        dateTime={outcome.reportedAt.toISOString()}
                        className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]"
                      >
                        {outcome.reportedAt.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </time>
                    </div>
                    <p className="mt-[var(--spacing-1)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text)] font-medium">
                      {outcome.indicatorName}
                    </p>
                    <p className="mt-[var(--spacing-1)] font-mono text-[length:var(--text-body-sm)] text-[var(--color-text)]">
                      {outcome.value}{' '}
                      <span className="text-[var(--color-text-muted)]">{outcome.unit}</span>
                    </p>
                    <p className="mt-[var(--spacing-2)] text-[length:var(--text-body-sm)] leading-[var(--text-body-sm--line-height)] text-[var(--color-text-muted)]">
                      {outcome.description}
                    </p>
                    {outcome.evidenceUrl && (
                      <a
                        href={outcome.evidenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-[var(--spacing-2)] inline-block font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] no-underline hover:text-[var(--color-text)] transition-colors border-b border-[var(--color-border)]"
                      >
                        Evidence
                      </a>
                    )}
                    <p className="mt-[var(--spacing-3)] font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
                      Reported by @{outcome.reporterHandle}
                    </p>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
```

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/arnirjhor/Developer/projects/earthropy
pnpm --filter @earthropy/app typecheck
```

Expected: no errors.

- [ ] **Step 3: Run lint**

```bash
cd /Users/arnirjhor/Developer/projects/earthropy
pnpm lint
```

Expected: no errors. If there are lint errors, run `pnpm lint:fix` and re-check.

- [ ] **Step 4: Commit**

```bash
git add apps/app/src/app/[locale]/\(authenticated\)/g/\[slug\]/page.tsx
git commit -m "feat(app): add Outcomes section to group detail page"
```

---

## Task 8: SDG Hub Page — Impact Section

**Files:**
- Modify: `apps/app/src/app/[locale]/(public)/sdg/[code]/page.tsx`

- [ ] **Step 1: Add the Impact section to the SDG hub page**

At the top of `apps/app/src/app/[locale]/(public)/sdg/[code]/page.tsx`, add this import alongside the existing ones:

```typescript
import { listOutcomesBySdg } from '@/app/[locale]/(authenticated)/g/[slug]/outcomes/_actions.ts';
```

Note: `listOutcomesBySdg` is declared `'use server'` in the actions file. Since it has no auth guard, it can be called from the public page by importing it as a server-side function.

Inside `SdgHubPage`, add `listOutcomesBySdg` to the parallel fetch:

```typescript
  const [groupsResult, sdgPosts, viewer, sdgOutcomes] = await Promise.all([
    listGroups({
      sdgIds: [sdg.id as SdgId],
      visibility: 'public',
      limit: 12,
      offset: 0,
    }),
    listPostsBySdg(sdg.id, 25),
    viewerPromise,
    listOutcomesBySdg(sdg.id),
  ]);
```

Add the Impact section between the Posts section closing tag and end of `</main>`:

```tsx
      {/* ── Impact section ────────────────────────────────────────────────── */}
      {sdgOutcomes.length > 0 && (
        <section aria-labelledby="impact-heading" className="mt-[var(--spacing-12)]">
          <h2
            id="impact-heading"
            className="m-0 text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)] font-medium text-[var(--color-text)] mb-[var(--spacing-6)]"
          >
            Reported Impact
          </h2>
          <p className="mb-[var(--spacing-4)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
            Self-reported outcomes from groups working on {sdg.name}. Values are not externally verified.
          </p>
          <ul
            className="flex flex-col gap-[var(--spacing-3)] list-none p-0 m-0"
            aria-label="Reported outcomes for this SDG"
          >
            {sdgOutcomes.map((outcome) => (
              <li key={`${outcome.groupId}-${outcome.indicatorCode}-${outcome.reportedAt.toISOString()}`} className="m-0 p-0">
                <article
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden transition-colors hover:border-[var(--color-text)]"
                  style={{
                    borderRadius: 'var(--radius-sm)',
                    transitionDuration: 'var(--duration-base)',
                  }}
                >
                  <div className="px-[var(--spacing-5)] py-[var(--spacing-4)]">
                    <div className="flex items-baseline justify-between gap-[var(--spacing-4)] flex-wrap">
                      <span className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
                        {outcome.indicatorCode}
                      </span>
                      <time
                        dateTime={outcome.reportedAt.toISOString()}
                        className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]"
                      >
                        {outcome.reportedAt.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </time>
                    </div>
                    <p className="mt-[var(--spacing-1)] text-[length:var(--text-body)] text-[var(--color-text)] font-medium">
                      {outcome.indicatorName}
                    </p>
                    <p className="mt-[var(--spacing-1)] font-mono text-[length:var(--text-body-sm)] text-[var(--color-text)]">
                      {outcome.value}{' '}
                      <span className="text-[var(--color-text-muted)]">{outcome.unit}</span>
                    </p>
                    <p className="mt-[var(--spacing-3)] font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
                      {outcome.groupName}
                    </p>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}
```

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/arnirjhor/Developer/projects/earthropy
pnpm --filter @earthropy/app typecheck
```

Expected: no errors.

- [ ] **Step 3: Run lint**

```bash
cd /Users/arnirjhor/Developer/projects/earthropy
pnpm lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/app/src/app/[locale]/\(public\)/sdg/\[code\]/page.tsx
git commit -m "feat(app): add Impact section to SDG hub page"
```

---

## Task 9: Final Verification

- [ ] **Step 1: Full typecheck across the workspace**

```bash
cd /Users/arnirjhor/Developer/projects/earthropy
pnpm typecheck
```

Expected: no errors across all packages.

- [ ] **Step 2: Full lint**

```bash
cd /Users/arnirjhor/Developer/projects/earthropy
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
cd /Users/arnirjhor/Developer/projects/earthropy
pnpm test
```

Expected: all tests pass.

- [ ] **Step 4: Final commit (if any files were adjusted during verification)**

Only commit if there are uncommitted changes:

```bash
git status
# If clean, nothing to do. Otherwise:
git add -p
git commit -m "fix: typecheck and lint cleanup for outcome tracking"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| SDG indicator metadata in `packages/sdg/` | Task 1 |
| `sdg_indicators` DB table | Task 2 |
| `outcomes` DB table | Task 2 |
| `outcome_posts` junction table | Task 2 |
| Drizzle migration | Task 3 |
| `reportOutcome` server action | Task 5 |
| `listOutcomes` server action | Task 5 |
| `getGroupProgress` server action | Task 5 |
| Seed indicators | Task 4 |
| Group detail — Outcomes section (list + form) | Tasks 6, 7 |
| SDG hub — Impact section | Task 8 |

**No placeholders confirmed:** All code is fully written out.

**Type consistency check:**
- `OutcomeRow` defined in `_actions.ts`, consumed in `page.tsx` — matches.
- `ProgressRow` defined in `_actions.ts`, consumed in `page.tsx` — matches.
- `SdgImpactRow` defined in `_actions.ts`, consumed in SDG hub page — matches.
- `IndicatorOption` defined in `_report-form.tsx`, populated from `sdgIndicators` DB select — columns match (`id`, `code`, `name`, `unit`, `description`).
- `sdgIndicators` exported from `packages/database/src/schema/outcomes.ts` then re-exported via `schema/index.ts` — import paths are consistent.
- `listOutcomesBySdg` imported into the public SDG hub page from the authenticated actions file — this is a server function and is called server-side, no client boundary crossing.
