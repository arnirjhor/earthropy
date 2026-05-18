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

const verifyEmailEs: VerifyEmailMessages = {
  subject: 'Confirma tu dirección de correo electrónico en Earthropy',
  previewText:
    'Haz clic en el enlace para verificar tu correo electrónico y terminar de configurar tu cuenta.',
  heading: 'Confirma tu dirección de correo electrónico',
  body: 'Haz clic en el botón de abajo para verificar tu dirección de correo electrónico. Este enlace expira en 24 horas.',
  cta: 'Verificar dirección de correo electrónico',
  expiry: 'Este enlace expira en 24 horas.',
  ignore: 'Si no creaste una cuenta en Earthropy, ignora este correo electrónico.',
};

const verifyEmailFr: VerifyEmailMessages = {
  subject: 'Confirmez votre adresse e-mail Earthropy',
  previewText:
    'Cliquez sur le lien pour vérifier votre e-mail et terminer la configuration de votre compte.',
  heading: 'Confirmez votre adresse e-mail',
  body: 'Cliquez sur le bouton ci-dessous pour vérifier votre adresse e-mail. Ce lien expire dans 24 heures.',
  cta: "Vérifier l'adresse e-mail",
  expiry: 'Ce lien expire dans 24 heures.',
  ignore: "Si vous n'avez pas créé de compte Earthropy, ignorez cet e-mail.",
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

const magicLinkEs: MagicLinkMessages = {
  subject: 'Tu enlace de inicio de sesión en Earthropy',
  previewText: 'Haz clic en el enlace para iniciar sesión en tu cuenta en Earthropy.',
  heading: 'Inicia sesión en Earthropy',
  body: 'Haz clic en el botón de abajo para iniciar sesión. Este enlace expira en 15 minutos y solo puede usarse una vez.',
  cta: 'Inicia sesión',
  expiry: 'Este enlace expira en 15 minutos.',
  ignore: 'Si no solicitaste un enlace de inicio de sesión, ignora este correo electrónico.',
};

const magicLinkFr: MagicLinkMessages = {
  subject: 'Votre lien de connexion Earthropy',
  previewText: 'Cliquez sur le lien pour vous connecter à votre compte Earthropy.',
  heading: 'Se connecter à Earthropy',
  body: "Cliquez sur le bouton ci-dessous pour vous connecter. Ce lien expire dans 15 minutes et ne peut être utilisé qu'une seule fois.",
  cta: 'Se connecter',
  expiry: 'Ce lien expire dans 15 minutes.',
  ignore: "Si vous n'avez pas demandé de lien de connexion, ignorez cet e-mail.",
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

const passwordResetEs: PasswordResetMessages = {
  subject: 'Restablecer tu contraseña en Earthropy',
  previewText:
    'Haz clic en el enlace para establecer una nueva contraseña para tu cuenta en Earthropy.',
  heading: 'Restablecer tu contraseña',
  body: 'Haz clic en el botón de abajo para establecer una nueva contraseña. Este enlace expira en 60 minutos y solo puede usarse una vez.',
  cta: 'Restablecer contraseña',
  expiry: 'Este enlace expira en 60 minutos.',
  ignore:
    'Si no solicitaste un restablecimiento de contraseña, ignora este correo electrónico. Tu contraseña no ha cambiado.',
};

const passwordResetFr: PasswordResetMessages = {
  subject: 'Réinitialiser votre mot de passe Earthropy',
  previewText:
    'Cliquez sur le lien pour définir un nouveau mot de passe pour votre compte Earthropy.',
  heading: 'Réinitialiser votre mot de passe',
  body: "Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe. Ce lien expire dans 60 minutes et ne peut être utilisé qu'une seule fois.",
  cta: 'Réinitialiser le mot de passe',
  expiry: 'Ce lien expire dans 60 minutes.',
  ignore:
    "Si vous n'avez pas demandé une réinitialisation de mot de passe, ignorez cet e-mail. Votre mot de passe n'a pas changé.",
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

const groupInviteEs: GroupInviteMessages = {
  subject: 'Has sido invitado a unirte a un grupo en Earthropy',
  previewText: 'Haz clic en el enlace para unirte al grupo en Earthropy.',
  heading: 'Has sido invitado a unirte a un grupo',
  body: 'Haz clic en el botón de abajo para aceptar tu invitación. Este enlace expira en 7 días y solo puede usarse una vez.',
  cta: 'Aceptar invitación',
  expiry: 'Este enlace expira en 7 días.',
  ignore: 'Si no esperabas esta invitación, puedes ignorar este correo electrónico con seguridad.',
};

const groupInviteFr: GroupInviteMessages = {
  subject: 'Vous avez été invité à rejoindre un groupe sur Earthropy',
  previewText: 'Cliquez sur le lien pour rejoindre le groupe sur Earthropy.',
  heading: 'Vous avez été invité à rejoindre un groupe',
  body: "Cliquez sur le bouton ci-dessous pour accepter votre invitation. Ce lien expire dans 7 jours et ne peut être utilisé qu'une seule fois.",
  cta: "Accepter l'invitation",
  expiry: 'Ce lien expire dans 7 jours.',
  ignore:
    'Si vous ne vous attendiez pas à cette invitation, vous pouvez ignorer cet e-mail en toute sécurité.',
};

// ---------------------------------------------------------------------------
// verify-email — zh
// ---------------------------------------------------------------------------

const verifyEmailZh: VerifyEmailMessages = {
  subject: '确认您的 Earthropy 电子邮件地址',
  previewText: '点击链接验证您的电子邮件并完成账户设置。',
  heading: '确认您的电子邮件地址',
  body: '点击下方按钮验证您的电子邮件地址。此链接将在 24 小时后过期。',
  cta: '验证电子邮件地址',
  expiry: '此链接将在 24 小时后过期。',
  ignore: '如果您没有创建 Earthropy 账户，请忽略此邮件。',
};

const verifyEmailHi: VerifyEmailMessages = {
  subject: 'अपना Earthropy ईमेल पता पुष्टि करें',
  previewText: 'अपना ईमेल सत्यापित करने और खाता सेटअप पूरा करने के लिए लिंक पर क्लिक करें।',
  heading: 'अपना ईमेल पता पुष्टि करें',
  body: 'अपना ईमेल पता सत्यापित करने के लिए नीचे दिए गए बटन पर क्लिक करें। यह लिंक 24 घंटे में समाप्त हो जाएगा।',
  cta: 'ईमेल पता सत्यापित करें',
  expiry: 'यह लिंक 24 घंटे में समाप्त हो जाएगा।',
  ignore: 'यदि आपने Earthropy खाता नहीं बनाया है, तो इस ईमेल को अनदेखा करें।',
};

// ---------------------------------------------------------------------------
// magic-link — zh, hi
// ---------------------------------------------------------------------------

const magicLinkZh: MagicLinkMessages = {
  subject: '您的 Earthropy 登录链接',
  previewText: '点击链接登录您的 Earthropy 账户。',
  heading: '登录 Earthropy',
  body: '点击下方按钮登录。此链接将在 15 分钟后过期，仅可使用一次。',
  cta: '登录',
  expiry: '此链接将在 15 分钟后过期。',
  ignore: '如果您没有请求登录链接，请忽略此邮件。',
};

const magicLinkHi: MagicLinkMessages = {
  subject: 'आपका Earthropy साइन-इन लिंक',
  previewText: 'अपने Earthropy खाते में साइन इन करने के लिए लिंक पर क्लिक करें।',
  heading: 'Earthropy में साइन इन करें',
  body: 'साइन इन करने के लिए नीचे दिए गए बटन पर क्लिक करें। यह लिंक 15 मिनट में समाप्त हो जाएगा और केवल एक बार उपयोग किया जा सकता है।',
  cta: 'साइन इन करें',
  expiry: 'यह लिंक 15 मिनट में समाप्त हो जाएगा।',
  ignore: 'यदि आपने साइन-इन लिंक का अनुरोध नहीं किया है, तो इस ईमेल को अनदेखा करें।',
};

// ---------------------------------------------------------------------------
// password-reset — zh, hi
// ---------------------------------------------------------------------------

const passwordResetZh: PasswordResetMessages = {
  subject: '重置您的 Earthropy 密码',
  previewText: '点击链接为您的 Earthropy 账户设置新密码。',
  heading: '重置您的密码',
  body: '点击下方按钮设置新密码。此链接将在 60 分钟后过期，仅可使用一次。',
  cta: '重置密码',
  expiry: '此链接将在 60 分钟后过期。',
  ignore: '如果您没有请求重置密码，请忽略此邮件。您的密码未被更改。',
};

const passwordResetHi: PasswordResetMessages = {
  subject: 'अपना Earthropy पासवर्ड रीसेट करें',
  previewText: 'अपने Earthropy खाते के लिए नया पासवर्ड सेट करने हेतु लिंक पर क्लिक करें।',
  heading: 'अपना पासवर्ड रीसेट करें',
  body: 'नया पासवर्ड सेट करने के लिए नीचे दिए गए बटन पर क्लिक करें। यह लिंक 60 मिनट में समाप्त हो जाएगा और केवल एक बार उपयोग किया जा सकता है।',
  cta: 'पासवर्ड रीसेट करें',
  expiry: 'यह लिंक 60 मिनट में समाप्त हो जाएगा।',
  ignore:
    'यदि आपने पासवर्ड रीसेट का अनुरोध नहीं किया है, तो इस ईमेल को अनदेखा करें। आपका पासवर्ड नहीं बदला गया है।',
};

// ---------------------------------------------------------------------------
// group-invite — zh, hi
// ---------------------------------------------------------------------------

const groupInviteZh: GroupInviteMessages = {
  subject: '您已被邀请加入 Earthropy 上的一个小组',
  previewText: '点击链接加入 Earthropy 上的小组。',
  heading: '您已被邀请加入一个小组',
  body: '点击下方按钮接受邀请。此链接将在 7 天后过期，仅可使用一次。',
  cta: '接受邀请',
  expiry: '此链接将在 7 天后过期。',
  ignore: '如果您不期望收到此邀请，可以安全地忽略此邮件。',
};

const groupInviteHi: GroupInviteMessages = {
  subject: 'आपको Earthropy पर एक समूह में शामिल होने के लिए आमंत्रित किया गया है',
  previewText: 'Earthropy पर समूह में शामिल होने के लिए लिंक पर क्लिक करें।',
  heading: 'आपको एक समूह में शामिल होने के लिए आमंत्रित किया गया है',
  body: 'अपना आमंत्रण स्वीकार करने के लिए नीचे दिए गए बटन पर क्लिक करें। यह लिंक 7 दिनों में समाप्त हो जाएगा और केवल एक बार उपयोग किया जा सकता है।',
  cta: 'आमंत्रण स्वीकार करें',
  expiry: 'यह लिंक 7 दिनों में समाप्त हो जाएगा।',
  ignore: 'यदि आप इस आमंत्रण की अपेक्षा नहीं कर रहे थे, तो आप इस ईमेल को सुरक्षित रूप से अनदेखा कर सकते हैं।',
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

function localeOrEn<T>(map: Partial<Record<Locale, T>>, fallback: T, locale: Locale): T {
  return map[locale] ?? fallback;
}

export function getVerifyEmailMessages(locale: Locale): VerifyEmailMessages {
  return localeOrEn<VerifyEmailMessages>(
    { en: verifyEmailEn, ar: verifyEmailAr, es: verifyEmailEs, fr: verifyEmailFr, zh: verifyEmailZh, hi: verifyEmailHi },
    verifyEmailEn,
    locale,
  );
}

export function getMagicLinkMessages(locale: Locale): MagicLinkMessages {
  return localeOrEn<MagicLinkMessages>(
    { en: magicLinkEn, ar: magicLinkAr, es: magicLinkEs, fr: magicLinkFr, zh: magicLinkZh, hi: magicLinkHi },
    magicLinkEn,
    locale,
  );
}

export function getPasswordResetMessages(locale: Locale): PasswordResetMessages {
  return localeOrEn<PasswordResetMessages>(
    { en: passwordResetEn, ar: passwordResetAr, es: passwordResetEs, fr: passwordResetFr, zh: passwordResetZh, hi: passwordResetHi },
    passwordResetEn,
    locale,
  );
}

export function getGroupInviteMessages(locale: Locale): GroupInviteMessages {
  return localeOrEn<GroupInviteMessages>(
    { en: groupInviteEn, ar: groupInviteAr, es: groupInviteEs, fr: groupInviteFr, zh: groupInviteZh, hi: groupInviteHi },
    groupInviteEn,
    locale,
  );
}
