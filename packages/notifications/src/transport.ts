/**
 * Mail transport interface + implementations.
 *
 * Default transport: SMTP via Nodemailer (reads SMTP_* env vars).
 * Optional stub: ResendTransport (not active in v0.1; set MAIL_TRANSPORT=resend + RESEND_API_KEY to enable when ready).
 *
 * Architecture §8.2: interface is symmetric so a self-hoster can swap transports.
 */
import nodemailer from 'nodemailer';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface MailMessage {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}

// ---------------------------------------------------------------------------
// SMTP transport (default)
// ---------------------------------------------------------------------------

function buildSmtpConfig(): nodemailer.TransportOptions {
  const host = process.env.SMTP_HOST ?? 'localhost';
  const port = Number(process.env.SMTP_PORT ?? 1025);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const base = { host, port, secure: port === 465 } as Record<string, unknown>;
  if (user && pass) {
    base.auth = { user, pass };
  }
  return base as nodemailer.TransportOptions;
}

export class SmtpTransport implements MailTransport {
  readonly #from: string;

  constructor() {
    this.#from = process.env.SMTP_FROM ?? 'noreply@earthropy.org';
  }

  async send(message: MailMessage): Promise<void> {
    const transporter = nodemailer.createTransport(buildSmtpConfig());
    await transporter.sendMail({
      from: message.from || this.#from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: message.headers,
    });
  }
}

// ---------------------------------------------------------------------------
// Resend stub adapter (v0.1: not active; swap MAIL_TRANSPORT=resend + RESEND_API_KEY)
// ---------------------------------------------------------------------------

/*
export class ResendTransport implements MailTransport {
  readonly #apiKey: string;

  constructor() {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is required for ResendTransport');
    this.#apiKey = key;
  }

  async send(message: MailMessage): Promise<void> {
    const { Resend } = await import('resend');
    const resend = new Resend(this.#apiKey);
    await resend.emails.send({
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: message.headers,
    });
  }
}
*/

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns the active MailTransport based on the MAIL_TRANSPORT env var.
 * Default: 'smtp'. Future: 'resend'.
 */
export function createTransport(): MailTransport {
  const kind = process.env.MAIL_TRANSPORT ?? 'smtp';
  if (kind === 'smtp') return new SmtpTransport();
  // Uncomment when Resend adapter is activated:
  // if (kind === 'resend') return new ResendTransport();
  throw new Error(`Unknown MAIL_TRANSPORT: "${kind}". Supported: smtp`);
}
