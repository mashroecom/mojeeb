#!/usr/bin/env tsx
/**
 * Load Testing Script for 10,000+ Concurrent Connections
 *
 * This script simulates massive concurrent load on the platform to verify:
 * 1. System can handle 10,000+ concurrent Socket.IO connections
 * 2. HPA scales API pods based on load
 * 3. Response times remain acceptable under load
 * 4. No message loss in conversations
 * 5. Redis adapter handles cross-instance communication
 *
 * Prerequisites:
 * - Docker Compose or Kubernetes cluster running
 * - API service scaled horizontally (multiple replicas)
 * - Redis cluster running
 * - PostgreSQL with sufficient connections
 *
 * Usage:
 *   pnpm tsx scripts/load-test.ts [options]
 *
 * Options:
 *   --connections <number>   Number of concurrent connections (default: 10000)
 *   --ramp-up <seconds>      Ramp-up time to reach target (default: 60)
 *   --duration <seconds>     Test duration after ramp-up (default: 300)
 *   --api-url <url>          API URL (default: http://localhost:80)
 *   --batch-size <number>    Connections per batch (default: 100)
 *   --message-interval <ms>  Message send interval (default: 5000)
 */

import { io as ioClient, Socket } from 'socket.io-client';
import fetch from 'node-fetch';

// Configuration from CLI args
const args = process.argv.slice(2);
function getArg(name: string, defaultValue: string): string {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : defaultValue;
}

const CONFIG = {
  targetConnections: parseInt(getArg('--connections', '10000')),
  rampUpTime: parseInt(getArg('--ramp-up', '60')) * 1000, // Convert to ms
  testDuration: parseInt(getArg('--duration', '300')) * 1000, // Convert to ms
  apiUrl: getArg('--api-url', 'http://localhost:80'),
  batchSize: parseInt(getArg('--batch-size', '100')),
  messageInterval: parseInt(getArg('--message-interval', '5000')),
  websocketPath: '/ws',
};

// Test data
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'admin@test.com',
  password: process.env.TEST_USER_PASSWORD || 'Test123!@#',
};

const TEST_ORG_ID = process.env.TEST_ORG_ID || 'test-org-id';

// Metrics tracking
interface Metrics {
  attempted: number;
  connected: number;
  failed: number;
  disconnected: number;
  messagesSent: number;
  messagesReceived: number;
  errors: Map<string, number>;
  connectionTimes: number[];
  latencies: number[];
  startTime: number;
  endTime?: number;
}

const metrics: Metrics = {
  attempted: 0,
  connected: 0,
  failed: 0,
  disconnected: 0,
  messagesSent: 0,
  messagesReceived: 0,
  errors: new Map(),
  connectionTimes: [],
  latencies: [],
  startTime: Date.now(),
};

// Active connections
const activeConnections: Socket[] = [];
let isTestRunning = true;
let authToken: string | null = null;

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✓ ${message}`, colors.green);
}

function logError(message: string) {
  log(`✗ ${message}`, colors.red);
}

function logWarning(message: string) {
  log(`⚠ ${message}`, colors.yellow);
}

function logInfo(message: string) {
  log(`ℹ ${message}`, colors.cyan);
}

/**
 * Authenticate and get JWT token
 */
async function authenticate(): Promise<string | null> {
  try {
    const response = await fetch(`${CONFIG.apiUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER),
      // @ts-ignore
      timeout: 10000,
    });

    if (!response.ok) {
      logError(`Authentication failed with status ${response.status}`);
      return null;
    }

    const data: any = await response.json();
    return data?.data?.token || null;
  } catch (error) {
    logError(`Authentication error: ${error}`);
    return null;
  }
}

/**
 * Create a single WebSocket connection
 */
