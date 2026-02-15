import { Worker, Job } from 'bullmq';
import { redis } from '../../config/redis';
import { logger } from '../../config/logger';
import { moveToDeadLetterQueue } from '../dlq';

type EmailJobType =
  | 'verification'
  | 'passwordReset'
  | 'welcome'
  | 'demoRequest'
  | 'contact'
  | 'custom';

interface BaseEmailJob {
  type: EmailJobType;
}

interface VerificationEmailJob extends BaseEmailJob {
  type: 'verification';
  to: string;
  verifyToken: string;
  locale?: string;
}

interface PasswordResetEmailJob extends BaseEmailJob {
  type: 'passwordReset';
  to: string;
  resetToken: string;
  locale?: string;
}

interface WelcomeEmailJob extends BaseEmailJob {
  type: 'welcome';
  to: string;
  firstName: string;
  locale?: string;
}

interface DemoRequestEmailJob extends BaseEmailJob {
  type: 'demoRequest';
  name: string;
  email: string;
  phone: string;
  company?: string;
  message?: string;
}

interface ContactEmailJob extends BaseEmailJob {
  type: 'contact';
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface CustomEmailJob extends BaseEmailJob {
  type: 'custom';
  to: string;
  subject: string;
  body: string;
  firstName?: string;
}

type EmailJobData =
  | VerificationEmailJob
  | PasswordResetEmailJob
  | WelcomeEmailJob
  | DemoRequestEmailJob
  | ContactEmailJob
  | CustomEmailJob;

export const emailWorker = new Worker<EmailJobData>(
  'transactional-email',
  async (job: Job<EmailJobData>) => {
    const { emailService } = await import('../../services/email.service');
    const data = job.data;

    switch (data.type) {
      case 'verification':
        await emailService.sendEmailVerification(data.to, data.verifyToken, data.locale);
        break;
      case 'passwordReset':
        await emailService.sendPasswordResetEmail(data.to, data.resetToken, data.locale);
        break;
      case 'welcome':
        await emailService.sendWelcomeEmail(data.to, data.firstName, data.locale);
        break;
      case 'demoRequest':
        await emailService.sendDemoRequestNotification({
          name: data.name,
          email: data.email,
          phone: data.phone,
          company: data.company,
          message: data.message,
        });
        break;
      case 'contact':
        await emailService.sendContactNotification({
          name: data.name,
          email: data.email,
          subject: data.subject,
          message: data.message,
        });
        break;
      case 'custom':
        await emailService.sendCustomEmail(data.to, data.subject, data.body, data.firstName);
        break;
    }

    logger.debug({ type: data.type, jobId: job.id }, 'Transactional email sent');
  },
  {
    connection: redis,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  },
);

emailWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, type: job?.data?.type, err }, 'Transactional email failed');
  moveToDeadLetterQueue('transactional-email', job, err, 3);
});

emailWorker.on('error', (err) => {
  logger.error({ err }, 'Email worker error');
});
