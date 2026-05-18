/**
 * Per-template message strings, keyed by locale.
 *
 * v0.1: English is fully shipped. Other locale strings fall back to English.
 * Phase D will fill in community-translated catalogs.
 *
 * Strings are intentionally short and direct — no marketing copy.
 */
import type { Locale } from '@repo/i18n/locales';

export interface VerifyEmailMessages {
  subject: string;
  previewText: string;
  heading: string;
  body: string;
  cta: string;
  expiry: string;
  ignore: string;
}

export interface MagicLinkMessages {
  subject: string;
  previewText: string;
  heading: string;
  body: string;
  cta: string;
  expiry: string;
  ignore: string;
}

export interface PasswordResetMessages {
  subject: string;
  previewText: string;
  heading: string;
  body: string;
  cta: string;
  expiry: string;
  ignore: string;
}

// ---------------------------------------------------------------------------
// verify-email
// ---------------------------------------------------------------------------

const verifyEmailEn: VerifyEmailMessages = {
  subject: 'Confirm your Earthropy email address',
  previewText: 'Click the link to verify your email and finish setting up your account.',
  heading: 'Confirm your email address',
  body: 'Click the button below to verify your email address. This link expires in 24 hours.',
  cta: 'Verify email address',
  expiry: 'This link expires in 24 hours.',
  ignore: 'If you did not create an Earthropy account, ignore this email.',
};

const verifyEmailAr: VerifyEmailMessages = {
  subject: 'تأكيد عنوان بريدك الإلكتروني في Earthropy',
  previewText: 'انقر على الرابط للتحقق من بريدك الإلكتروني وإتمام إعداد حسابك.',
  heading: 'تأكيد عنوان بريدك الإلكتروني',
  body: 'انقر على الزر أدناه للتحقق من عنوان بريدك الإلكتروني. تنتهي صلاحية هذا الرابط خلال ٢٤ ساعة.',
  cta: 'تحقق من عنوان البريد الإلكتروني',
  expiry: 'تنتهي صلاحية هذا الرابط خلال ٢٤ ساعة.',
  ignore: 'إذا لم تُنشئ حسابًا في Earthropy، تجاهل هذا البريد الإلكتروني.',
};

// ---------------------------------------------------------------------------
// magic-link
// ---------------------------------------------------------------------------

const magicLinkEn: MagicLinkMessages = {
  subject: 'Your Earthropy sign-in link',
  previewText: 'Click the link to sign in to your Earthropy account.',
  heading: 'Sign in to Earthropy',
  body: 'Click the button below to sign in. This link expires in 15 minutes and can only be used once.',
  cta: 'Sign in',
  expiry: 'This link expires in 15 minutes.',
  ignore: 'If you did not request a sign-in link, ignore this email.',
};

const magicLinkAr: MagicLinkMessages = {
  subject: 'رابط تسجيل الدخول إلى Earthropy',
  previewText: 'انقر على الرابط لتسجيل الدخول إلى حسابك في Earthropy.',
  heading: 'تسجيل الدخول إلى Earthropy',
  body: 'انقر على الزر أدناه لتسجيل الدخول. تنتهي صلاحية هذا الرابط خلال ١٥ دقيقة ولا يمكن استخدامه إلا مرة واحدة.',
  cta: 'تسجيل الدخول',
  expiry: 'تنتهي صلاحية هذا الرابط خلال ١٥ دقيقة.',
  ignore: 'إذا لم تطلب رابط تسجيل الدخول، تجاهل هذا البريد الإلكتروني.',
};

// ---------------------------------------------------------------------------
// password-reset
// ---------------------------------------------------------------------------

const passwordResetEn: PasswordResetMessages = {
  subject: 'Reset your Earthropy password',
  previewText: 'Click the link to set a new password for your Earthropy account.',
  heading: 'Reset your password',
  body: 'Click the button below to set a new password. This link expires in 60 minutes and can only be used once.',
  cta: 'Reset password',
  expiry: 'This link expires in 60 minutes.',
  ignore:
    'If you did not request a password reset, ignore this email. Your password has not changed.',
};

const passwordResetAr: PasswordResetMessages = {
  subject: 'إعادة تعيين كلمة مرور Earthropy',
  previewText: 'انقر على الرابط لتعيين كلمة مرور جديدة لحسابك في Earthropy.',
  heading: 'إعادة تعيين كلمة المرور',
  body: 'انقر على الزر أدناه لتعيين كلمة مرور جديدة. تنتهي صلاحية هذا الرابط خلال ٦٠ دقيقة ولا يمكن استخدامه إلا مرة واحدة.',
  cta: 'إعادة تعيين كلمة المرور',
  expiry: 'تنتهي صلاحية هذا الرابط خلال ٦٠ دقيقة.',
  ignore:
    'إذا لم تطلب إعادة تعيين كلمة المرور، تجاهل هذا البريد الإلكتروني. لم يتم تغيير كلمة مرورك.',
};

// ---------------------------------------------------------------------------
// group-invite
// ---------------------------------------------------------------------------

export interface GroupInviteMessages {
  subject: string;
  previewText: string;
  heading: string;
  body: string;
  cta: string;
  expiry: string;
  ignore: string;
}

const groupInviteEn: GroupInviteMessages = {
  subject: "You've been invited to join a group on Earthropy",
  previewText: 'Click the link to join the group on Earthropy.',
  heading: "You've been invited to join a group",
  body: 'Click the button below to accept your invitation. This link expires in 7 days and can only be used once.',
  cta: 'Accept invitation',
  expiry: 'This link expires in 7 days.',
  ignore: 'If you did not expect this invitation, you can safely ignore this email.',
};

const groupInviteAr: GroupInviteMessages = {
  subject: 'تمت دعوتك للانضمام إلى مجموعة على Earthropy',
  previewText: 'انقر على الرابط للانضمام إلى المجموعة على Earthropy.',
  heading: 'تمت دعوتك للانضمام إلى مجموعة',
  body: 'انقر على الزر أدناه لقبول دعوتك. تنتهي صلاحية هذا الرابط خلال ٧ أيام ولا يمكن استخدامه إلا مرة واحدة.',
  cta: 'قبول الدعوة',
  expiry: 'تنتهي صلاحية هذا الرابط خلال ٧ أيام.',
  ignore: 'إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذا البريد الإلكتروني بأمان.',
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

function localeOrEn<T>(map: Partial<Record<Locale, T>>, fallback: T, locale: Locale): T {
  return map[locale] ?? fallback;
}

export function getVerifyEmailMessages(locale: Locale): VerifyEmailMessages {
  return localeOrEn<VerifyEmailMessages>(
    { en: verifyEmailEn, ar: verifyEmailAr },
    verifyEmailEn,
    locale,
  );
}

export function getMagicLinkMessages(locale: Locale): MagicLinkMessages {
  return localeOrEn<MagicLinkMessages>({ en: magicLinkEn, ar: magicLinkAr }, magicLinkEn, locale);
}

export function getPasswordResetMessages(locale: Locale): PasswordResetMessages {
  return localeOrEn<PasswordResetMessages>(
    { en: passwordResetEn, ar: passwordResetAr },
    passwordResetEn,
    locale,
  );
}

export function getGroupInviteMessages(locale: Locale): GroupInviteMessages {
  return localeOrEn<GroupInviteMessages>(
    { en: groupInviteEn, ar: groupInviteAr },
    groupInviteEn,
    locale,
  );
}