function createConnection(
  token: string,
  connectionId: number
): Promise<{ socket: Socket; connectionTime: number }> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const socket = ioClient(CONFIG.apiUrl, {
      path: CONFIG.websocketPath,
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      timeout: 30000,
    });

    let resolved = false;

    socket.on('connect', () => {
      if (resolved) return;
      resolved = true;

      const connectionTime = Date.now() - startTime;
      metrics.connected++;
      metrics.connectionTimes.push(connectionTime);

      // Join org for presence tracking
      socket.emit('join:org', TEST_ORG_ID);

      // Set online presence
      socket.emit('presence:online', TEST_ORG_ID);

      resolve({ socket, connectionTime });
    });

    socket.on('connect_error', (error) => {
      if (resolved) return;
      resolved = true;

      metrics.failed++;
      const errorType = error.message || 'Unknown error';
      metrics.errors.set(errorType, (metrics.errors.get(errorType) || 0) + 1);

      reject(error);
    });

    socket.on('disconnect', (reason) => {
      metrics.disconnected++;
    });

    socket.on('error', (error) => {
      const errorType = error?.message || 'Socket error';
      metrics.errors.set(errorType, (metrics.errors.get(errorType) || 0) + 1);
    });

    // Listen for messages (for message loss verification)
    socket.on('presence:update', () => {
      metrics.messagesReceived++;
    });

    socket.on('message:new', () => {
      metrics.messagesReceived++;
    });

    // Timeout
    setTimeout(() => {
      if (resolved) return;
      resolved = true;

      metrics.failed++;
      metrics.errors.set('Connection timeout', (metrics.errors.get('Connection timeout') || 0) + 1);
      socket.disconnect();

      reject(new Error('Connection timeout'));
    }, 30000);
  });
}

/**
 * Create a batch of connections
 */
async function createConnectionBatch(
  token: string,
  batchNumber: number,
  size: number
): Promise<void> {
  const startIndex = batchNumber * CONFIG.batchSize;

  const promises = Array.from({ length: size }, async (_, i) => {
    const connectionId = startIndex + i;
    metrics.attempted++;

    try {
      const { socket, connectionTime } = await createConnection(token, connectionId);
      activeConnections.push(socket);

      // Silently track successful connection
      if (metrics.connected % 100 === 0) {
        logInfo(
          `Connected: ${metrics.connected}/${CONFIG.targetConnections} (${Math.round(
            (metrics.connected / CONFIG.targetConnections) * 100
          )}%)`
        );
      }
    } catch (error) {
      // Connection failed - error already tracked in metrics
    }
  });

  await Promise.allSettled(promises);
}

/**
 * Ramp up connections gradually
 */
async function rampUpConnections(token: string): Promise<void> {
  log(`\n${colors.bright}${colors.blue}═══ Starting Connection Ramp-Up ═══${colors.reset}\n`);
  logInfo(`Target: ${CONFIG.targetConnections} connections`);
  logInfo(`Ramp-up time: ${CONFIG.rampUpTime / 1000}s`);
  logInfo(`Batch size: ${CONFIG.batchSize}`);

  const totalBatches = Math.ceil(CONFIG.targetConnections / CONFIG.batchSize);
  const batchInterval = CONFIG.rampUpTime / totalBatches;

  logInfo(`Total batches: ${totalBatches}`);
  logInfo(`Batch interval: ${Math.round(batchInterval)}ms\n`);

  for (let i = 0; i < totalBatches; i++) {
    if (!isTestRunning) break;

    const size = Math.min(CONFIG.batchSize, CONFIG.targetConnections - i * CONFIG.batchSize);
    await createConnectionBatch(token, i, size);

    // Wait before next batch (except for the last one)
    if (i < totalBatches - 1) {
      await new Promise((resolve) => setTimeout(resolve, batchInterval));
    }
  }

  logSuccess(`\nRamp-up complete! ${metrics.connected} connections established`);
}

/**
 * Send test messages from random connections
 */
async function sendTestMessages(): Promise<void> {
  if (activeConnections.length === 0) return;

  // Send messages from 10 random connections
  const numSenders = Math.min(10, activeConnections.length);
  const senders = Array.from({ length: numSenders }, () => {
    const randomIndex = Math.floor(Math.random() * activeConnections.length);
    return activeConnections[randomIndex];
  });

  senders.forEach((socket) => {
    if (socket?.connected) {
      try {
        // Trigger presence update (will be broadcast to all in org)
        socket.emit('presence:online', TEST_ORG_ID);
        metrics.messagesSent++;
      } catch (error) {
        // Ignore send errors
      }
    }
  });
}

/**
 * Monitor system metrics during test
 */
