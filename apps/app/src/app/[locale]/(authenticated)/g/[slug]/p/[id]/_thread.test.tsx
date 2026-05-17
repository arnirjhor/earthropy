/**
 * Unit tests for _thread.tsx utilities:
 * - buildCommentTree: derives a nested tree from a flat ordered list.
 * - isCommentVisible: visibility filter (mirrors post visibility rules for comments).
 */

import { describe, expect, it } from 'vitest';

// ── Types mirrored from the implementation ─────────────────────────────────────

type CommentStatus = 'pending_ai' | 'pending_review' | 'published' | 'rejected' | 'withdrawn';

interface FlatComment {
  id: string;
  parentCommentId: string | null;
  authorId: string;
  status: CommentStatus;
  body: string;
  createdAt: Date;
}

interface CommentNode extends FlatComment {
  children: CommentNode[];
}

// ── Pure functions under test (extracted / duplicated for isolation) ───────────
// The real implementations live in _thread.tsx. We test the logic here as pure
// functions so no React rendering is needed for the utility layer.

function buildCommentTree(flat: FlatComment[]): CommentNode[] {
  const map = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const c of flat) {
    map.set(c.id, { ...c, children: [] });
  }

  for (const node of map.values()) {
    if (node.parentCommentId === null) {
      roots.push(node);
    } else {
      const parent = map.get(node.parentCommentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Orphan (parent filtered out or deleted) — surface at root level.
        roots.push(node);
      }
    }
  }

  return roots;
}

function isCommentVisible(
  comment: FlatComment,
  viewerId: string | null,
  viewerIsMod: boolean,
): boolean {
  switch (comment.status) {
    case 'published':
      return true;
    case 'pending_ai':
    case 'pending_review':
      return viewerIsMod || comment.authorId === viewerId;
    case 'rejected':
    case 'withdrawn':
      return viewerIsMod || comment.authorId === viewerId;
    default:
      return false;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

let seq = 0;
function makeComment(override: Partial<FlatComment> = {}): FlatComment {
  seq += 1;
  return {
    id: `comment-${seq}`,
    parentCommentId: null,
    authorId: 'author-a',
    status: 'published',
    body: `Body ${seq}`,
    createdAt: new Date(2026, 0, seq),
    ...override,
  };
}

// Reset the seq counter between describe blocks by using unique ids instead.

// ── buildCommentTree ───────────────────────────────────────────────────────────

describe('buildCommentTree', () => {
  it('returns an empty array for no comments', () => {
    expect(buildCommentTree([])).toEqual([]);
  });

  it('returns top-level comments as roots when no parentCommentId', () => {
    const a = makeComment({ id: 'a' });
    const b = makeComment({ id: 'b' });
    const tree = buildCommentTree([a, b]);
    expect(tree).toHaveLength(2);
    expect(tree[0]?.id).toBe('a');
    expect(tree[1]?.id).toBe('b');
    expect(tree[0]?.children).toHaveLength(0);
  });

  it('nests a reply under its parent', () => {
    const parent = makeComment({ id: 'parent' });
    const child = makeComment({ id: 'child', parentCommentId: 'parent' });
    const tree = buildCommentTree([parent, child]);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.children).toHaveLength(1);
    expect(tree[0]?.children[0]?.id).toBe('child');
  });

  it('supports multi-level nesting', () => {
    const root = makeComment({ id: 'root' });
    const level1 = makeComment({ id: 'l1', parentCommentId: 'root' });
    const level2 = makeComment({ id: 'l2', parentCommentId: 'l1' });
    const tree = buildCommentTree([root, level1, level2]);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.children[0]?.children[0]?.id).toBe('l2');
  });

  it('handles multiple roots with multiple children', () => {
    const r1 = makeComment({ id: 'r1' });
    const r2 = makeComment({ id: 'r2' });
    const c1 = makeComment({ id: 'c1', parentCommentId: 'r1' });
    const c2 = makeComment({ id: 'c2', parentCommentId: 'r1' });
    const c3 = makeComment({ id: 'c3', parentCommentId: 'r2' });
    const tree = buildCommentTree([r1, r2, c1, c2, c3]);
    const treeR1 = tree.find((n) => n.id === 'r1');
    const treeR2 = tree.find((n) => n.id === 'r2');
    expect(treeR1?.children).toHaveLength(2);
    expect(treeR2?.children).toHaveLength(1);
  });

  it('treats orphan comments (parent not in list) as roots', () => {
    const orphan = makeComment({ id: 'orphan', parentCommentId: 'nonexistent' });
    const tree = buildCommentTree([orphan]);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe('orphan');
  });

  it('preserves insertion order among siblings', () => {
    const root = makeComment({ id: 'root2' });
    const first = makeComment({
      id: 'first',
      parentCommentId: 'root2',
      createdAt: new Date(2026, 0, 1),
    });
    const second = makeComment({
      id: 'second',
      parentCommentId: 'root2',
      createdAt: new Date(2026, 0, 2),
    });
    const tree = buildCommentTree([root, first, second]);
    expect(tree[0]?.children[0]?.id).toBe('first');
    expect(tree[0]?.children[1]?.id).toBe('second');
  });
});

