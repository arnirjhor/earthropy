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
// verify-email — pt, ru, sw
// ---------------------------------------------------------------------------

const verifyEmailPt: VerifyEmailMessages = {
  subject: 'Confirme seu endereço de e-mail na Earthropy',
  previewText: 'Clique no link para verificar seu e-mail e concluir a configuração da sua conta.',
  heading: 'Confirme seu endereço de e-mail',
  body: 'Clique no botão abaixo para verificar seu endereço de e-mail. Este link expira em 24 horas.',
  cta: 'Verificar endereço de e-mail',
  expiry: 'Este link expira em 24 horas.',
  ignore: 'Se você não criou uma conta na Earthropy, ignore este e-mail.',
};

const verifyEmailRu: VerifyEmailMessages = {
  subject: 'Подтвердите адрес электронной почты Earthropy',
  previewText:
    'Перейдите по ссылке, чтобы подтвердить адрес электронной почты и завершить настройку аккаунта.',
  heading: 'Подтвердите адрес электронной почты',
  body: 'Нажмите кнопку ниже, чтобы подтвердить адрес электронной почты. Срок действия ссылки — 24 часа.',
  cta: 'Подтвердить адрес электронной почты',
  expiry: 'Срок действия ссылки — 24 часа.',
  ignore: 'Если вы не создавали аккаунт в Earthropy, проигнорируйте это письмо.',
};

const verifyEmailSw: VerifyEmailMessages = {
  subject: 'Thibitisha anwani yako ya barua pepe ya Earthropy',
  previewText:
    'Bofya kiungo ili kuthibitisha barua pepe yako na kukamilisha usanidi wa akaunti yako.',
  heading: 'Thibitisha anwani yako ya barua pepe',
  body: 'Bofya kitufe hapa chini ili kuthibitisha anwani yako ya barua pepe. Kiungo hiki kitaisha baada ya saa 24.',
  cta: 'Thibitisha anwani ya barua pepe',
  expiry: 'Kiungo hiki kitaisha baada ya saa 24.',
  ignore: 'Ikiwa hukufungua akaunti ya Earthropy, puuza barua pepe hii.',
};

// ---------------------------------------------------------------------------
// magic-link — pt, ru, sw
// ---------------------------------------------------------------------------

const magicLinkPt: MagicLinkMessages = {
  subject: 'Seu link de acesso à Earthropy',
  previewText: 'Clique no link para entrar na sua conta Earthropy.',
  heading: 'Entrar na Earthropy',
  body: 'Clique no botão abaixo para entrar. Este link expira em 15 minutos e só pode ser usado uma vez.',
  cta: 'Entrar',
  expiry: 'Este link expira em 15 minutos.',
  ignore: 'Se você não solicitou um link de acesso, ignore este e-mail.',
};

const magicLinkRu: MagicLinkMessages = {
  subject: 'Ваша ссылка для входа в Earthropy',
  previewText: 'Перейдите по ссылке, чтобы войти в свой аккаунт Earthropy.',
  heading: 'Вход в Earthropy',
  body: 'Нажмите кнопку ниже, чтобы войти. Срок действия ссылки — 15 минут; использовать можно только один раз.',
  cta: 'Войти',
  expiry: 'Срок действия ссылки — 15 минут.',
  ignore: 'Если вы не запрашивали ссылку для входа, проигнорируйте это письмо.',
};

const magicLinkSw: MagicLinkMessages = {
  subject: 'Kiungo chako cha kuingia Earthropy',
  previewText: 'Bofya kiungo ili kuingia kwenye akaunti yako ya Earthropy.',
  heading: 'Ingia kwenye Earthropy',
  body: 'Bofya kitufe hapa chini ili kuingia. Kiungo hiki kitaisha baada ya dakika 15 na kinaweza kutumika mara moja tu.',
  cta: 'Ingia',
  expiry: 'Kiungo hiki kitaisha baada ya dakika 15.',
  ignore: 'Ikiwa hukuomba kiungo cha kuingia, puuza barua pepe hii.',
};

// ---------------------------------------------------------------------------
// password-reset — pt, ru, sw
// ---------------------------------------------------------------------------

