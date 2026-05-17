import { SDGS } from '@repo/sdg';
import { db } from './client.ts';
import { sdgs } from './schema/sdgs.ts';

async function main() {
  console.log('Seeding SDGs...');
  const rows = SDGS.map((s) => ({ id: s.id, code: s.code, color: s.color }));
  await db
    .insert(sdgs)
    .values(rows)
    .onConflictDoUpdate({
      target: sdgs.id,
      set: { code: sdgs.code, color: sdgs.color },
    });
  console.log(`Seeded ${rows.length} SDGs.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