async function monitorSystemMetrics(): Promise<void> {
  while (isTestRunning) {
    const connected = activeConnections.filter((s) => s?.connected).length;
    const avgConnectionTime =
      metrics.connectionTimes.length > 0
        ? Math.round(
            metrics.connectionTimes.reduce((a, b) => a + b, 0) / metrics.connectionTimes.length
          )
        : 0;

    const successRate =
      metrics.attempted > 0 ? ((metrics.connected / metrics.attempted) * 100).toFixed(2) : '0';

    const messageRate =
      metrics.messagesReceived > 0
        ? ((metrics.messagesReceived / metrics.messagesSent) * 100).toFixed(2)
        : '0';

    // Print status update
    process.stdout.write(
      `\r${colors.dim}Active: ${connected} | Success: ${successRate}% | Avg Conn Time: ${avgConnectionTime}ms | Msgs: ${metrics.messagesSent}/${metrics.messagesReceived} (${messageRate}%)${colors.reset}`
    );

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

/**
 * Run sustained load test
 */
async function runLoadTest(): Promise<void> {
  log(`\n${colors.bright}${colors.blue}═══ Running Sustained Load Test ═══${colors.reset}\n`);
  logInfo(`Duration: ${CONFIG.testDuration / 1000}s`);
  logInfo(`Message interval: ${CONFIG.messageInterval}ms\n`);

  // Start monitoring
  const monitorPromise = monitorSystemMetrics();

  // Send test messages periodically
  const messageInterval = setInterval(() => {
    if (isTestRunning) {
      sendTestMessages();
    }
  }, CONFIG.messageInterval);

  // Run for specified duration
  await new Promise((resolve) => setTimeout(resolve, CONFIG.testDuration));

  clearInterval(messageInterval);
  isTestRunning = false;

  await monitorPromise;
}

/**
 * Check Kubernetes HPA scaling (if available)
 */
async function checkKubernetesScaling(): Promise<void> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    logInfo('\nChecking Kubernetes HPA status...');

    try {
      const { stdout } = await execAsync('kubectl get hpa -n mojeeb 2>&1');
      if (stdout.includes('api-hpa')) {
        log(`\n${stdout}`, colors.cyan);
        logSuccess('HPA found - check if replicas increased');
      } else {
        logWarning('HPA not found (may not be using Kubernetes)');
      }
    } catch (error) {
      logWarning('Could not check Kubernetes HPA (kubectl not available or not running in K8s)');
    }
  } catch (error) {
    // Silently ignore if modules not available
  }
}

/**
 * Cleanup all connections
 */