const passwordResetPt: PasswordResetMessages = {
  subject: 'Redefinir sua senha da Earthropy',
  previewText: 'Clique no link para definir uma nova senha para sua conta Earthropy.',
  heading: 'Redefinir sua senha',
  body: 'Clique no botão abaixo para definir uma nova senha. Este link expira em 60 minutos e só pode ser usado uma vez.',
  cta: 'Redefinir senha',
  expiry: 'Este link expira em 60 minutos.',
  ignore:
    'Se você não solicitou a redefinição de senha, ignore este e-mail. Sua senha não foi alterada.',
};

const passwordResetRu: PasswordResetMessages = {
  subject: 'Сброс пароля Earthropy',
  previewText: 'Перейдите по ссылке, чтобы задать новый пароль для аккаунта Earthropy.',
  heading: 'Сброс пароля',
  body: 'Нажмите кнопку ниже, чтобы задать новый пароль. Срок действия ссылки — 60 минут; использовать можно только один раз.',
  cta: 'Сбросить пароль',
  expiry: 'Срок действия ссылки — 60 минут.',
  ignore:
    'Если вы не запрашивали сброс пароля, проигнорируйте это письмо. Ваш пароль не был изменён.',
};

const passwordResetSw: PasswordResetMessages = {
  subject: 'Weka upya nenosiri lako la Earthropy',
  previewText: 'Bofya kiungo ili kuweka nenosiri jipya kwa akaunti yako ya Earthropy.',
  heading: 'Weka upya nenosiri lako',
  body: 'Bofya kitufe hapa chini ili kuweka nenosiri jipya. Kiungo hiki kitaisha baada ya dakika 60 na kinaweza kutumika mara moja tu.',
  cta: 'Weka upya nenosiri',
  expiry: 'Kiungo hiki kitaisha baada ya dakika 60.',
  ignore:
    'Ikiwa hukuomba kuweka upya nenosiri, puuza barua pepe hii. Nenosiri lako halijabadilishwa.',
};

// ---------------------------------------------------------------------------
// group-invite — pt, ru, sw
// ---------------------------------------------------------------------------

const groupInvitePt: GroupInviteMessages = {
  subject: 'Você foi convidado a participar de um grupo na Earthropy',
  previewText: 'Clique no link para participar do grupo na Earthropy.',
  heading: 'Você foi convidado a participar de um grupo',
  body: 'Clique no botão abaixo para aceitar o convite. Este link expira em 7 dias e só pode ser usado uma vez.',
  cta: 'Aceitar convite',
  expiry: 'Este link expira em 7 dias.',
  ignore: 'Se você não esperava este convite, pode ignorar este e-mail com segurança.',
};

const groupInviteRu: GroupInviteMessages = {
  subject: 'Вас пригласили в группу на Earthropy',
  previewText: 'Перейдите по ссылке, чтобы присоединиться к группе на Earthropy.',
  heading: 'Вас пригласили в группу',
  body: 'Нажмите кнопку ниже, чтобы принять приглашение. Срок действия ссылки — 7 дней; использовать можно только один раз.',
  cta: 'Принять приглашение',
  expiry: 'Срок действия ссылки — 7 дней.',
  ignore: 'Если вы не ожидали этого приглашения, можете проигнорировать это письмо.',
};

const groupInviteSw: GroupInviteMessages = {
  subject: 'Umealikwa kujiunga na kikundi kwenye Earthropy',
  previewText: 'Bofya kiungo ili kujiunga na kikundi kwenye Earthropy.',
  heading: 'Umealikwa kujiunga na kikundi',
  body: 'Bofya kitufe hapa chini ili kukubali mwaliko wako. Kiungo hiki kitaisha baada ya siku 7 na kinaweza kutumika mara moja tu.',
  cta: 'Kubali mwaliko',
  expiry: 'Kiungo hiki kitaisha baada ya siku 7.',
  ignore: 'Ikiwa hukutarajia mwaliko huu, unaweza kupuuza barua pepe hii kwa usalama.',
};

// ---------------------------------------------------------------------------
// verify-email — ja, id, ko, tr, bn
// ---------------------------------------------------------------------------

const verifyEmailJa: VerifyEmailMessages = {
  subject: 'Earthropyのメールアドレスをご確認ください',
  previewText: 'リンクをクリックしてメールアドレスを確認し、アカウント設定を完了させてください。',
  heading: 'メールアドレスをご確認ください',
  body: '下のボタンをクリックしてメールアドレスを確認してください。このリンクは24時間で有効期限が切れます。',
  cta: 'メールアドレスを確認する',
  expiry: 'このリンクは24時間で有効期限が切れます。',
  ignore: 'Earthropyのアカウントを作成していない場合は、このメールを無視してください。',
};

