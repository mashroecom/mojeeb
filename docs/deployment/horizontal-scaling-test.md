# Horizontal Scaling Test Guide

This guide provides comprehensive manual testing procedures to verify horizontal scaling works correctly with multiple API instances, Redis adapter for Socket.IO, separate worker containers, and proper session persistence.

## Prerequisites

- Docker and Docker Compose installed
- Environment variables configured in `.env`
- All services built: `docker-compose -f docker-compose.prod.yml build`

## Quick Start

Run the automated test script:

```bash
./scripts/test-scaling.sh
```

Or run the TypeScript test suite directly:

```bash
pnpm tsx scripts/test-horizontal-scaling.ts
```

## Manual Testing Procedures

### 1. Start Services with Scaled API Instances

Start docker-compose with 3 API instances:

```bash
docker-compose -f docker-compose.prod.yml up -d --scale api=3
```

Verify all services are running:

```bash
docker-compose -f docker-compose.prod.yml ps
```

Expected output should show:
- 3 API instances (all in "Up" state)
- 1 Worker instance
- 1 Redis instance
- 1 PostgreSQL instance
- 1 PostgreSQL replica instance
- 1 Nginx instance

### 2. Verify Socket.IO Redis Adapter

Check API logs for Redis adapter initialization:

```bash
docker-compose -f docker-compose.prod.yml logs api | grep -i "socket.io\|redis adapter"
```

Expected log entries:
```
api_1  | Redis subscriber connected for Socket.IO
api_2  | Redis subscriber connected for Socket.IO
api_3  | Redis subscriber connected for Socket.IO
api_1  | Socket.IO configured with Redis adapter
api_2  | Socket.IO configured with Redis adapter
api_3  | Socket.IO configured with Redis adapter
```

Each API instance should successfully connect to Redis and configure the Socket.IO adapter.

### 3. Verify Health Checks

Test the health endpoint (nginx will load balance across instances):

```bash
curl http://localhost/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-03-09T20:00:00.000Z",
    "checks": {
      "database": { "status": "healthy", "latencyMs": 5 },
      "redis": { "status": "healthy", "latencyMs": 2 }
    }
  }
}
```

Run multiple times to verify different API instances respond (check logs to see which instance handled the request):

```bash
for i in {1..10}; do
  curl -s http://localhost/health | jq '.data.status'
  sleep 0.5
done
```

### 4. Test Socket.IO Session Persistence

This test verifies that Socket.IO sessions persist across multiple API instances using the Redis adapter.

#### Step 4.1: Install Testing Tools

```bash
npm install -g socket.io-client
```

#### Step 4.2: Create Test Script

Create `test-socket-persistence.js`:

```javascript
const io = require('socket.io-client');

// Replace with your JWT token
const TOKEN = 'your-jwt-token-here';
const ORG_ID = 'your-org-id-here';

// Connect two sockets (load balancer will route to different instances)
const socket1 = io('http://localhost', {
  path: '/ws',
  auth: { token: TOKEN },
  transports: ['websocket']
});

const socket2 = io('http://localhost', {
  path: '/ws',
  auth: { token: TOKEN },
  transports: ['websocket']
});

socket1.on('connect', () => {
  console.log('Socket 1 connected');
  socket1.emit('join:org', ORG_ID);
  socket1.emit('presence:online', ORG_ID);
});

socket2.on('connect', () => {
  console.log('Socket 2 connected');
  socket2.emit('join:org', ORG_ID);

  // Listen for presence updates from socket1 (via Redis)
  socket2.on('presence:update', (data) => {
    console.log('✓ Received presence update across instances:', data);
    process.exit(0);
  });
});

setTimeout(() => {
  console.log('✗ Timeout - presence update not received');
  process.exit(1);
}, 10000);
```

Run the test:

```bash
node test-socket-persistence.js
```

Expected output:
```
Socket 1 connected
Socket 2 connected
✓ Received presence update across instances: { userId: 'xxx', status: 'online' }
```

### 5. Test BullMQ Worker Processing

Verify that worker containers are processing jobs from the queue.

#### Step 5.1: Check Worker Logs

```bash
docker-compose -f docker-compose.prod.yml logs -f worker
```

Look for job processing logs:
```
worker_1 | Processing job: email-notification
worker_1 | Job completed: email-notification
```

#### Step 5.2: Trigger Background Jobs

Trigger a job through the API (e.g., password reset email):

```bash
curl -X POST http://localhost/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

Monitor worker logs to verify the job is picked up:

```bash
docker-compose -f docker-compose.prod.yml logs worker | tail -20
```

### 6. Test Conversation Continuity

Verify that conversations work correctly when switching between API instances.

#### Step 6.1: Authenticate

```bash
TOKEN=$(curl -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Test123!@#"}' \
  | jq -r '.data.token')
```

#### Step 6.2: Create Conversation

```bash
CONV_ID=$(curl -X POST http://localhost/api/v1/conversations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "your-channel-id",
    "customerId": "visitor-123",
    "initialMessage": "Test message"
  }' | jq -r '.data.id')
```

#### Step 6.3: Send Messages

Send multiple messages and verify they're all stored (each request may hit different API instances):

```bash
for i in {1..5}; do
  curl -X POST http://localhost/api/v1/conversations/$CONV_ID/messages \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"content\":\"Message $i\",\"sender\":\"agent\"}"
  sleep 1
done
```

#### Step 6.4: Retrieve Conversation

Verify all messages are present:

```bash
curl http://localhost/api/v1/conversations/$CONV_ID \
  -H "Authorization: Bearer $TOKEN" | jq '.data.messages'
