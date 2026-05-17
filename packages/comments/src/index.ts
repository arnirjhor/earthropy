export { createComment } from './createComment.ts';
export type { CreateCommentInput, CreatedComment } from './createComment.ts';

export { getCommentById } from './getComment.ts';
export type { CommentRow } from './getComment.ts';

export { listCommentsForPost } from './listCommentsForPost.ts';
export type { ListCommentsForPostInput } from './listCommentsForPost.ts';

export { updateCommentStatus, IllegalTransitionError } from './updateCommentStatus.ts';
export type {
  UpdateCommentStatusInput,
  UpdatedComment,
  ContentStatus,
} from './updateCommentStatus.ts';

export { withdrawComment } from './withdrawComment.ts';
export type { WithdrawnComment } from './withdrawComment.ts';

export { emitStatusChange, onStatusChange } from './events.ts';
export type { StatusChangedEvent } from './events.ts';
