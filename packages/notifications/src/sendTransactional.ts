import { render } from '@react-email/components';
import type { Locale } from '@repo/i18n/locales';
/**
 * sendTransactional — render a React Email template and dispatch via the
 * configured MailTransport.
 *
 * @param to      Recipient email address.
 * @param template Template name: 'verify-email' | 'magic-link' | 'password-reset'.
 * @param props   Template-specific props (URL + any extras).
 * @param locale  BCP47 locale code; drives string selection and RTL direction.
 */
import { createElement } from 'react';
import { MagicLink } from './emails/magic-link.tsx';
import {
  getMagicLinkMessages,
  getPasswordResetMessages,
  getVerifyEmailMessages,
} from './emails/messages/index.ts';
import { PasswordReset } from './emails/password-reset.tsx';
import { VerifyEmail } from './emails/verify-email.tsx';
import { createTransport } from './transport.ts';

export type TemplateName = 'verify-email' | 'magic-link' | 'password-reset';

export interface VerifyEmailProps {
  verifyUrl: string;
}

export interface MagicLinkProps {
  signInUrl: string;
}

export interface PasswordResetProps {
  resetUrl: string;
}

type TemplateProps = {
  'verify-email': VerifyEmailProps;
  'magic-link': MagicLinkProps;
  'password-reset': PasswordResetProps;
};

export interface SendTransactionalInput<T extends TemplateName = TemplateName> {
  to: string;
  template: T;
  props: TemplateProps[T];
  locale: Locale;
}

export async function sendTransactional<T extends TemplateName>(
  input: SendTransactionalInput<T>,
): Promise<void> {
  const { to, template, props, locale } = input;

  const from = process.env.SMTP_FROM ?? 'noreply@earthropy.org';

  let element: React.ReactElement;
  let subject: string;

  switch (template) {
    case 'verify-email': {
      const p = props as VerifyEmailProps;
      element = createElement(VerifyEmail, { verifyUrl: p.verifyUrl, locale });
      subject = getVerifyEmailMessages(locale).subject;
      break;
    }
    case 'magic-link': {
      const p = props as MagicLinkProps;
      element = createElement(MagicLink, { signInUrl: p.signInUrl, locale });
      subject = getMagicLinkMessages(locale).subject;
      break;
    }
    case 'password-reset': {
      const p = props as PasswordResetProps;
      element = createElement(PasswordReset, { resetUrl: p.resetUrl, locale });
      subject = getPasswordResetMessages(locale).subject;
      break;
    }
    default: {
      // TypeScript exhaustiveness check
      const _never: never = template;
      throw new Error(`Unknown email template: "${String(_never)}"`);
    }
  }

  const [html, text] = await Promise.all([
    render(element, { plainText: false }),
    render(element, { plainText: true }),
  ]);

  const transport = createTransport();
  await transport.send({ to, from, subject, html, text });
}
