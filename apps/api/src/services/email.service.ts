import { Resend } from 'resend';
import { config } from '../config';
import { logger } from '../config/logger';
import { configService } from './config.service';

/** Escape HTML entities to prevent XSS in email templates. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Cached Resend client that is recreated when the API key changes
let cachedResend: Resend | null = config.email.resendApiKey ? new Resend(config.email.resendApiKey) : null;
let cachedResendApiKey: string = config.email.resendApiKey;

/**
 * Get or lazily create the Resend client.
 * Recreates the client if the API key has changed (e.g. updated via admin dashboard).
 * Falls back to static config if configService fails.
 */
async function getResendClient(): Promise<Resend | null> {
  let apiKey: string;
  try {
    apiKey = await configService.get('RESEND_API_KEY');
  } catch {
    apiKey = config.email.resendApiKey;
  }
  if (!apiKey) {
    apiKey = config.email.resendApiKey;
  }

  if (!apiKey) {
    return null;
  }

  if (!cachedResend || apiKey !== cachedResendApiKey) {
    cachedResend = new Resend(apiKey);
    cachedResendApiKey = apiKey;
  }

  return cachedResend;
}

/**
 * Get the from address dynamically.
 * Falls back to static config if configService fails.
 */
async function getFromAddress(): Promise<string> {
  try {
    const from = await configService.get('EMAIL_FROM');
    return from || config.email.from;
  } catch {
    return config.email.from;
  }
}

