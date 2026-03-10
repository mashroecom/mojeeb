import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateTestToken() {
  const JWT_SECRET = process.env.JWT_SECRET || '7WNY0G2duEskv+NXSlppbIZV1bHuiSIFbjy5rFLTE59t1GmwYQ/pp/zt4JDR/uzc';
  const ORG_ID = process.env.ORG_ID || 'test-org-10k';

  // Find or create test user
  let user = await prisma.user.findFirst({
    where: { email: 'test@example.com' }
  });

  if (!user) {
    console.log('Creating test user...');
    user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        passwordHash: 'dummy-hash-for-testing',
        firstName: 'Test',
        lastName: 'User',
      }
    });
  }

  // Find or create org membership
  let membership = await prisma.orgMembership.findUnique({
    where: {
      userId_orgId: {
        userId: user.id,
        orgId: ORG_ID,
      }
    }
  });

  if (!membership) {
    console.log('Creating test org membership...');
    membership = await prisma.orgMembership.create({
      data: {
        userId: user.id,
        orgId: ORG_ID,
        role: 'OWNER',
      }
    });
  }

  // Generate JWT token
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log('\n✅ Test token generated successfully!\n');
  console.log('Token:', token);
  console.log('\nUse this token in your test by setting:');
  console.log(`export TEST_TOKEN="${token}"`);

  return token;
}

generateTestToken()
  .catch((e) => {
    console.error('❌ Failed to generate token:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
