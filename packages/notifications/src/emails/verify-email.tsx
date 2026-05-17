/**
 * Email verification template.
 *
 * Renders HTML + plain text (pass { plainText: true } to render()).
 * Colors derived from @repo/design-system theme.css tokens (inlined for email client compat).
 */
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { Locale } from '@repo/i18n/locales';
import { direction } from '@repo/i18n/locales';
import { getVerifyEmailMessages } from './messages/index.ts';

// Design system tokens (light mode; email clients have limited CSS support — inline only)
const colors = {
  paper: '#f7f6f2',
  surface: '#ffffff',
  border: '#e1dfd9',
  text: '#0f0f0f',
  textMuted: '#4a4a4a',
} as const;

export interface VerifyEmailProps {
  verifyUrl: string;
  locale: Locale;
}

export function VerifyEmail({ verifyUrl, locale }: VerifyEmailProps) {
  const m = getVerifyEmailMessages(locale);
  const dir = direction(locale);

  return (
    <Html lang={locale} dir={dir}>
      <Head />
      <Preview>{m.previewText}</Preview>
      <Body
        style={{
          backgroundColor: colors.paper,
          fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, sans-serif",
          margin: '0',
          padding: '0',
        }}
      >
        <Container
          style={{
            maxWidth: '560px',
            margin: '40px auto',
            padding: '0 16px',
          }}
        >
          <Section
            style={{
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: '4px',
              padding: '40px 32px',
            }}
          >
            <Heading
              as="h1"
              style={{
                color: colors.text,
                fontSize: '22px',
                fontWeight: '600',
                lineHeight: '1.3',
                margin: '0 0 16px',
                textAlign: dir === 'rtl' ? 'right' : 'left',
              }}
            >
              {m.heading}
            </Heading>

            <Text
              style={{
                color: colors.textMuted,
                fontSize: '16px',
                lineHeight: '1.5',
                margin: '0 0 24px',
                textAlign: dir === 'rtl' ? 'right' : 'left',
              }}
            >
              {m.body}
            </Text>

            <Button
              href={verifyUrl}
              style={{
                backgroundColor: colors.text,
                borderRadius: '4px',
                color: colors.surface,
                display: 'inline-block',
                fontSize: '15px',
                fontWeight: '600',
                padding: '12px 24px',
                textDecoration: 'none',
              }}
            >
              {m.cta}
            </Button>

            <Hr
              style={{
                borderColor: colors.border,
                margin: '32px 0 24px',
              }}
            />

            <Text
              style={{
                color: colors.textMuted,
                fontSize: '13px',
                lineHeight: '1.5',
                margin: '0 0 8px',
                textAlign: dir === 'rtl' ? 'right' : 'left',
              }}
            >
              {m.expiry}
            </Text>

            <Text
              style={{
                color: colors.textMuted,
                fontSize: '13px',
                lineHeight: '1.5',
                margin: '0',
                textAlign: dir === 'rtl' ? 'right' : 'left',
              }}
            >
              {m.ignore}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

VerifyEmail.PreviewProps = {
  verifyUrl: 'https://earthropy.org/en/verify-email/example-token',
  locale: 'en',
} satisfies VerifyEmailProps;

export default VerifyEmail;