const verifyEmailId: VerifyEmailMessages = {
  subject: 'Konfirmasi alamat email Earthropy Anda',
  previewText: 'Klik tautan untuk memverifikasi email Anda dan menyelesaikan pengaturan akun.',
  heading: 'Konfirmasi alamat email Anda',
  body: 'Klik tombol di bawah untuk memverifikasi alamat email Anda. Tautan ini kedaluwarsa dalam 24 jam.',
  cta: 'Verifikasi alamat email',
  expiry: 'Tautan ini kedaluwarsa dalam 24 jam.',
  ignore: 'Jika Anda tidak membuat akun Earthropy, abaikan email ini.',
};

const verifyEmailKo: VerifyEmailMessages = {
  subject: 'Earthropy 이메일 주소를 확인해 주세요',
  previewText: '링크를 클릭하여 이메일을 인증하고 계정 설정을 완료하세요.',
  heading: '이메일 주소를 확인해 주세요',
  body: '아래 버튼을 클릭하여 이메일 주소를 인증하세요. 이 링크는 24시간 후에 만료됩니다.',
  cta: '이메일 주소 인증',
  expiry: '이 링크는 24시간 후에 만료됩니다.',
  ignore: 'Earthropy 계정을 만들지 않으셨다면 이 이메일을 무시하세요.',
};

const verifyEmailTr: VerifyEmailMessages = {
  subject: 'Earthropy e-posta adresinizi onaylayın',
  previewText: 'E-postanızı doğrulamak ve hesap kurulumunuzu tamamlamak için bağlantıya tıklayın.',
  heading: 'E-posta adresinizi onaylayın',
  body: 'E-posta adresinizi doğrulamak için aşağıdaki düğmeye tıklayın. Bu bağlantı 24 saat içinde sona erer.',
  cta: 'E-posta adresini doğrula',
  expiry: 'Bu bağlantı 24 saat içinde sona erer.',
  ignore: 'Bir Earthropy hesabı oluşturmadıysanız bu e-postayı dikkate almayın.',
};

const verifyEmailBn: VerifyEmailMessages = {
  subject: 'আপনার Earthropy ইমেইল ঠিকানা নিশ্চিত করুন',
  previewText: 'আপনার ইমেইল যাচাই করতে এবং অ্যাকাউন্ট সেটআপ সম্পন্ন করতে লিংকে ক্লিক করুন।',
  heading: 'আপনার ইমেইল ঠিকানা নিশ্চিত করুন',
  body: 'আপনার ইমেইল ঠিকানা যাচাই করতে নিচের বোতামে ক্লিক করুন। এই লিংকটি ২৪ ঘন্টায় মেয়াদ শেষ হয়ে যাবে।',
  cta: 'ইমেইল ঠিকানা যাচাই করুন',
  expiry: 'এই লিংকটি ২৪ ঘন্টায় মেয়াদ শেষ হয়ে যাবে।',
  ignore: 'আপনি যদি Earthropy অ্যাকাউন্ট তৈরি না করে থাকেন, তাহলে এই ইমেইলটি উপেক্ষা করুন।',
};

// ---------------------------------------------------------------------------
// magic-link — ja, id, ko, tr, bn
// ---------------------------------------------------------------------------

const magicLinkJa: MagicLinkMessages = {
  subject: 'Earthropyへのサインインリンク',
  previewText: 'リンクをクリックしてEarthropyアカウントにサインインしてください。',
  heading: 'Earthropyにサインイン',
  body: '下のボタンをクリックしてサインインしてください。このリンクは15分で有効期限が切れ、1回しか使用できません。',
  cta: 'サインイン',
  expiry: 'このリンクは15分で有効期限が切れます。',
  ignore: 'サインインリンクをリクエストしていない場合は、このメールを無視してください。',
};

const magicLinkId: MagicLinkMessages = {
  subject: 'Tautan masuk Earthropy Anda',
  previewText: 'Klik tautan untuk masuk ke akun Earthropy Anda.',
  heading: 'Masuk ke Earthropy',
  body: 'Klik tombol di bawah untuk masuk. Tautan ini kedaluwarsa dalam 15 menit dan hanya dapat digunakan sekali.',
  cta: 'Masuk',
  expiry: 'Tautan ini kedaluwarsa dalam 15 menit.',
  ignore: 'Jika Anda tidak meminta tautan masuk, abaikan email ini.',
};

