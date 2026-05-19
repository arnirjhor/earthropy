-- Migration: add post_translations table.
--
-- Caches machine-translated post and comment bodies. Original text is always
-- preserved in the posts/comments tables; this table is a read-through cache.
--
-- Run with: pnpm --filter @repo/database migrate
-- Regenerate from schema with: pnpm --filter @repo/database generate

CREATE TABLE "post_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"comment_id" uuid,
	"source_locale" text NOT NULL,
	"target_locale" text NOT NULL,
	"translated_body" text NOT NULL,
	"provider_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_translations_cache_key" UNIQUE("post_id","comment_id","source_locale","target_locale")
);
--> statement-breakpoint
ALTER TABLE "post_translations" ADD CONSTRAINT "post_translations_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "post_translations" ADD CONSTRAINT "post_translations_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "post_translations_post_idx" ON "post_translations" USING btree ("post_id");
--> statement-breakpoint
CREATE INDEX "post_translations_comment_idx" ON "post_translations" USING btree ("comment_id");
