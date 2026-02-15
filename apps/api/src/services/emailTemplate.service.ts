import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../config/logger';

const CACHE_PREFIX = 'email-tpl:';
const CACHE_TTL = 300; // 5 minutes

export class EmailTemplateService {
  async getByKey(key: string) {
    // Try Redis cache first
    const cached = await redis.get(`${CACHE_PREFIX}${key}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const template = await prisma.emailTemplate.findUnique({ where: { key } });
    if (template) {
      await redis.setex(`${CACHE_PREFIX}${key}`, CACHE_TTL, JSON.stringify(template));
    }
    return template;
  }

  async renderTemplate(
    key: string,
    variables: Record<string, string>,
    locale: 'en' | 'ar' = 'en',
  ) {
    const template = await this.getByKey(key);
    if (!template) {
      throw new Error(`Email template "${key}" not found`);
    }

    const subject = locale === 'ar' && template.subjectAr
      ? template.subjectAr
      : template.subject;

    const html = locale === 'ar' && template.bodyHtmlAr
      ? template.bodyHtmlAr
      : template.bodyHtml;

    const text = template.bodyText || '';

    // Replace {{varName}} placeholders
    const replace = (str: string) =>
      str.replace(/\{\{(\w+)\}\}/g, (_, varName) => variables[varName] ?? '');

    return {
      subject: replace(subject),
      html: replace(html),
      text: replace(text),
    };
  }

  async list() {
    return prisma.emailTemplate.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async upsert(data: {
    key: string;
    subject: string;
    subjectAr?: string;
    bodyHtml: string;
    bodyHtmlAr?: string;
    bodyText?: string;
    variables?: string[];
  }) {
    const result = await prisma.emailTemplate.upsert({
      where: { key: data.key },
      update: {
        subject: data.subject,
        subjectAr: data.subjectAr ?? '',
        bodyHtml: data.bodyHtml,
        bodyHtmlAr: data.bodyHtmlAr ?? '',
        bodyText: data.bodyText ?? null,
        variables: data.variables ?? [],
      },
      create: {
        key: data.key,
        subject: data.subject,
        subjectAr: data.subjectAr ?? '',
        bodyHtml: data.bodyHtml,
        bodyHtmlAr: data.bodyHtmlAr ?? '',
        bodyText: data.bodyText ?? null,
        variables: data.variables ?? [],
      },
    });

    // Invalidate cache
    await redis.del(`${CACHE_PREFIX}${data.key}`);
    return result;
  }

  async delete(key: string) {
    await prisma.emailTemplate.delete({ where: { key } });
    await redis.del(`${CACHE_PREFIX}${key}`);
  }

  async seedDefaults() {
    const baseStyle = `
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 24px; }
        .header h1 { color: #6366f1; font-size: 28px; margin: 0; }
        .content { background: #ffffff; border-radius: 8px; padding: 32px; margin-bottom: 24px; }
        .btn { display: inline-block; background: #6366f1; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .footer { text-align: center; color: #9ca3af; font-size: 11px; padding: 16px 0; }
        hr { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
      </style>
    `;

    const defaults = [
      {
        key: 'WELCOME',
        subject: 'Welcome to Mojeeb, {{firstName}}!',
        subjectAr: 'مرحباً بك في موجيب، {{firstName}}!',
        bodyHtml: `${baseStyle}<div class="container"><div class="header"><h1>Mojeeb</h1></div><div class="content"><h2>Welcome, {{firstName}}!</h2><p>Your email has been verified. You're ready to start using Mojeeb AI Customer Support.</p><p>Get started by creating your first AI agent.</p><div style="text-align:center;margin:24px 0"><a href="{{dashboardUrl}}" class="btn">Get Started</a></div></div><div class="footer">Mojeeb AI Customer Support Platform</div></div>`,
        bodyHtmlAr: `${baseStyle}<div class="container" dir="rtl"><div class="header"><h1>موجيب</h1></div><div class="content"><h2>مرحباً، {{firstName}}!</h2><p>تم تأكيد بريدك الإلكتروني. أنت جاهز لاستخدام موجيب لدعم العملاء بالذكاء الاصطناعي.</p><div style="text-align:center;margin:24px 0"><a href="{{dashboardUrl}}" class="btn">ابدأ الآن</a></div></div><div class="footer">منصة موجيب لدعم العملاء بالذكاء الاصطناعي</div></div>`,
        variables: ['firstName', 'dashboardUrl'],
      },
      {
        key: 'PASSWORD_RESET',
        subject: 'Reset Your Password - Mojeeb',
        subjectAr: 'إعادة تعيين كلمة المرور - موجيب',
        bodyHtml: `${baseStyle}<div class="container"><div class="header"><h1>Mojeeb</h1></div><div class="content"><h2>Reset Your Password</h2><p>You requested a password reset. Click the button below to set a new password.</p><div style="text-align:center;margin:24px 0"><a href="{{resetUrl}}" class="btn">Reset Password</a></div><p style="color:#9ca3af;font-size:12px">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p></div><div class="footer">Mojeeb AI Customer Support Platform</div></div>`,
        bodyHtmlAr: `${baseStyle}<div class="container" dir="rtl"><div class="header"><h1>موجيب</h1></div><div class="content"><h2>إعادة تعيين كلمة المرور</h2><p>لقد طلبت إعادة تعيين كلمة المرور. اضغط على الزر أدناه لتعيين كلمة مرور جديدة.</p><div style="text-align:center;margin:24px 0"><a href="{{resetUrl}}" class="btn">إعادة تعيين كلمة المرور</a></div><p style="color:#9ca3af;font-size:12px">ينتهي هذا الرابط خلال ساعة واحدة.</p></div><div class="footer">منصة موجيب لدعم العملاء بالذكاء الاصطناعي</div></div>`,
        variables: ['resetUrl'],
      },
      {
        key: 'EMAIL_VERIFICATION',
        subject: 'Verify Your Email - Mojeeb',
        subjectAr: 'تأكيد بريدك الإلكتروني - موجيب',
        bodyHtml: `${baseStyle}<div class="container"><div class="header"><h1>Mojeeb</h1></div><div class="content"><h2>Verify Your Email</h2><p>Welcome to Mojeeb! Please verify your email address by clicking the button below.</p><div style="text-align:center;margin:24px 0"><a href="{{verifyUrl}}" class="btn">Verify Email</a></div><p style="color:#9ca3af;font-size:12px">This link expires in 24 hours.</p></div><div class="footer">Mojeeb AI Customer Support Platform</div></div>`,
        bodyHtmlAr: `${baseStyle}<div class="container" dir="rtl"><div class="header"><h1>موجيب</h1></div><div class="content"><h2>تأكيد بريدك الإلكتروني</h2><p>مرحباً بك في موجيب! يرجى تأكيد بريدك الإلكتروني بالضغط على الزر أدناه.</p><div style="text-align:center;margin:24px 0"><a href="{{verifyUrl}}" class="btn">تأكيد البريد</a></div><p style="color:#9ca3af;font-size:12px">ينتهي هذا الرابط خلال 24 ساعة.</p></div><div class="footer">منصة موجيب لدعم العملاء بالذكاء الاصطناعي</div></div>`,
        variables: ['verifyUrl'],
      },
      {
        key: 'CUSTOM_EMAIL',
        subject: '{{subject}}',
        subjectAr: '{{subject}}',
        bodyHtml: `${baseStyle}<div class="container"><div class="header"><h1>Mojeeb</h1></div><div class="content"><h2>Hi {{firstName}},</h2><div>{{body}}</div></div><div class="footer">Mojeeb AI Customer Support Platform</div></div>`,
        bodyHtmlAr: `${baseStyle}<div class="container" dir="rtl"><div class="header"><h1>موجيب</h1></div><div class="content"><h2>مرحباً {{firstName}}،</h2><div>{{body}}</div></div><div class="footer">منصة موجيب لدعم العملاء بالذكاء الاصطناعي</div></div>`,
        variables: ['firstName', 'subject', 'body'],
      },
      {
        key: 'DEMO_REQUEST_NOTIFICATION',
        subject: 'New Demo Request from {{name}}',
        subjectAr: 'طلب عرض جديد من {{name}}',
        bodyHtml: `${baseStyle}<div class="container"><div class="header"><h1>Mojeeb</h1></div><div class="content"><h2>New Demo Request</h2><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px;color:#6b7280">Name</td><td style="padding:8px;font-weight:600">{{name}}</td></tr><tr><td style="padding:8px;color:#6b7280">Email</td><td style="padding:8px">{{email}}</td></tr><tr><td style="padding:8px;color:#6b7280">Phone</td><td style="padding:8px">{{phone}}</td></tr><tr><td style="padding:8px;color:#6b7280">Company</td><td style="padding:8px">{{company}}</td></tr><tr><td style="padding:8px;color:#6b7280">Message</td><td style="padding:8px">{{message}}</td></tr></table></div><div class="footer">Mojeeb AI Customer Support Platform</div></div>`,
        bodyHtmlAr: `${baseStyle}<div class="container" dir="rtl"><div class="header"><h1>موجيب</h1></div><div class="content"><h2>طلب عرض جديد</h2><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px;color:#6b7280">الاسم</td><td style="padding:8px;font-weight:600">{{name}}</td></tr><tr><td style="padding:8px;color:#6b7280">البريد</td><td style="padding:8px">{{email}}</td></tr><tr><td style="padding:8px;color:#6b7280">الهاتف</td><td style="padding:8px">{{phone}}</td></tr><tr><td style="padding:8px;color:#6b7280">الشركة</td><td style="padding:8px">{{company}}</td></tr><tr><td style="padding:8px;color:#6b7280">الرسالة</td><td style="padding:8px">{{message}}</td></tr></table></div><div class="footer">منصة موجيب لدعم العملاء بالذكاء الاصطناعي</div></div>`,
        variables: ['name', 'email', 'phone', 'company', 'message'],
      },
      {
        key: 'CONTACT_NOTIFICATION',
        subject: 'New Contact Message: {{subject}}',
        subjectAr: 'رسالة تواصل جديدة: {{subject}}',
        bodyHtml: `${baseStyle}<div class="container"><div class="header"><h1>Mojeeb</h1></div><div class="content"><h2>New Contact Message</h2><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px;color:#6b7280">Name</td><td style="padding:8px;font-weight:600">{{name}}</td></tr><tr><td style="padding:8px;color:#6b7280">Email</td><td style="padding:8px">{{email}}</td></tr><tr><td style="padding:8px;color:#6b7280">Subject</td><td style="padding:8px;font-weight:600">{{subject}}</td></tr></table><div style="margin-top:16px;padding:16px;background:#f9fafb;border-radius:8px"><p style="white-space:pre-wrap">{{message}}</p></div></div><div class="footer">Mojeeb AI Customer Support Platform</div></div>`,
        bodyHtmlAr: `${baseStyle}<div class="container" dir="rtl"><div class="header"><h1>موجيب</h1></div><div class="content"><h2>رسالة تواصل جديدة</h2><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px;color:#6b7280">الاسم</td><td style="padding:8px;font-weight:600">{{name}}</td></tr><tr><td style="padding:8px;color:#6b7280">البريد</td><td style="padding:8px">{{email}}</td></tr><tr><td style="padding:8px;color:#6b7280">الموضوع</td><td style="padding:8px;font-weight:600">{{subject}}</td></tr></table><div style="margin-top:16px;padding:16px;background:#f9fafb;border-radius:8px"><p style="white-space:pre-wrap">{{message}}</p></div></div><div class="footer">منصة موجيب لدعم العملاء بالذكاء الاصطناعي</div></div>`,
        variables: ['name', 'email', 'subject', 'message'],
      },
    ];

    let count = 0;
    for (const tpl of defaults) {
      const existing = await prisma.emailTemplate.findUnique({ where: { key: tpl.key } });
      if (!existing) {
        await prisma.emailTemplate.create({ data: tpl });
        count++;
      }
    }

    logger.info({ count }, 'Email templates seeded');
    return count;
  }
}

export const emailTemplateService = new EmailTemplateService();
