import * as nodemailer from 'nodemailer';

export interface EmailConfig {
  provider: 'smtp' | 'resend' | 'ses' | 'postmark';
  from: string;
  apiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private from: string;

  constructor(config: EmailConfig) {
    this.from = config.from;

    if (config.provider === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: config.smtpHost || 'localhost',
        port: config.smtpPort || 587,
        secure: config.smtpSecure || false,
        auth: config.apiKey
          ? {
              user: 'apikey',
              pass: config.apiKey
            }
          : undefined
      });
    } else {
      // For other providers, you'd integrate their SDKs here
      throw new Error(`Email provider ${config.provider} not yet implemented`);
    }
  }

  /**
   * Send OTP verification email
   */
  async sendOTP(to: string, code: string, expiresIn: number): Promise<void> {
    const subject = '[ClusterCord] Verification Code for Terminal Session';
    const text = `Your ClusterCord verification code: ${code}\n\nThis code expires in ${expiresIn} seconds.\n\nIf you did not request this, please revoke access immediately in Discord or notify your admin.`;
    const html = `
      <h2>ClusterCord Verification</h2>
      <p>Your verification code is:</p>
      <h1 style="font-family: monospace; letter-spacing: 0.5em; background: #f4f4f4; padding: 20px; text-align: center;">${code}</h1>
      <p>This code expires in <strong>${expiresIn} seconds</strong>.</p>
      <hr>
      <p style="color: #666; font-size: 12px;">If you did not request this, please revoke access immediately in Discord or notify your admin.</p>
    `;

    await this.send(to, subject, text, html);
  }

  /**
   * Send generic email
   */
  async send(to: string, subject: string, text: string, html?: string): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        html: html || text
      });

      console.log(`[EMAIL] Sent to ${to}: ${info.messageId}`);
    } catch (error) {
      console.error('[EMAIL] Failed to send:', error);
      throw new Error(`Failed to send email: ${error}`);
    }
  }

  /**
   * Verify email service is working
   */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('[EMAIL] Verification failed:', error);
      return false;
    }
  }
}

/**
 * Create email service from environment variables
 */
export function createEmailService(): EmailService {
  const config: EmailConfig = {
    provider: (process.env.EMAIL_PROVIDER as any) || 'smtp',
    from: process.env.EMAIL_FROM || 'ClusterCord <noreply@example.com>',
    apiKey: process.env.EMAIL_PROVIDER_API_KEY,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined,
    smtpSecure: process.env.SMTP_SECURE === 'true'
  };

  return new EmailService(config);
}
