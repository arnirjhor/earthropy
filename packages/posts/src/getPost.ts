import { db } from '@repo/database/client';
import { postSdgs, posts } from '@repo/database/schema';
import { eq } from 'drizzle-orm';

export interface PostWithSdgs {
  id: string;
  groupId: string;
  authorId: string;
  title: string;
  body: string;
  locale: string;
  status: 'pending_ai' | 'pending_review' | 'published' | 'rejected' | 'withdrawn';
  statusReason: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sdgIds: number[];
}

/**
 * Fetch a post by its UUID, including the associated SDG ids.
 * Returns null when no post with that id exists.
 */
export async function getPostById(id: string): Promise<PostWithSdgs | null> {
  const rows = await db
    .select({
      id: posts.id,
      groupId: posts.groupId,
      authorId: posts.authorId,
      title: posts.title,
      body: posts.body,
      locale: posts.locale,
      status: posts.status,
      statusReason: posts.statusReason,
      publishedAt: posts.publishedAt,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      sdgId: postSdgs.sdgId,
    })
    .from(posts)
    .leftJoin(postSdgs, eq(postSdgs.postId, posts.id))
    .where(eq(posts.id, id));

  if (rows.length === 0) return null;

  const first = rows[0];
  if (!first) return null;

  return {
    id: first.id,
    groupId: first.groupId,
    authorId: first.authorId,
    title: first.title,
    body: first.body,
    locale: first.locale,
    status: first.status,
    statusReason: first.statusReason,
    publishedAt: first.publishedAt,
    createdAt: first.createdAt,
    updatedAt: first.updatedAt,
    sdgIds: rows.flatMap((r) => (r.sdgId !== null ? [r.sdgId] : [])),
  };
}