const magicLinkKo: MagicLinkMessages = {
  subject: 'Earthropy 로그인 링크',
  previewText: '링크를 클릭하여 Earthropy 계정에 로그인하세요.',
  heading: 'Earthropy에 로그인',
  body: '아래 버튼을 클릭하여 로그인하세요. 이 링크는 15분 후에 만료되며 한 번만 사용할 수 있습니다.',
  cta: '로그인',
  expiry: '이 링크는 15분 후에 만료됩니다.',
  ignore: '로그인 링크를 요청하지 않으셨다면 이 이메일을 무시하세요.',
};

const magicLinkTr: MagicLinkMessages = {
  subject: 'Earthropy giriş bağlantınız',
  previewText: 'Earthropy hesabınıza giriş yapmak için bağlantıya tıklayın.',
  heading: "Earthropy'a giriş yap",
  body: 'Giriş yapmak için aşağıdaki düğmeye tıklayın. Bu bağlantı 15 dakika içinde sona erer ve yalnızca bir kez kullanılabilir.',
  cta: 'Giriş yap',
  expiry: 'Bu bağlantı 15 dakika içinde sona erer.',
  ignore: 'Bir giriş bağlantısı istemediyseniz bu e-postayı dikkate almayın.',
};

const magicLinkBn: MagicLinkMessages = {
  subject: 'আপনার Earthropy সাইন-ইন লিংক',
  previewText: 'আপনার Earthropy অ্যাকাউন্টে সাইন ইন করতে লিংকে ক্লিক করুন।',
  heading: 'Earthropy-তে সাইন ইন করুন',
  body: 'সাইন ইন করতে নিচের বোতামে ক্লিক করুন। এই লিংকটি ১৫ মিনিটে মেয়াদ শেষ হয় এবং শুধুমাত্র একবার ব্যবহার করা যাবে।',
  cta: 'সাইন ইন করুন',
  expiry: 'এই লিংকটি ১৫ মিনিটে মেয়াদ শেষ হয়ে যাবে।',
  ignore: 'আপনি যদি সাইন-ইন লিংক অনুরোধ না করে থাকেন, তাহলে এই ইমেইলটি উপেক্ষা করুন।',
};

// ---------------------------------------------------------------------------
// password-reset — ja, id, ko, tr, bn
// ---------------------------------------------------------------------------

const passwordResetJa: PasswordResetMessages = {
  subject: 'Earthropyのパスワードをリセット',
  previewText: 'リンクをクリックしてEarthropyアカウントの新しいパスワードを設定してください。',
  heading: 'パスワードをリセット',
  body: '下のボタンをクリックして新しいパスワードを設定してください。このリンクは60分で有効期限が切れ、1回しか使用できません。',
  cta: 'パスワードをリセット',
  expiry: 'このリンクは60分で有効期限が切れます。',
  ignore:
    'パスワードリセットをリクエストしていない場合は、このメールを無視してください。パスワードは変更されていません。',
};

const passwordResetId: PasswordResetMessages = {
  subject: 'Atur ulang kata sandi Earthropy Anda',
  previewText: 'Klik tautan untuk menetapkan kata sandi baru untuk akun Earthropy Anda.',
  heading: 'Atur ulang kata sandi Anda',
  body: 'Klik tombol di bawah untuk menetapkan kata sandi baru. Tautan ini kedaluwarsa dalam 60 menit dan hanya dapat digunakan sekali.',
  cta: 'Atur ulang kata sandi',
  expiry: 'Tautan ini kedaluwarsa dalam 60 menit.',
  ignore:
    'Jika Anda tidak meminta pengaturan ulang kata sandi, abaikan email ini. Kata sandi Anda tidak berubah.',
};

const passwordResetKo: PasswordResetMessages = {
  subject: 'Earthropy 비밀번호 재설정',
  previewText: '링크를 클릭하여 Earthropy 계정의 새 비밀번호를 설정하세요.',
  heading: '비밀번호를 재설정하세요',
  body: '아래 버튼을 클릭하여 새 비밀번호를 설정하세요. 이 링크는 60분 후에 만료되며 한 번만 사용할 수 있습니다.',
  cta: '비밀번호 재설정',
  expiry: '이 링크는 60분 후에 만료됩니다.',
  ignore:
    '비밀번호 재설정을 요청하지 않으셨다면 이 이메일을 무시하세요. 비밀번호는 변경되지 않았습니다.',
};

