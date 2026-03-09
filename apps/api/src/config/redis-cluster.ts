import Redis from 'ioredis';
import { config } from './index';
import { logger } from './logger';

// Parse Redis cluster nodes from environment variable
// Expected format: "host1:port1,host2:port2,host3:port3"
function parseClusterNodes(): { host: string; port: number }[] {
  const clusterNodesEnv = process.env.REDIS_CLUSTER_NODES;

  if (!clusterNodesEnv) {
    // Fallback to single node for development
    const url = new URL(config.redis.url);
    return [
      {
        host: url.hostname,
        port: parseInt(url.port || '6379', 10),
      },
    ];
  }

  return clusterNodesEnv.split(',').map((node) => {
    const [host, port] = node.trim().split(':');
    return {
      host,
      port: parseInt(port, 10),
    };
  });
}

const clusterNodes = parseClusterNodes();

export const redisCluster = new Redis.Cluster(clusterNodes, {
  redisOptions: {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  },
  clusterRetryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redisCluster.on('connect', () => {
  logger.info('Redis Cluster connected');
});

redisCluster.on('error', (err) => {
  logger.error({ err }, 'Redis Cluster connection error');
});

redisCluster.on('node error', (err, node) => {
  logger.error({ err, node }, 'Redis Cluster node error');
});
