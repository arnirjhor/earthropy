-- NOTE: Postgres does NOT allow ALTER TYPE ... ADD VALUE inside a transaction.
-- Drizzle's migrate runner wraps each migration in a tx, which causes this
-- migration to silently no-op against an existing connection. On first
-- apply, run this statement manually instead:
--
--   docker exec earthropy-postgres psql -U earthropy -d earthropy \
--     -c "ALTER TYPE token_purpose ADD VALUE IF NOT EXISTS 'group_invite';"
--
-- We add IF NOT EXISTS so re-runs are idempotent.
ALTER TYPE "public"."token_purpose" ADD VALUE IF NOT EXISTS 'group_invite';