export class EmailService {
  async sendEmailVerification(to: string, verifyToken: string, locale: string = 'en') {
    const verifyUrl = `${config.frontendUrl}/${locale}/verify-email?token=${verifyToken}`;

    const resend = await getResendClient();
    if (!resend) {
      logger.debug({ to }, 'Email verification requested (no email provider configured)');
      return;
    }

    const fromAddress = await getFromAddress();
    await resend.emails.send({
      from: fromAddress,
      to,
      subject: locale === 'ar'
        ? 'Mojeeb - تأكيد بريدك الإلكتروني'
        : 'Verify Your Email - Mojeeb',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #6366f1; font-size: 28px; margin: 0;">Mojeeb</h1>
          </div>

          <!-- English -->
          <div style="margin-bottom: 32px;">
            <h2 style="color: #1f2937; font-size: 20px;">Verify Your Email</h2>
            <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
              Welcome to Mojeeb! Please verify your email address by clicking the button below.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${verifyUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
                Verify Email
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 12px;">
              This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
            </p>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

          <!-- Arabic -->
          <div dir="rtl" style="text-align: right;">
            <h2 style="color: #1f2937; font-size: 20px;">تأكيد بريدك الإلكتروني</h2>
            <p style="color: #4b5563; font-size: 14px; line-height: 1.8;">
              مرحباً بك في موجيب! يرجى تأكيد بريدك الإلكتروني بالضغط على الزر أدناه.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${verifyUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
                تأكيد البريد الإلكتروني
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 12px;">
              ينتهي هذا الرابط خلال 24 ساعة. إذا لم تقم بإنشاء حساب، يمكنك تجاهل هذا البريد.
            </p>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 11px; text-align: center;">
            Mojeeb AI Customer Support Platform
          </p>
        </div>
      `,
    });
  }

  async sendPasswordResetEmail(to: string, resetToken: string, locale: string = 'en') {
    const resetUrl = `${config.frontendUrl}/${locale}/reset-password?token=${resetToken}`;

    const resend = await getResendClient();
    if (!resend) {
      logger.debug({ to }, 'Password reset requested (no email provider configured)');
      return;
    }

    const fromAddress = await getFromAddress();
    await resend.emails.send({
      from: fromAddress,
      to,
      subject: locale === 'ar'
        ? 'Mojeeb - إعادة تعيين كلمة المرور'
        : 'Reset Your Password - Mojeeb',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #6366f1; font-size: 28px; margin: 0;">Mojeeb</h1>
          </div>

          <!-- English -->
          <div style="margin-bottom: 32px;">
            <h2 style="color: #1f2937; font-size: 20px;">Reset Your Password</h2>
            <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
              You requested a password reset. Click the button below to set a new password.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${resetUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
                Reset Password
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 12px;">
              This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
            </p>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

          <!-- Arabic -->
          <div dir="rtl" style="text-align: right;">
            <h2 style="color: #1f2937; font-size: 20px;">إعادة تعيين كلمة المرور</h2>
            <p style="color: #4b5563; font-size: 14px; line-height: 1.8;">
              لقد طلبت إعادة تعيين كلمة المرور. اضغط على الزر أدناه لتعيين كلمة مرور جديدة.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${resetUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
                إعادة تعيين كلمة المرور
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 12px;">
              ينتهي هذا الرابط خلال ساعة واحدة. إذا لم تطلب ذلك، يمكنك تجاهل هذا البريد.
            </p>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 11px; text-align: center;">
            Mojeeb AI Customer Support Platform
          </p>
        </div>
      `,
    });
  }

  async sendWelcomeEmail(to: string, firstName: string, locale: string = 'en') {
    const resend = await getResendClient();
    if (!resend) {
      logger.debug({ to, firstName }, 'Welcome email skipped (no email provider configured)');
      return;
    }

    const fromAddress = await getFromAddress();
    await resend.emails.send({
      from: fromAddress,
      to,
      subject: locale === 'ar'
        ? 'Mojeeb - مرحباً بك!'
        : 'Welcome to Mojeeb!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #6366f1; font-size: 28px; margin: 0;">Mojeeb</h1>
          </div>

          <!-- English -->
          <div style="margin-bottom: 32px;">
            <h2 style="color: #1f2937; font-size: 20px;">Welcome, ${escapeHtml(firstName)}!</h2>
            <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
              Your email has been verified successfully. You're all set to start using Mojeeb AI Customer Support.
            </p>
            <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
              Get started by creating your first AI agent and connecting a channel.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${config.frontendUrl}/en/agents" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
                Get Started
              </a>
            </div>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

          <!-- Arabic -->
          <div dir="rtl" style="text-align: right;">
            <h2 style="color: #1f2937; font-size: 20px;">مرحباً، ${escapeHtml(firstName)}!</h2>
            <p style="color: #4b5563; font-size: 14px; line-height: 1.8;">
              تم تأكيد بريدك الإلكتروني بنجاح. أنت الآن جاهز لبدء استخدام موجيب لدعم العملاء بالذكاء الاصطناعي.
            </p>
            <p style="color: #4b5563; font-size: 14px; line-height: 1.8;">
              ابدأ بإنشاء أول وكيل ذكاء اصطناعي وربط قناة اتصال.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${config.frontendUrl}/ar/agents" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
                ابدأ الآن
              </a>
            </div>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 11px; text-align: center;">
            Mojeeb AI Customer Support Platform
          </p>
        </div>
      `,
    });
  }
  async sendDemoRequestNotification(data: {
    name: string;
    email: string;
    phone: string;
    company?: string;
    message?: string;
  }) {
    const resend = await getResendClient();
    if (!resend) {
      logger.debug({ name: data.name, email: data.email }, 'Demo request notification skipped (no email provider configured)');
      return;
    }

    const fromAddress = await getFromAddress();
    // Notify the Mojeeb team
    await resend.emails.send({
      from: fromAddress,
      to: (await configService.get('SALES_EMAIL')) || 'sales@mojeeb.app',
      subject: `New Demo Request from ${data.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #6366f1; font-size: 28px; margin: 0;">Mojeeb</h1>
          </div>
          <h2 style="color: #1f2937; font-size: 20px;">New Demo Call Request</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tr><td style="padding: 8px; color: #6b7280; font-size: 14px;">Name</td><td style="padding: 8px; font-size: 14px; font-weight: 600;">${escapeHtml(data.name)}</td></tr>
            <tr><td style="padding: 8px; color: #6b7280; font-size: 14px;">Email</td><td style="padding: 8px; font-size: 14px;">${escapeHtml(data.email)}</td></tr>
            <tr><td style="padding: 8px; color: #6b7280; font-size: 14px;">Phone</td><td style="padding: 8px; font-size: 14px;" dir="ltr">${escapeHtml(data.phone)}</td></tr>
            ${data.company ? `<tr><td style="padding: 8px; color: #6b7280; font-size: 14px;">Company</td><td style="padding: 8px; font-size: 14px;">${escapeHtml(data.company)}</td></tr>` : ''}
            ${data.message ? `<tr><td style="padding: 8px; color: #6b7280; font-size: 14px;">Message</td><td style="padding: 8px; font-size: 14px;">${escapeHtml(data.message)}</td></tr>` : ''}
          </table>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 11px; text-align: center;">Mojeeb AI Customer Support Platform</p>
        </div>
      `,
    });

    // Send confirmation to the requester
    await resend.emails.send({
      from: fromAddress,
      to: data.email,
      subject: 'Demo Request Received - Mojeeb',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #6366f1; font-size: 28px; margin: 0;">Mojeeb</h1>
          </div>
          <div style="margin-bottom: 32px;">
            <h2 style="color: #1f2937; font-size: 20px;">Thank you, ${escapeHtml(data.name)}!</h2>
            <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">We've received your demo request. Our team will contact you within 24 hours to schedule a call.</p>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <div dir="rtl" style="text-align: right;">
            <h2 style="color: #1f2937; font-size: 20px;">شكراً لك، ${escapeHtml(data.name)}!</h2>
            <p style="color: #4b5563; font-size: 14px; line-height: 1.8;">لقد استلمنا طلبك للعرض التوضيحي. سيتواصل معك فريقنا خلال 24 ساعة لتحديد موعد المكالمة.</p>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 11px; text-align: center;">Mojeeb AI Customer Support Platform</p>
        </div>
      `,
    });
  }
  async sendContactNotification(data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) {
    const resend = await getResendClient();
    if (!resend) {
      logger.debug({ name: data.name, email: data.email, subject: data.subject }, 'Contact notification skipped (no email provider configured)');
      return;
    }

    const fromAddress = await getFromAddress();
    await resend.emails.send({
      from: fromAddress,
      to: (await configService.get('SUPPORT_EMAIL')) || 'support@mojeeb.app',
      subject: `Contact: ${data.subject} — from ${data.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #6366f1; font-size: 28px; margin: 0;">Mojeeb</h1>
          </div>
          <h2 style="color: #1f2937; font-size: 20px;">New Contact Message</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tr><td style="padding: 8px; color: #6b7280; font-size: 14px;">Name</td><td style="padding: 8px; font-size: 14px; font-weight: 600;">${escapeHtml(data.name)}</td></tr>
            <tr><td style="padding: 8px; color: #6b7280; font-size: 14px;">Email</td><td style="padding: 8px; font-size: 14px;">${escapeHtml(data.email)}</td></tr>
            <tr><td style="padding: 8px; color: #6b7280; font-size: 14px;">Subject</td><td style="padding: 8px; font-size: 14px; font-weight: 600;">${escapeHtml(data.subject)}</td></tr>
          </table>
          <div style="margin-top: 16px; padding: 16px; background: #f9fafb; border-radius: 8px;">
            <p style="color: #1f2937; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(data.message)}</p>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 11px; text-align: center;">Mojeeb AI Customer Support Platform</p>
        </div>
      `,
    });

    // Auto-reply to sender
    await resend.emails.send({
      from: fromAddress,
      to: data.email,
      subject: 'We received your message - Mojeeb',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #6366f1; font-size: 28px; margin: 0;">Mojeeb</h1>
          </div>
          <div style="margin-bottom: 32px;">
            <h2 style="color: #1f2937; font-size: 20px;">Thank you, ${escapeHtml(data.name)}!</h2>
            <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">We've received your message and will get back to you as soon as possible.</p>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <div dir="rtl" style="text-align: right;">
            <h2 style="color: #1f2937; font-size: 20px;">شكراً لك، ${escapeHtml(data.name)}!</h2>
            <p style="color: #4b5563; font-size: 14px; line-height: 1.8;">لقد استلمنا رسالتك وسنرد عليك في أقرب وقت ممكن.</p>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 11px; text-align: center;">Mojeeb AI Customer Support Platform</p>
        </div>
      `,
    });
  }
  async sendCustomEmail(to: string, subject: string, body: string, firstName?: string) {
    const resend = await getResendClient();
    if (!resend) {
      logger.debug({ to, subject }, 'Custom email skipped (no email provider configured)');
      return;
    }

    const fromAddress = await getFromAddress();
    await resend.emails.send({
      from: fromAddress,
      to,
      subject: `${subject} - Mojeeb`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #6366f1; font-size: 28px; margin: 0;">Mojeeb</h1>
          </div>
          <div style="margin-bottom: 32px;">
            ${firstName ? `<p style="color: #1f2937; font-size: 16px; font-weight: 600;">Hi ${escapeHtml(firstName)},</p>` : ''}
            <div style="color: #4b5563; font-size: 14px; line-height: 1.8; white-space: pre-wrap;">${escapeHtml(body)}</div>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 11px; text-align: center;">Mojeeb AI Customer Support Platform</p>
        </div>
      `,
    });
  }
}

export const emailService = new EmailService();
