/**
 * Tests for sendTransactional + SMTP transport.
 *
 * SMTP transport is mocked — no real network needed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Use vi.hoisted so mock refs are initialized before the vi.mock factory runs
const { mockSendMail, mockCreateTransport } = vi.hoisted(() => {
  const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-id' });
  const mockCreateTransport = vi.fn().mockReturnValue({ sendMail: mockSendMail });
  return { mockSendMail, mockCreateTransport };
});

vi.mock('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport,
  },
  createTransport: mockCreateTransport,
}));

import nodemailer from 'nodemailer';
import { sendTransactional } from './sendTransactional.ts';

describe('sendTransactional', () => {
  beforeEach(() => {
    mockSendMail.mockClear();
    mockCreateTransport.mockClear();
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

    // Default env: SMTP mode, MailHog-style (no auth)
    process.env.MAIL_TRANSPORT = 'smtp';
    process.env.SMTP_HOST = 'localhost';
    process.env.SMTP_PORT = '1025';
    process.env.SMTP_FROM = 'noreply@earthropy.test';
    process.env.SMTP_USER = '';
    process.env.SMTP_PASS = '';
  });

  it('calls createTransport with SMTP config from env', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'user@example.com';
    process.env.SMTP_PASS = 'secret';

    await sendTransactional({
      to: 'dest@example.com',
      template: 'verify-email',
      props: { verifyUrl: 'https://example.com/verify/abc' },
      locale: 'en',
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        auth: { user: 'user@example.com', pass: 'secret' },
      }),
    );
  });

  it('omits auth when SMTP_USER is not set (MailHog dev mode)', async () => {
    process.env.SMTP_USER = '';
    process.env.SMTP_PASS = '';

    await sendTransactional({
      to: 'dest@example.com',
      template: 'verify-email',
      props: { verifyUrl: 'https://example.com/verify/abc' },
      locale: 'en',
    });

    const callArg = mockCreateTransport.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArg).not.toHaveProperty('auth');
  });

  describe('verify-email template', () => {
    it('sends an email with correct shape', async () => {
      await sendTransactional({
        to: 'user@example.com',
        template: 'verify-email',
        props: { verifyUrl: 'https://earthropy.test/en/verify-email/abc123' },
        locale: 'en',
      });

      expect(mockSendMail).toHaveBeenCalledOnce();
      const msg = mockSendMail.mock.calls[0]?.[0] as Record<string, unknown>;

      expect(msg).toMatchObject({
        to: 'user@example.com',
        from: 'noreply@earthropy.test',
        subject: expect.any(String),
      });
      expect(msg.html as string).toContain('DOCTYPE html');
      // plaintext must not contain HTML tags
      expect(msg.text as string).not.toMatch(/<[^>]+>/);
      // link token in either html or text
      expect(
        (msg.html as string).includes('abc123') || (msg.text as string).includes('abc123'),
      ).toBe(true);
    });
  });

  describe('magic-link template', () => {
    it('sends an email with correct shape', async () => {
      await sendTransactional({
        to: 'user@example.com',
        template: 'magic-link',
        props: { signInUrl: 'https://earthropy.test/en/signin/magic/xyz789' },
        locale: 'en',
      });

      expect(mockSendMail).toHaveBeenCalledOnce();
      const msg = mockSendMail.mock.calls[0]?.[0] as Record<string, unknown>;

      expect(msg).toMatchObject({
        to: 'user@example.com',
        subject: expect.any(String),
      });
      expect(msg.html as string).toContain('DOCTYPE html');
      expect(msg.text as string).not.toMatch(/<[^>]+>/);
    });
  });

  describe('password-reset template', () => {
    it('sends an email with correct shape', async () => {
      await sendTransactional({
        to: 'user@example.com',
        template: 'password-reset',
        props: { resetUrl: 'https://earthropy.test/en/reset-password/tok456' },
        locale: 'en',
      });

      expect(mockSendMail).toHaveBeenCalledOnce();
      const msg = mockSendMail.mock.calls[0]?.[0] as Record<string, unknown>;

      expect(msg).toMatchObject({
        to: 'user@example.com',
        subject: expect.any(String),
      });
      expect(msg.html as string).toContain('DOCTYPE html');
      expect(msg.text as string).not.toMatch(/<[^>]+>/);
    });
  });

  describe('locale switching', () => {
    it('renders Arabic (RTL) strings for ar locale — verify-email', async () => {
      await sendTransactional({
        to: 'user@example.com',
        template: 'verify-email',
        props: { verifyUrl: 'https://earthropy.test/ar/verify-email/tok' },
        locale: 'ar',
      });

      const msg = mockSendMail.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(msg.html as string).toContain('rtl');
    });

    it('renders Arabic (RTL) strings for ar locale — magic-link', async () => {
      await sendTransactional({
        to: 'user@example.com',
        template: 'magic-link',
        props: { signInUrl: 'https://earthropy.test/ar/signin/magic/tok' },
        locale: 'ar',
      });

      const msg = mockSendMail.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(msg.html as string).toContain('rtl');
    });

    it('renders Arabic (RTL) strings for ar locale — password-reset', async () => {
      await sendTransactional({
        to: 'user@example.com',
        template: 'password-reset',
        props: { resetUrl: 'https://earthropy.test/ar/reset-password/tok' },
        locale: 'ar',
      });

      const msg = mockSendMail.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(msg.html as string).toContain('rtl');
    });
  });

  it('throws on unknown template', async () => {
    const badInput = {
      to: 'user@example.com',
      template: 'unknown-template',
      props: {},
      locale: 'en',
    } as unknown as Parameters<typeof sendTransactional>[0];

    await expect(sendTransactional(badInput)).rejects.toThrow();
  });
});
