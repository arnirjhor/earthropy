/**
 * Shared types for @repo/auth.
 * TokenPurpose mirrors the DB enum in packages/database/src/schema/enums.ts.
 */

export type TokenPurpose = 'email_verification' | 'magic_link' | 'password_reset';
