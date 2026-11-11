/* eslint-disable no-console -- CLI script: console output is the interface */
/**
 * Database seed.
 *
 *   pnpm db:seed
 *
 * Idempotent — safe to run repeatedly. It never overwrites rows that already exist.
 *
 *   1. Plan configs (FREE / STARTER / PROFESSIONAL / ENTERPRISE). The pricing page and
 *      Admin → Plans read them from the database and can only edit existing rows.
 *   2. A super-admin account, which is the only way to reach /admin. Controlled by:
 *        SEED_ADMIN_EMAIL     (default in development: admin@mojeeb.local)
 *        SEED_ADMIN_PASSWORD  (generated and printed once when not set)
 *        SEED_ADMIN_ORG       (default: "Mojeeb")
 *      In production both SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required, and the
 *      step is skipped when they are missing. If the user already exists it is only
 *      promoted to super admin — its password is left untouched.
 */
import crypto from 'crypto';
import path from 'path';
import argon2 from 'argon2';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PLAN_LIMITS, SubscriptionPlan } from '@mojeeb/shared-types';
import { PLAN_PRICES, passwordSchema, slugify } from '@mojeeb/shared-utils';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const prisma = new PrismaClient();

/** Limits are stored as integers; "unlimited" is represented the same way the API does. */
const UNLIMITED = 999999;
const toLimit = (value: number) => (Number.isFinite(value) ? value : UNLIMITED);

const PLAN_PRESENTATION: Record<
  SubscriptionPlan,
  { displayName: string; displayNameAr: string; isPopular: boolean; maxTokensPerMonth: number }
> = {
  [SubscriptionPlan.FREE]: {
    displayName: 'Free',
    displayNameAr: 'مجاني',
    isPopular: false,
    maxTokensPerMonth: 500_000,
  },
  [SubscriptionPlan.STARTER]: {
    displayName: 'Starter',
    displayNameAr: 'مبتدئ',
    isPopular: false,
    maxTokensPerMonth: 5_000_000,
  },
  [SubscriptionPlan.PROFESSIONAL]: {
    displayName: 'Professional',
    displayNameAr: 'احترافي',
    isPopular: true,
    maxTokensPerMonth: 50_000_000,
  },
  [SubscriptionPlan.ENTERPRISE]: {
    displayName: 'Enterprise',
    displayNameAr: 'مؤسسي',
    isPopular: false,
    maxTokensPerMonth: UNLIMITED * 1000,
  },
};

const PLAN_ORDER: SubscriptionPlan[] = [
  SubscriptionPlan.FREE,
  SubscriptionPlan.STARTER,
  SubscriptionPlan.PROFESSIONAL,
  SubscriptionPlan.ENTERPRISE,
];

/** Feature bullet points are derived from the plan limits so they can never disagree. */
function planFeatures(plan: SubscriptionPlan): { en: string[]; ar: string[] } {
  const limits = PLAN_LIMITS[plan];
  const num = (n: number, locale: string) => n.toLocaleString(locale);
  const en: string[] = [];
  const ar: string[] = [];

  if (Number.isFinite(limits.messagesPerMonth)) {
    en.push(`${num(limits.messagesPerMonth, 'en-US')} messages / month`);
    ar.push(`${num(limits.messagesPerMonth, 'en-US')} رسالة شهرياً`);
  } else {
    en.push('Unlimited messages');
    ar.push('رسائل غير محدودة');
  }

  if (Number.isFinite(limits.maxAgents)) {
    en.push(limits.maxAgents === 1 ? '1 AI agent' : `${limits.maxAgents} AI agents`);
    ar.push(
      limits.maxAgents === 1 ? 'وكيل ذكاء اصطناعي واحد' : `${limits.maxAgents} وكلاء ذكاء اصطناعي`,
    );
  } else {
    en.push('Unlimited AI agents');
    ar.push('وكلاء ذكاء اصطناعي بلا حدود');
  }

  if (Number.isFinite(limits.maxKnowledgeBases)) {
    en.push(
      limits.maxKnowledgeBases === 1
        ? '1 knowledge base'
        : `${limits.maxKnowledgeBases} knowledge bases`,
    );
    ar.push(
      limits.maxKnowledgeBases === 1
        ? 'قاعدة معرفة واحدة'
        : `${limits.maxKnowledgeBases} قواعد معرفة`,
    );
  } else {
    en.push('Unlimited knowledge bases');
    ar.push('قواعد معرفة بلا حدود');
  }

  if (Number.isFinite(limits.maxTeamMembers)) {
    en.push(`${limits.maxTeamMembers} team members`);
    ar.push(`${limits.maxTeamMembers} أعضاء فريق`);
  } else {
    en.push('Unlimited team members');
    ar.push('أعضاء فريق بلا حدود');
  }

  en.push('WhatsApp, Messenger, Instagram & web chat');
  ar.push('واتساب، ماسنجر، إنستغرام ودردشة الموقع');

  if (limits.apiAccess) {
    en.push('API access');
    ar.push('الوصول عبر API');
  }

  return { en, ar };
}