```

All 5 messages should be present, proving data consistency across instances.

### 7. Test Online Presence Tracking

Verify that online presence tracking works correctly across multiple instances using Redis.

#### Step 7.1: Monitor Redis Keys

Connect to Redis and monitor presence keys:

```bash
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a $REDIS_PASSWORD
```

In Redis CLI:
```
MONITOR
```

#### Step 7.2: Connect Socket and Set Presence

In another terminal, connect a WebSocket client and set presence:

```javascript
const socket = io('http://localhost', {
  path: '/ws',
  auth: { token: TOKEN },
  transports: ['websocket']
});

socket.on('connect', () => {
  socket.emit('join:org', ORG_ID);
  socket.emit('presence:online', ORG_ID);
});
```

#### Step 7.3: Verify Redis Operations

In the Redis MONITOR, you should see:

```
SADD online:your-org-id user-id
```

#### Step 7.4: Request Presence List

```javascript
socket.emit('presence:list', ORG_ID);

socket.on('presence:list', (users) => {
  console.log('Online users:', users);
});
```

Expected: Array of user IDs currently online in the organization.

### 8. Load Testing (Optional)

For production readiness, perform load testing with multiple concurrent connections.

#### Step 8.1: Install Artillery

```bash
npm install -g artillery
```

#### Step 8.2: Create Load Test Config

Create `load-test.yml`:

```yaml
config:
  target: 'http://localhost'
  phases:
    - duration: 60
      arrivalRate: 50
      name: "Warm up"
    - duration: 120
      arrivalRate: 100
      name: "Sustained load"
  defaults:
    headers:
      Content-Type: 'application/json'

scenarios:
  - name: "API Health Check"
    flow:
      - get:
          url: "/health"
      - think: 1

  - name: "Create Conversation"
    flow:
      - post:
          url: "/api/v1/auth/login"
          json:
            email: "test@example.com"
            password: "Test123!@#"
          capture:
            - json: "$.data.token"
              as: "token"
      - post:
          url: "/api/v1/conversations"
          headers:
            Authorization: "Bearer {{ token }}"
          json:
            channelId: "test-channel"
            customerId: "visitor-{{ $randomNumber() }}"
            initialMessage: "Load test message"
```

Run load test:

```bash
artillery run load-test.yml
```

Monitor API instance load:

```bash
docker stats
```

### 9. Verify No Session Loss During Scaling

Test that existing connections are maintained when scaling up/down.

#### Step 9.1: Connect Multiple WebSocket Clients

Start 10-20 WebSocket connections (use the test script from Step 4).

#### Step 9.2: Scale Up

```bash
docker-compose -f docker-compose.prod.yml up -d --scale api=5
```

Verify existing connections remain active and new connections are distributed.

#### Step 9.3: Scale Down

```bash
docker-compose -f docker-compose.prod.yml up -d --scale api=2
```

Monitor for disconnections. Clients connected to terminated instances should reconnect automatically (if reconnection is enabled in client).

## Troubleshooting

### API Instance Not Starting

Check logs:
```bash
docker-compose -f docker-compose.prod.yml logs api
```

Common issues:
- Database connection failure (check `DATABASE_URL`)
- Redis connection failure (check `REDIS_URL`)
- Missing environment variables

### Socket.IO Not Connecting

1. Verify nginx is routing WebSocket connections:
   ```bash
   docker-compose -f docker-compose.prod.yml logs nginx
   ```

2. Check nginx configuration for WebSocket upgrade headers:
   ```nginx
   proxy_http_version 1.1;
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
   ```

### Redis Adapter Not Working

1. Verify Redis is accessible:
   ```bash
   docker-compose -f docker-compose.prod.yml exec api node -e "
   const Redis = require('ioredis');
   const redis = new Redis(process.env.REDIS_URL);
   redis.ping().then(console.log).catch(console.error);
   "
   ```

2. Check for Redis adapter errors in logs:
   ```bash
   docker-compose -f docker-compose.prod.yml logs api | grep -i "redis.*error"
   ```

### Worker Not Processing Jobs

1. Check worker is connected to Redis:
   ```bash
   docker-compose -f docker-compose.prod.yml logs worker | grep -i redis
   ```

2. Verify queue names match between API and worker

3. Check BullMQ dashboard (if configured):
   ```bash
   docker-compose -f docker-compose.prod.yml logs worker | grep -i bullmq
   ```

## Success Criteria

✅ All API instances are healthy and responding
✅ Socket.IO sessions persist across instances via Redis adapter
✅ WebSocket connections distribute across multiple API instances
✅ Online presence tracking works via Redis (not in-memory)
✅ Worker containers process jobs from BullMQ queues
✅ Conversations remain consistent across instances
✅ No session loss during scaling operations
✅ Health checks enable load balancer integration
✅ Zero downtime during rolling updates

## Cleanup

Stop all services:

```bash
docker-compose -f docker-compose.prod.yml down
```

Remove volumes (if needed):

```bash
docker-compose -f docker-compose.prod.yml down -v
```

## Next Steps

After successful horizontal scaling tests with Docker Compose:

1. **Validate Kubernetes manifests** - Test in local Kubernetes cluster (minikube/kind)
2. **Load testing** - Verify 10,000+ concurrent connection target
3. **Multi-region deployment** - Test Helm charts with region-specific values
4. **Production deployment** - Deploy to staging environment first

## References

- [Docker Compose Scaling Documentation](https://docs.docker.com/compose/production/)
- [Socket.IO Redis Adapter](https://socket.io/docs/v4/redis-adapter/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Nginx WebSocket Proxying](https://nginx.org/en/docs/http/websocket.html)