async function cleanup(): Promise<void> {
  log(`\n${colors.bright}${colors.blue}═══ Cleaning Up ═══${colors.reset}\n`);
  logInfo(`Disconnecting ${activeConnections.length} connections...`);

  let disconnected = 0;
  for (const socket of activeConnections) {
    try {
      if (socket?.connected) {
        socket.disconnect();
        disconnected++;
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  logSuccess(`Disconnected ${disconnected} connections`);
  activeConnections.length = 0;
}

/**
 * Print comprehensive test report
 */
function printTestReport(): void {
  metrics.endTime = Date.now();
  const totalDuration = ((metrics.endTime - metrics.startTime) / 1000).toFixed(2);

  log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}`);
  log(`${colors.bright}${colors.magenta}  LOAD TEST REPORT${colors.reset}`);
  log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

  log(`${colors.bright}Test Configuration:${colors.reset}`);
  log(`  Target Connections:  ${CONFIG.targetConnections}`);
  log(`  Ramp-up Time:        ${CONFIG.rampUpTime / 1000}s`);
  log(`  Test Duration:       ${CONFIG.testDuration / 1000}s`);
  log(`  Total Duration:      ${totalDuration}s`);
  log(`  API URL:             ${CONFIG.apiUrl}\n`);

  log(`${colors.bright}Connection Metrics:${colors.reset}`);
  log(`  Attempted:           ${metrics.attempted}`);
  log(`  Connected:           ${colors.green}${metrics.connected}${colors.reset}`);
  log(`  Failed:              ${metrics.failed > 0 ? colors.red : colors.reset}${metrics.failed}${colors.reset}`);
  log(`  Disconnected:        ${metrics.disconnected}`);
  log(
    `  Success Rate:        ${
      ((metrics.connected / metrics.attempted) * 100).toFixed(2)
    }%\n`
  );

  if (metrics.connectionTimes.length > 0) {
    const sortedTimes = [...metrics.connectionTimes].sort((a, b) => a - b);
    const avgTime = Math.round(sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length);
    const minTime = Math.min(...sortedTimes);
    const maxTime = Math.max(...sortedTimes);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

    log(`${colors.bright}Connection Time (ms):${colors.reset}`);
    log(`  Average:             ${avgTime}ms`);
    log(`  Min:                 ${minTime}ms`);
    log(`  Max:                 ${maxTime}ms`);
    log(`  P50 (Median):        ${p50}ms`);
    log(`  P95:                 ${p95}ms`);
    log(`  P99:                 ${p99}ms\n`);
  }

  log(`${colors.bright}Message Metrics:${colors.reset}`);
  log(`  Messages Sent:       ${metrics.messagesSent}`);
  log(`  Messages Received:   ${metrics.messagesReceived}`);
  if (metrics.messagesSent > 0) {
    const messageSuccessRate = ((metrics.messagesReceived / metrics.messagesSent) * 100).toFixed(2);
    const messageLoss = metrics.messagesSent - metrics.messagesReceived;
    log(`  Success Rate:        ${messageSuccessRate}%`);
    log(`  Message Loss:        ${messageLoss > 0 ? colors.red : colors.green}${messageLoss}${colors.reset}\n`);
  } else {
    log('  (No messages sent during test)\n');
  }

  if (metrics.errors.size > 0) {
    log(`${colors.bright}${colors.red}Errors:${colors.reset}`);
    Array.from(metrics.errors.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([error, count]) => {
        log(`  ${error}: ${count}`);
      });
    log('');
  }

  // Verdict
  log(`${colors.bright}Verdict:${colors.reset}`);
  const targetMet = metrics.connected >= CONFIG.targetConnections * 0.95; // 95% success threshold
  const responseTimes = metrics.connectionTimes.length > 0 &&
    metrics.connectionTimes[Math.floor(metrics.connectionTimes.length * 0.95)] < 5000; // P95 < 5s
  const noSignificantLoss = metrics.messagesSent === 0 ||
    metrics.messagesReceived / metrics.messagesSent >= 0.95; // 95% message delivery

  if (targetMet && responseTimes && noSignificantLoss) {
    logSuccess('✓ All acceptance criteria met!');
    logSuccess(`  - ${metrics.connected} concurrent connections (target: ${CONFIG.targetConnections})`);
    logSuccess('  - Acceptable response times (P95 < 5s)');
    logSuccess('  - No significant message loss');
    log('');
    return;
  }

  logWarning('✗ Some acceptance criteria not met:');
  if (!targetMet) {
    logError(`  - Connected ${metrics.connected}/${CONFIG.targetConnections} (need 95%+)`);
  }
  if (!responseTimes && metrics.connectionTimes.length > 0) {
    const p95 = metrics.connectionTimes[Math.floor(metrics.connectionTimes.length * 0.95)];
    logError(`  - P95 response time ${p95}ms (need < 5000ms)`);
  }
  if (!noSignificantLoss && metrics.messagesSent > 0) {
    const rate = ((metrics.messagesReceived / metrics.messagesSent) * 100).toFixed(2);
    logError(`  - Message delivery rate ${rate}% (need 95%+)`);
  }
  log('');
}

/**
 * Handle graceful shutdown
 */
function setupGracefulShutdown(): void {
  const shutdown = async () => {
    if (!isTestRunning) return;

    log(`\n\n${colors.yellow}Received shutdown signal...${colors.reset}`);
    isTestRunning = false;

    await cleanup();
    printTestReport();

    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/**
 * Main test execution
 */
async function main() {
  log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`);
  log(`${colors.bright}${colors.cyan}  Mojeeb Platform - Load Testing Suite${colors.reset}`);
  log(`${colors.bright}${colors.cyan}  Testing 10,000+ Concurrent Connections${colors.reset}`);
  log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

  setupGracefulShutdown();

  // Authenticate
  log(`${colors.bright}Authentication${colors.reset}`);
  logInfo('Authenticating...');

  authToken = await authenticate();
  if (!authToken) {
    logError('Authentication failed. Please check credentials in .env');
    logInfo('Set TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables');
    process.exit(1);
  }

  logSuccess('Authentication successful\n');

  try {
    // Ramp up connections
    await rampUpConnections(authToken);

    // Check if we met the target
    if (metrics.connected < CONFIG.targetConnections * 0.9) {
      logWarning(
        `\nWarning: Only ${metrics.connected}/${CONFIG.targetConnections} connections established`
      );
      logWarning('Continuing with available connections...');
    }

    // Check HPA scaling
    await checkKubernetesScaling();

    // Run sustained load test
    await runLoadTest();

    // Cleanup
    await cleanup();

    // Print report
    printTestReport();

    // Exit with appropriate code
    const success = metrics.connected >= CONFIG.targetConnections * 0.95;
    process.exit(success ? 0 : 1);
  } catch (error) {
    logError(`\nTest failed with error: ${error}`);
    await cleanup();
    printTestReport();
    process.exit(1);
  }
}

// Run the load test
main();