const passwordResetTr: PasswordResetMessages = {
  subject: 'Earthropy şifrenizi sıfırlayın',
  previewText: 'Earthropy hesabınız için yeni bir şifre belirlemek üzere bağlantıya tıklayın.',
  heading: 'Şifrenizi sıfırlayın',
  body: 'Yeni bir şifre belirlemek için aşağıdaki düğmeye tıklayın. Bu bağlantı 60 dakika içinde sona erer ve yalnızca bir kez kullanılabilir.',
  cta: 'Şifreyi sıfırla',
  expiry: 'Bu bağlantı 60 dakika içinde sona erer.',
  ignore:
    'Bir şifre sıfırlama talebinde bulunmadıysanız bu e-postayı dikkate almayın. Şifreniz değiştirilmedi.',
};

const passwordResetBn: PasswordResetMessages = {
  subject: 'আপনার Earthropy পাসওয়ার্ড রিসেট করুন',
  previewText: 'আপনার Earthropy অ্যাকাউন্টের জন্য নতুন পাসওয়ার্ড সেট করতে লিংকে ক্লিক করুন।',
  heading: 'আপনার পাসওয়ার্ড রিসেট করুন',
  body: 'নতুন পাসওয়ার্ড সেট করতে নিচের বোতামে ক্লিক করুন। এই লিংকটি ৬০ মিনিটে মেয়াদ শেষ হয় এবং শুধুমাত্র একবার ব্যবহার করা যাবে।',
  cta: 'পাসওয়ার্ড রিসেট করুন',
  expiry: 'এই লিংকটি ৬০ মিনিটে মেয়াদ শেষ হয়ে যাবে।',
  ignore:
    'আপনি যদি পাসওয়ার্ড রিসেটের অনুরোধ না করে থাকেন, তাহলে এই ইমেইলটি উপেক্ষা করুন। আপনার পাসওয়ার্ড পরিবর্তিত হয়নি।',
};

// ---------------------------------------------------------------------------
// group-invite — ja, id, ko, tr, bn
// ---------------------------------------------------------------------------

const groupInviteJa: GroupInviteMessages = {
  subject: 'Earthropyのグループへ招待されました',
  previewText: 'リンクをクリックしてEarthropyのグループに参加してください。',
  heading: 'グループへの参加を招待されています',
  body: '下のボタンをクリックして招待を承諾してください。このリンクは7日間で有効期限が切れ、1回しか使用できません。',
  cta: '招待を承諾する',
  expiry: 'このリンクは7日間で有効期限が切れます。',
  ignore: 'この招待に心当たりがない場合は、このメールを無視してください。',
};

const groupInviteId: GroupInviteMessages = {
  subject: 'Anda diundang untuk bergabung dengan grup di Earthropy',
  previewText: 'Klik tautan untuk bergabung dengan grup di Earthropy.',
  heading: 'Anda diundang untuk bergabung dengan grup',
  body: 'Klik tombol di bawah untuk menerima undangan Anda. Tautan ini kedaluwarsa dalam 7 hari dan hanya dapat digunakan sekali.',
  cta: 'Terima undangan',
  expiry: 'Tautan ini kedaluwarsa dalam 7 hari.',
  ignore:
    'Jika Anda tidak mengharapkan undangan ini, Anda dapat mengabaikan email ini dengan aman.',
};

const groupInviteKo: GroupInviteMessages = {
  subject: 'Earthropy 그룹에 초대받으셨습니다',
  previewText: '링크를 클릭하여 Earthropy 그룹에 참가하세요.',
  heading: '그룹에 초대받으셨습니다',
  body: '아래 버튼을 클릭하여 초대를 수락하세요. 이 링크는 7일 후에 만료되며 한 번만 사용할 수 있습니다.',
  cta: '초대 수락',
  expiry: '이 링크는 7일 후에 만료됩니다.',
  ignore: '이 초대를 예상하지 않으셨다면 이 이메일을 안전하게 무시할 수 있습니다.',
};

