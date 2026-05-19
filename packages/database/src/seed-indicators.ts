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
