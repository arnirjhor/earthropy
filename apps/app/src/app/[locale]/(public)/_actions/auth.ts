'use server';

/**
 * Server Actions for auth flows.
 * §2, §7, §9 of docs/architecture/auth.md.
 *
 * Every action:
 *  - Validates input with Zod
 *  - Applies rateLimitAction per auth.md §7 thresholds
 *  - Calls into @repo/auth + @repo/notifications
 *  - Returns { ok: false, errors: {...} } or redirects on success
 *  - Never leaks whether an email exists (§9 error model)
 */

import {
  TOKEN_TTL,
  consumeToken,
  createSession,
  hashPassword,
  issueToken,
  needsRehash,
  revokeAllForUser,
  sessionCookie,
  verifyPassword,
} from '@repo/auth';
import { db } from '@repo/database/client';
import { users } from '@repo/database/schema';
import type { Locale } from '@repo/i18n/locales';
import { sendTransactional } from '@repo/notifications';
import { log } from '@repo/observability';
import { RateLimitError, rateLimitAction } from '@repo/ratelimit';
import { sql } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

// ── Zod schemas ───────────────────────────────────────────────────────────────

const EmailSchema = z.string().email('Enter a valid email address.');
const PasswordSchema = z.string().min(12, 'Password must be at least 12 characters.');
const HandleSchema = z
  .string()
  .min(3, 'Handle must be at least 3 characters.')
  .max(30, 'Handle must be at most 30 characters.')
  .regex(/^[a-z0-9-]+$/, 'Handles use a–z, 0–9, hyphen, 3–30 characters.');

// ── Action state types ────────────────────────────────────────────────────────