const groupInviteTr: GroupInviteMessages = {
  subject: "Earthropy'daki bir gruba katılmaya davet edildiniz",
  previewText: "Earthropy'daki gruba katılmak için bağlantıya tıklayın.",
  heading: 'Bir gruba katılmaya davet edildiniz',
  body: 'Davetinizi kabul etmek için aşağıdaki düğmeye tıklayın. Bu bağlantı 7 gün içinde sona erer ve yalnızca bir kez kullanılabilir.',
  cta: 'Daveti kabul et',
  expiry: 'Bu bağlantı 7 gün içinde sona erer.',
  ignore: 'Bu daveti beklemiyorsanız bu e-postayı güvenle dikkate almayabilirsiniz.',
};

const groupInviteBn: GroupInviteMessages = {
  subject: 'আপনাকে Earthropy-তে একটি গ্রুপে যোগ দিতে আমন্ত্রণ জানানো হয়েছে',
  previewText: 'Earthropy-তে গ্রুপে যোগ দিতে লিংকে ক্লিক করুন।',
  heading: 'আপনাকে একটি গ্রুপে যোগ দিতে আমন্ত্রণ জানানো হয়েছে',
  body: 'আপনার আমন্ত্রণ গ্রহণ করতে নিচের বোতামে ক্লিক করুন। এই লিংকটি ৭ দিনে মেয়াদ শেষ হয় এবং শুধুমাত্র একবার ব্যবহার করা যাবে।',
  cta: 'আমন্ত্রণ গ্রহণ করুন',
  expiry: 'এই লিংকটি ৭ দিনে মেয়াদ শেষ হয়ে যাবে।',
  ignore: 'আপনি যদি এই আমন্ত্রণের প্রত্যাশা না করে থাকেন, তাহলে এই ইমেইলটি নিরাপদে উপেক্ষা করতে পারেন।',
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

function localeOrEn<T>(map: Partial<Record<Locale, T>>, fallback: T, locale: Locale): T {
  return map[locale] ?? fallback;
}

export function getVerifyEmailMessages(locale: Locale): VerifyEmailMessages {
  return localeOrEn<VerifyEmailMessages>(
    {
      en: verifyEmailEn,
      ar: verifyEmailAr,
      es: verifyEmailEs,
      fr: verifyEmailFr,
      zh: verifyEmailZh,
      hi: verifyEmailHi,
      pt: verifyEmailPt,
      ru: verifyEmailRu,
      sw: verifyEmailSw,
      ja: verifyEmailJa,
      id: verifyEmailId,
      ko: verifyEmailKo,
      tr: verifyEmailTr,
      bn: verifyEmailBn,
    },
    verifyEmailEn,
    locale,
  );
}

export function getMagicLinkMessages(locale: Locale): MagicLinkMessages {
  return localeOrEn<MagicLinkMessages>(
    {
      en: magicLinkEn,
      ar: magicLinkAr,
      es: magicLinkEs,
      fr: magicLinkFr,
      zh: magicLinkZh,
      hi: magicLinkHi,
      pt: magicLinkPt,
      ru: magicLinkRu,
      sw: magicLinkSw,
      ja: magicLinkJa,
      id: magicLinkId,
      ko: magicLinkKo,
      tr: magicLinkTr,
      bn: magicLinkBn,
    },
    magicLinkEn,
    locale,
  );
}

export function getPasswordResetMessages(locale: Locale): PasswordResetMessages {
  return localeOrEn<PasswordResetMessages>(
    {
      en: passwordResetEn,
      ar: passwordResetAr,
      es: passwordResetEs,
      fr: passwordResetFr,
      zh: passwordResetZh,
      hi: passwordResetHi,
      pt: passwordResetPt,
      ru: passwordResetRu,
      sw: passwordResetSw,
      ja: passwordResetJa,
      id: passwordResetId,
      ko: passwordResetKo,
      tr: passwordResetTr,
      bn: passwordResetBn,
    },
    passwordResetEn,
    locale,
  );
}

export function getGroupInviteMessages(locale: Locale): GroupInviteMessages {
  return localeOrEn<GroupInviteMessages>(
    {
      en: groupInviteEn,
      ar: groupInviteAr,
      es: groupInviteEs,
      fr: groupInviteFr,
      zh: groupInviteZh,
      hi: groupInviteHi,
      pt: groupInvitePt,
      ru: groupInviteRu,
      sw: groupInviteSw,
      ja: groupInviteJa,
      id: groupInviteId,
      ko: groupInviteKo,
      tr: groupInviteTr,
      bn: groupInviteBn,
    },
    groupInviteEn,
    locale,
  );
}
