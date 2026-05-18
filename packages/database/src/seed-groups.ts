/**
 * Seed script: 17 official SDG groups.
 *
 * Creates one public group per UN Sustainable Development Goal.
 * Uses a fixed system-user UUID so the script is fully idempotent.
 * Run with: pnpm --filter @repo/database seed-groups
 */
import { SDGS } from '@repo/sdg';
import { db } from './client.ts';
import { groupSdgs, groups, users } from './schema/index.ts';

/** Fixed UUID for the Earthropy system account. Must never collide with a real user. */
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

function sdgSlug(sdgId: number, sdgCode: string): string {
  return `sdg-${sdgId}-${sdgCode}`;
}

async function main() {
  // 1. Ensure the system user exists.
  await db
    .insert(users)
    .values({
      id: SYSTEM_USER_ID,
      email: 'system@earthropy.org',
      handle: 'earthropy-system',
      displayName: 'Earthropy System',
    })
    .onConflictDoNothing();

  // 2. Build group rows from SDG data.
  const groupRows = SDGS.map((sdg) => ({
    slug: sdgSlug(sdg.id, sdg.code),
    name: sdg.name,
    description: sdg.description,
    visibility: 'public' as const,
    createdBy: SYSTEM_USER_ID,
  }));

  // 3. Insert groups — skip on slug conflict (idempotent).
  //    Drizzle doesn't support returning on conflict-do-nothing without a target,
  //    so we insert then re-query to get IDs for the groupSdgs rows.
  await db.insert(groups).values(groupRows).onConflictDoNothing();

  // 4. Re-fetch all 17 group IDs by slug so we can upsert groupSdgs rows.
  const slugs = groupRows.map((r) => r.slug);
  const inserted = await db.query.groups.findMany({
    where: (t, { inArray }) => inArray(t.slug, slugs),
    columns: { id: true, slug: true },
  });

  // Build a slug → id map.
  const slugToId = new Map(inserted.map((g) => [g.slug, g.id]));

  // 5. Build groupSdgs rows — one per group, marked primary.
  const linkRows = SDGS.flatMap((sdg) => {
    const slug = sdgSlug(sdg.id, sdg.code);
    const groupId = slugToId.get(slug);
    if (!groupId) return [];
    return [{ groupId, sdgId: sdg.id, primary: true }];
  });

  if (linkRows.length > 0) {
    await db.insert(groupSdgs).values(linkRows).onConflictDoNothing();
  }

  process.stdout.write(`Seeded ${inserted.length} SDG groups.\n`);
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`${String(err)}\n`);
  process.exit(1);
});
