#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import { redis } from '../config/redis';

async function testConnectivity() {
  console.log('Testing database connection...');
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    console.log('✅ Database connected');
    await prisma.$disconnect();
  } catch (e: any) {
    console.error('❌ Database connection failed:', e.message);
    process.exit(1);
  }

  console.log('Testing Redis connection...');
  try {
    await redis.ping();
    console.log('✅ Redis connected');
    await redis.quit();
  } catch (e: any) {
    console.error('❌ Redis connection failed:', e.message);
    process.exit(1);
  }

  console.log('\n✅ All services are accessible!');
  process.exit(0);
}

testConnectivity();