async function seedPlans() {
  let created = 0;
  for (const [index, plan] of PLAN_ORDER.entries()) {
    const existing = await prisma.planConfig.findUnique({ where: { plan } });
    if (existing) continue;

    const limits = PLAN_LIMITS[plan];
    const prices = PLAN_PRICES[plan];
    const presentation = PLAN_PRESENTATION[plan];
    const features = planFeatures(plan);

    await prisma.planConfig.create({
      data: {
        plan,
        displayName: presentation.displayName,
        displayNameAr: presentation.displayNameAr,
        monthlyPrice: prices.monthly,
        yearlyPrice: prices.yearly,
        currency: 'USD',
        messagesPerMonth: toLimit(limits.messagesPerMonth),
        aiConversationsPerMonth: toLimit(limits.aiConversationsPerMonth),
        maxAgents: toLimit(limits.maxAgents),
        maxChannels: toLimit(limits.maxChannels),
        maxKnowledgeBases: toLimit(limits.maxKnowledgeBases),
        maxTeamMembers: toLimit(limits.maxTeamMembers),
        maxTokensPerMonth: presentation.maxTokensPerMonth,
        apiAccess: limits.apiAccess,
        isPopular: presentation.isPopular,
        sortOrder: index,
        features: JSON.stringify(features.en),
        featuresAr: JSON.stringify(features.ar),
      },
    });
    created++;
  }
  console.log(
    created > 0
      ? `✔ Plans: created ${created} plan config(s)`
      : '✔ Plans: all plan configs already exist',
  );
}

async function seedSuperAdmin() {
  const isProd = process.env.NODE_ENV === 'production';
  const email = (
    process.env.SEED_ADMIN_EMAIL || (isProd ? '' : 'admin@mojeeb.local')
  ).toLowerCase();
  const envPassword = process.env.SEED_ADMIN_PASSWORD;
  const orgName = process.env.SEED_ADMIN_ORG || 'Mojeeb';

  if (!email) {
    console.log(
      '• Super admin: skipped (set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one)',
    );
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.isSuperAdmin) {
      console.log(`✔ Super admin: ${email} already exists`);
    } else {
      await prisma.user.update({ where: { id: existing.id }, data: { isSuperAdmin: true } });
      console.log(`✔ Super admin: promoted existing user ${email} (password unchanged)`);
    }
    return;
  }

  if (isProd && !envPassword) {
    console.log('• Super admin: skipped (SEED_ADMIN_PASSWORD is required in production)');
    return;
  }

  // Aa1! guarantees the password policy is met whatever the random part contains
  const password = envPassword || `${crypto.randomBytes(12).toString('base64url')}Aa1!`;
  const policy = passwordSchema.safeParse(password);
  if (!policy.success) {
    throw new Error(
      `SEED_ADMIN_PASSWORD does not meet the password policy: ${policy.error.issues
        .map((i) => i.message)
        .join('; ')}`,
    );
  }

  const passwordHash = await argon2.hash(password);
  const freeLimits = PLAN_LIMITS[SubscriptionPlan.FREE];

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        firstName: 'Admin',
        lastName: 'User',
        isSuperAdmin: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        onboardingCompleted: true,
      },
    });

    let slug = slugify(orgName) || 'mojeeb';
    if (await tx.organization.findUnique({ where: { slug } })) {
      slug = `${slug}-${crypto.randomBytes(3).toString('hex')}`;
    }
    const organization = await tx.organization.create({ data: { name: orgName, slug } });

    await tx.orgMembership.create({
      data: { userId: user.id, orgId: organization.id, role: 'OWNER' },
    });

    await tx.subscription.create({
      data: {
        orgId: organization.id,
        plan: 'FREE',
        status: 'ACTIVE',
        messagesLimit: toLimit(freeLimits.messagesPerMonth),
        agentsLimit: toLimit(freeLimits.maxAgents),
        integrationsLimit: toLimit(freeLimits.maxChannels),
        aiConversationsLimit: toLimit(freeLimits.aiConversationsPerMonth),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  });

  console.log(`✔ Super admin: created ${email}`);
  if (!envPassword) {
    console.log(`    generated password: ${password}`);
    console.log('    (shown only once — change it after the first login)');
  }
}

async function main() {
  console.log('Seeding database...');
  await seedPlans();
  await seedSuperAdmin();
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