export type AuthActionState = {
  ok: boolean;
  errors: Record<string, string>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const xff = h.get('x-forwarded-for');
    if (xff) return xff.split(',')[0]?.trim() ?? 'unknown';
    return h.get('x-real-ip') ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

async function getAppUrl(): Promise<string> {
  const host = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return host;
}

async function setSessionCookie(userId: string): Promise<void> {
  const h = await headers();
  const userAgent = h.get('user-agent') ?? undefined;
  const ip = await getClientIp();

  const session = await createSession(userId, { userAgent, ip });
  const cookieConfig = sessionCookie(session.id, session.expiresAt);
  const jar = await cookies();
  jar.set(cookieConfig.name, cookieConfig.value, {
    httpOnly: cookieConfig.httpOnly,
    secure: cookieConfig.secure,
    sameSite: cookieConfig.sameSite,
    path: cookieConfig.path,
    maxAge: cookieConfig.maxAge,
  });
}

function rateLimitError(retryAfterSec: number): AuthActionState {
  const minutes = Math.ceil(retryAfterSec / 60);
  return {
    ok: false,
    errors: {
      form: `Too many attempts. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
    },
  };
}

// ── signUpAction ─────────────────────────────────────────────────────────────

const SignUpSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  handle: HandleSchema,
});

export async function signUpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  // Validate first (no DB query on shape errors)
  const parsed = SignUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    handle: formData.get('handle'),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const [field, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
      fieldErrors[field] = msgs?.[0] ?? 'Invalid value.';
    }
    return { ok: false, errors: fieldErrors };
  }

  const { email, password, handle } = parsed.data;
  const ip = await getClientIp();

  // Rate limit
  try {
    await rateLimitAction({ key: `signup:ip:${ip}`, windowSec: 3600, max: 5 });
    await rateLimitAction({ key: `signup:ip24h:${ip}`, windowSec: 86400, max: 20 });
  } catch (e) {
    if (e instanceof RateLimitError) {
      log.warn('sign-up rate limited', { ip });
      return rateLimitError(e.retryAfterSec);
    }
    throw e;
  }

  const appUrl = await getAppUrl();

  // Look up existing user (identical response regardless of outcome — §9)
  const existing = await db
    .select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  if (existing.length > 0) {
    const existingUser = existing[0];
    // Re-issue a token and send the appropriate email (§9 error model)
    // We still return the generic "check your email" redirect
    if (existingUser) {
      const { rawToken } = await issueToken(
        existingUser.id,
        'email_verification',
        null,
        TOKEN_TTL.email_verification,
      );
      const verifyUrl = `${appUrl}/en/verify-email/${rawToken}`;
      await sendTransactional({
        to: email,
        template: 'verify-email',
        props: { verifyUrl },
        locale: 'en',
      });
      log.info('sign-up: existing user, re-issued verification token', { userId: existingUser.id });
    }
  } else {
    // New user: insert + issue verification token
    const passwordHash = await hashPassword(password);
    const displayName = handle;

    // Insert the user
    const inserted = await db
      .insert(users)
      .values({
        email,
        handle,
        displayName,
        locale: 'en',
        passwordHash,
      })
      .returning({ id: users.id });

    const newUser = inserted[0];
    if (!newUser) {
      log.error('sign-up: insert returned no row', { email });
      return { ok: false, errors: { form: 'Something broke on our side. Try again in a minute.' } };
    }

    const { rawToken } = await issueToken(
      newUser.id,
      'email_verification',
      null,
      TOKEN_TTL.email_verification,
    );
    const verifyUrl = `${appUrl}/en/verify-email/${rawToken}`;

    await sendTransactional({
      to: email,
      template: 'verify-email',
      props: { verifyUrl },
      locale: 'en',
    });

    log.info('sign-up: new user created', { userId: newUser.id });
  }

  redirect('/en/check-your-email');
}

// ── signInAction ─────────────────────────────────────────────────────────────

const SignInSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Enter your password.'),
});

const SIGN_IN_GENERIC_ERROR = 'Email or password is incorrect.';

export async function signInAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = SignInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const [field, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
      fieldErrors[field] = msgs?.[0] ?? 'Invalid value.';
    }
    return { ok: false, errors: fieldErrors };
  }

  const { email, password } = parsed.data;
  const ip = await getClientIp();

  try {
    await rateLimitAction({ key: `signin:ip:${ip}`, windowSec: 900, max: 10 });
    await rateLimitAction({ key: `signin:email:${email}`, windowSec: 900, max: 10 });
  } catch (e) {
    if (e instanceof RateLimitError) {
      log.warn('sign-in rate limited', { ip });
      return rateLimitError(e.retryAfterSec);
    }
    throw e;
  }

  const userRows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  const user = userRows[0];

  if (!user || !user.passwordHash) {
    // No such user or no password — generic error (§9)
    log.info('sign-in: user not found', { email: '(redacted)' });
    return { ok: false, errors: { form: SIGN_IN_GENERIC_ERROR } };
  }

  if (user.disabledAt) {
    log.warn('sign-in attempt on disabled account', { userId: user.id });
    return { ok: false, errors: { form: SIGN_IN_GENERIC_ERROR } };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    log.info('sign-in: wrong password', { userId: user.id });
    return { ok: false, errors: { form: SIGN_IN_GENERIC_ERROR } };
  }

  // Transparent rehash (§5.3)
  if (needsRehash(user.passwordHash)) {
    const updated = await hashPassword(password);
    await db
      .update(users)
      .set({ passwordHash: updated, updatedAt: new Date() })
      .where(sql`${users.id} = ${user.id}`);
  }

  if (!user.emailVerifiedAt) {
    // Re-send verification and return generic error (§9)
    const appUrl = await getAppUrl();
    const { rawToken } = await issueToken(
      user.id,
      'email_verification',
      null,
      TOKEN_TTL.email_verification,
    );
    const verifyUrl = `${appUrl}/en/verify-email/${rawToken}`;
    await sendTransactional({
      to: user.email,
      template: 'verify-email',
      props: { verifyUrl },
      locale: (user.locale ?? 'en') as Locale,
    });
    log.warn('sign-in: unverified email, re-sent verification', { userId: user.id });
    return { ok: false, errors: { form: SIGN_IN_GENERIC_ERROR } };
  }

  await setSessionCookie(user.id);
  log.info('sign-in: success', { userId: user.id });

  const next = await getNextParam();
  redirect(next ?? '/en/dashboard');
}

// ── magicLinkRequestAction ────────────────────────────────────────────────────

const MagicLinkSchema = z.object({
  email: EmailSchema,
});

export async function magicLinkRequestAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = MagicLinkSchema.safeParse({ email: formData.get('email') });

  if (!parsed.success) {
    return {
      ok: false,
      errors: {
        email: parsed.error.flatten().fieldErrors.email?.[0] ?? 'Enter a valid email address.',
      },
    };
  }

  const { email } = parsed.data;
  const ip = await getClientIp();

  try {
    await rateLimitAction({ key: `magic:email:${email}`, windowSec: 900, max: 5 });
    await rateLimitAction({ key: `magic:ip:${ip}`, windowSec: 900, max: 5 });
  } catch (e) {
    if (e instanceof RateLimitError) {
      log.warn('magic-link rate limited', { ip });
      return rateLimitError(e.retryAfterSec);
    }
    throw e;
  }

  const userRows = await db
    .select({
      id: users.id,
      locale: users.locale,
      emailVerifiedAt: users.emailVerifiedAt,
      disabledAt: users.disabledAt,
    })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  const user = userRows[0];

  // Always redirect regardless of whether user exists (§9)
  if (user && !user.disabledAt && user.emailVerifiedAt) {
    const appUrl = await getAppUrl();
    const { rawToken } = await issueToken(user.id, 'magic_link', null, TOKEN_TTL.magic_link);
    const signInUrl = `${appUrl}/en/signin/magic/${rawToken}`;

    await sendTransactional({
      to: email,
      template: 'magic-link',
      props: { signInUrl },
      locale: (user.locale ?? 'en') as Locale,
    });

    log.info('magic-link: token issued', { userId: user.id });
  } else {
    log.info('magic-link: user not found or unverified, silently ignored', { email: '(redacted)' });
  }

  redirect('/en/check-your-email');
}

// ── verifyEmailAction ─────────────────────────────────────────────────────────

const VerifyTokenSchema = z.object({
  token: z.string().min(1, 'Token is required.'),
});

export async function verifyEmailAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = VerifyTokenSchema.safeParse({ token: formData.get('token') });

  if (!parsed.success) {
    return {
      ok: false,
      errors: { form: 'This verification link is no longer valid. Request a new one.' },
    };
  }

  const { token } = parsed.data;

  const result = await consumeToken(token, 'email_verification');

  if (!result) {
    log.info('verify-email: invalid or expired token');
    return {
      ok: false,
      errors: { form: 'This verification link is no longer valid. Request a new one.' },
    };
  }

  const { userId } = result;

  // Mark email as verified
  await db
    .update(users)
    .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(sql`${users.id} = ${userId} AND ${users.emailVerifiedAt} IS NULL`);

  await setSessionCookie(userId);

  log.info('verify-email: success', { userId });

  redirect('/en/dashboard');
}

// ── forgotPasswordAction ──────────────────────────────────────────────────────

export async function forgotPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z.object({ email: EmailSchema }).safeParse({ email: formData.get('email') });

  if (!parsed.success) {
    return {
      ok: false,
      errors: {
        email: parsed.error.flatten().fieldErrors.email?.[0] ?? 'Enter a valid email address.',
      },
    };
  }

  const { email } = parsed.data;
  const ip = await getClientIp();

  try {
    await rateLimitAction({ key: `reset:email:${email}`, windowSec: 3600, max: 3 });
    await rateLimitAction({ key: `reset:ip:${ip}`, windowSec: 3600, max: 3 });
  } catch (e) {
    if (e instanceof RateLimitError) {
      log.warn('forgot-password rate limited', { ip });
      return rateLimitError(e.retryAfterSec);
    }
    throw e;
  }

  const userRows = await db
    .select({ id: users.id, locale: users.locale, disabledAt: users.disabledAt })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  const user = userRows[0];

  if (user && !user.disabledAt) {
    const appUrl = await getAppUrl();
    const { rawToken } = await issueToken(
      user.id,
      'password_reset',
      null,
      TOKEN_TTL.password_reset,
    );
    const resetUrl = `${appUrl}/en/reset-password/${rawToken}`;

    await sendTransactional({
      to: email,
      template: 'password-reset',
      props: { resetUrl },
      locale: (user.locale ?? 'en') as Locale,
    });

    log.info('forgot-password: token issued', { userId: user.id });
  } else {
    log.info('forgot-password: user not found, silently ignored', { email: '(redacted)' });
  }

  redirect('/en/check-your-email');
}

// ── resetPasswordAction ───────────────────────────────────────────────────────

const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required.'),
  password: PasswordSchema,
});

export async function resetPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = ResetPasswordSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const [field, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
      fieldErrors[field] = msgs?.[0] ?? 'Invalid value.';
    }
    return { ok: false, errors: fieldErrors };
  }

  const { token, password } = parsed.data;
  const ip = await getClientIp();

  try {
    await rateLimitAction({ key: `reset-consume:ip:${ip}`, windowSec: 3600, max: 10 });
  } catch (e) {
    if (e instanceof RateLimitError) {
      log.warn('reset-password rate limited', { ip });
      return rateLimitError(e.retryAfterSec);
    }
    throw e;
  }

  const result = await consumeToken(token, 'password_reset');

  if (!result) {
    log.info('reset-password: invalid or expired token');
    return {
      ok: false,
      errors: { form: 'This reset link is no longer valid. Request a new one.' },
    };
  }

  const { userId } = result;
  const passwordHash = await hashPassword(password);

  // Update password + revoke all sessions (§2 lifecycle)
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(sql`${users.id} = ${userId}`);

  await revokeAllForUser(userId);

  await setSessionCookie(userId);

  log.info('reset-password: success', { userId });

  redirect('/en/dashboard');
}

// ── magicLinkConsumeAction ────────────────────────────────────────────────────

export async function magicLinkConsumeAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = VerifyTokenSchema.safeParse({ token: formData.get('token') });

  if (!parsed.success) {
    return {
      ok: false,
      errors: { form: 'This sign-in link is no longer valid. Request a new one.' },
    };
  }

  const { token } = parsed.data;

  const result = await consumeToken(token, 'magic_link');

  if (!result) {
    log.info('magic-link consume: invalid or expired token');
    return {
      ok: false,
      errors: { form: 'This sign-in link is no longer valid. Request a new one.' },
    };
  }

  await setSessionCookie(result.userId);
  log.info('magic-link: consumed, session created', { userId: result.userId });

  redirect('/en/dashboard');
}

// ── Helper: extract ?next= from request URL ───────────────────────────────────

async function getNextParam(): Promise<string | null> {
  try {
    const h = await headers();
    const referer = h.get('referer') ?? '';
    const url = new URL(referer);
    return url.searchParams.get('next');
  } catch {
    return null;
  }
}
