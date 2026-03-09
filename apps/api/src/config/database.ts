import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaReadReplica: PrismaClient | undefined;
};

// Primary database client (for writes and transactional reads)
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Read replica database client (for analytics and reporting queries)
// Falls back to primary database if READ_REPLICA_URL is not configured
function createReadReplicaClient(): PrismaClient {
  const readReplicaUrl = process.env.READ_REPLICA_URL || process.env.DATABASE_READ_REPLICA_URL;

  if (!readReplicaUrl) {
    // Fallback to primary database for development or single-server deployments
    logger.info('READ_REPLICA_URL not configured, using primary database for read queries');
    return prisma;
  }

  logger.info('Configuring read replica database client');

  return new PrismaClient({
    datasources: {
      db: {
        url: readReplicaUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prismaReadReplica =
  globalForPrisma.prismaReadReplica ?? createReadReplicaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaReadReplica = prismaReadReplica;
}