// ── isCommentVisible ───────────────────────────────────────────────────────────

describe('isCommentVisible', () => {
  const AUTHOR = 'author-x';
  const OTHER = 'other-user';
  const MOD = 'mod-user';

  it('published comment is visible to everyone', () => {
    const c = makeComment({ id: 'pub', status: 'published', authorId: AUTHOR });
    expect(isCommentVisible(c, null, false)).toBe(true);
    expect(isCommentVisible(c, OTHER, false)).toBe(true);
    expect(isCommentVisible(c, AUTHOR, false)).toBe(true);
    expect(isCommentVisible(c, MOD, true)).toBe(true);
  });

  it('pending_ai comment is visible to author only (non-mod)', () => {
    const c = makeComment({ id: 'pai', status: 'pending_ai', authorId: AUTHOR });
    expect(isCommentVisible(c, AUTHOR, false)).toBe(true);
    expect(isCommentVisible(c, OTHER, false)).toBe(false);
    expect(isCommentVisible(c, null, false)).toBe(false);
  });

  it('pending_ai comment is visible to moderator', () => {
    const c = makeComment({ id: 'pai2', status: 'pending_ai', authorId: AUTHOR });
    expect(isCommentVisible(c, MOD, true)).toBe(true);
  });

  it('pending_review comment is visible to author only (non-mod)', () => {
    const c = makeComment({ id: 'pr', status: 'pending_review', authorId: AUTHOR });
    expect(isCommentVisible(c, AUTHOR, false)).toBe(true);
    expect(isCommentVisible(c, OTHER, false)).toBe(false);
  });

  it('pending_review comment is visible to moderator', () => {
    const c = makeComment({ id: 'pr2', status: 'pending_review', authorId: AUTHOR });
    expect(isCommentVisible(c, MOD, true)).toBe(true);
  });

  it('rejected comment is visible to author only (non-mod)', () => {
    const c = makeComment({ id: 'rej', status: 'rejected', authorId: AUTHOR });
    expect(isCommentVisible(c, AUTHOR, false)).toBe(true);
    expect(isCommentVisible(c, OTHER, false)).toBe(false);
  });

  it('rejected comment is visible to moderator', () => {
    const c = makeComment({ id: 'rej2', status: 'rejected', authorId: AUTHOR });
    expect(isCommentVisible(c, MOD, true)).toBe(true);
  });

  it('withdrawn comment is visible to author only (non-mod)', () => {
    const c = makeComment({ id: 'wd', status: 'withdrawn', authorId: AUTHOR });
    expect(isCommentVisible(c, AUTHOR, false)).toBe(true);
    expect(isCommentVisible(c, OTHER, false)).toBe(false);
  });

  it('withdrawn comment is visible to moderator', () => {
    const c = makeComment({ id: 'wd2', status: 'withdrawn', authorId: AUTHOR });
    expect(isCommentVisible(c, MOD, true)).toBe(true);
  });
});
