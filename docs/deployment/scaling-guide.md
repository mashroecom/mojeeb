# Scaling Guide

This guide covers horizontal and vertical scaling strategies for Mojeeb, helping you handle growth from hundreds to thousands of concurrent users.

## Table of Contents

- [Overview](#overview)
- [Understanding Mojeeb's Architecture](#understanding-mojeeb-s-architecture)
- [Horizontal Pod Autoscaling (HPA)](#horizontal-pod-autoscaling-hpa)
- [Vertical Scaling](#vertical-scaling)
- [Database Scaling](#database-scaling)
- [Redis Scaling](#redis-scaling)
- [Load Testing](#load-testing)
- [Performance Optimization](#performance-optimization)
- [Monitoring and Metrics](#monitoring-and-metrics)
- [Capacity Planning](#capacity-planning)
- [Troubleshooting Performance Issues](#troubleshooting-performance-issues)
- [Scaling Checklist](#scaling-checklist)

## Overview

### Scaling Goals

Mojeeb is designed to scale horizontally to handle:
- **10,000+** concurrent WebSocket connections
- **1,000+** requests per second
- **Millions** of messages per day
- **Sub-second** response times globally

### Key Principles

1. **Stateless API Servers** - Scale API pods without coordination
2. **Independent Workers** - Scale background job processing separately
3. **Read Replicas** - Offload analytics queries from primary database
4. **Redis Cluster** - Shared state for WebSocket sessions and queues
5. **Auto-scaling** - Automatically adjust capacity based on load

## Understanding Mojeeb's Architecture

### Component Responsibilities

```
┌─────────────────────────────────────────────────────────┐
│                      Load Balancer                      │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
┌───────▼────────┐  ┌─────▼──────────┐
│   API Pods     │  │  Worker Pods   │
│ (Stateless)    │  │  (Stateless)   │
│ - HTTP API     │  │  - BullMQ      │
│ - WebSocket    │  │    Consumers   │
│ - Socket.IO    │  │  - Background  │
│   Server       │  │    Jobs        │
│                │  │                │
│ Scale: 3-20    │  │  Scale: 3-20   │
└───┬────────┬───┘  └────┬───────┬───┘
    │        │           │       │
    │   ┌────┴───────────┴───┐   │
    │   │   Redis Cluster    │   │
    │   │  - Session State   │   │
    │   │  - Job Queues      │   │
    │   │  - Pub/Sub         │   │
    │   └────────────────────┘   │
    │                            │
┌───▼────────────────────────────▼───┐
│         PostgreSQL                 │
│  - Primary (writes)                │
│  - Read Replicas (analytics)       │
└────────────────────────────────────┘
```

### Scaling Characteristics

| Component | Scaling Type | Bottleneck | Scale Limit |
|-----------|--------------|------------|-------------|
| API Pods | Horizontal | Redis connections | 50+ pods |
| Worker Pods | Horizontal | Database connections | 50+ pods |
| Web Frontend | Horizontal | None (static) | 100+ pods |
| PostgreSQL | Vertical + Read Replicas | Write throughput | 1 primary + 10 replicas |
| Redis | Horizontal (cluster) | Memory | 6+ nodes |

## Horizontal Pod Autoscaling (HPA)

Kubernetes HPA automatically scales pods based on CPU, memory, or custom metrics.

### Current HPA Configuration

#### API Server HPA

```yaml
# k8s/api-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100  # Double pods every 60s
        periodSeconds: 60
      - type: Pods
        value: 4    # Or add 4 pods
        periodSeconds: 60
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Pods
        value: 1    # Remove 1 pod at a time
        periodSeconds: 60
      selectPolicy: Min
```

**Key Settings**:
- **minReplicas: 3** - Always maintain 3 pods for high availability
- **maxReplicas: 20** - Cap at 20 pods to control costs
- **CPU target: 70%** - Scale up when CPU exceeds 70%
- **Memory target: 80%** - Scale up when memory exceeds 80%
- **scaleUp: Fast** - Can double pods or add 4, whichever is more
- **scaleDown: Slow** - Remove 1 pod at a time, wait 5 minutes between

#### Worker HPA

```yaml
# k8s/worker-hpa.yaml
spec:
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

Workers use similar settings, but could also scale based on queue depth.

### Custom Metrics Scaling

Scale based on business metrics (requires metrics-server and custom metrics API):

#### Scale Based on Queue Depth

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: worker
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: worker
  minReplicas: 3
  maxReplicas: 50
  metrics:
  # CPU metric
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70

  # Custom metric: BullMQ queue depth
  - type: Pods
    pods:
      metric:
        name: bullmq_queue_waiting_jobs
      target:
        type: AverageValue
        averageValue: "10"  # 10 jobs per worker
```

**Implementation**: Expose BullMQ queue metrics via Prometheus and use metrics adapter.

#### Scale Based on WebSocket Connections

```yaml
metrics:
  # Active WebSocket connections
  - type: Pods
    pods:
      metric:
        name: socketio_connections
      target:
        type: AverageValue
        averageValue: "500"  # 500 connections per pod
```

**Calculation**: If you have 5,000 connections and target 500/pod, HPA creates 10 pods.

### Monitoring HPA

```bash
# Check HPA status
kubectl get hpa -n mojeeb

# Expected output:
# NAME   REFERENCE      TARGETS         MINPODS   MAXPODS   REPLICAS   AGE
# api    Deployment/api 45%/70%, 60%/80% 3        20        5          10m
# worker Deployment/worker 50%/70%      3        20        3          10m

# Describe HPA for details
kubectl describe hpa api -n mojeeb

# Watch HPA in real-time
kubectl get hpa api -n mojeeb --watch

# Check HPA events
kubectl get events -n mojeeb | grep HorizontalPodAutoscaler
```

### Adjusting HPA Settings

```bash
# Increase max replicas for API
kubectl patch hpa api -n mojeeb --patch '{"spec":{"maxReplicas":30}}'

# Change CPU threshold
kubectl patch hpa api -n mojeeb --type='json' -p='[{"op": "replace", "path": "/spec/metrics/0/resource/target/averageUtilization", "value":60}]'

# Via Helm values
# In values.yaml:
api:
  autoscaling:
    maxReplicas: 30
    targetCPUUtilizationPercentage: 60

# Apply changes
helm upgrade mojeeb ./helm/mojeeb -f values.yaml
```

## Vertical Scaling

Increase resources (CPU, memory) for individual pods.

### Current Resource Allocation

```yaml
# API Pods
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "2Gi"
    cpu: "1000m"

# Worker Pods
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "2Gi"
    cpu: "1000m"

# Web Pods
resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
  limits:
    memory: "1Gi"
    cpu: "500m"
```

### When to Increase Resources

**Signs you need more resources per pod**:
- CPU usage consistently near limits (>90%)
- Memory pressure / OOMKilled events
- Slow request processing despite low request count
- Database connection pool exhaustion

**Check resource usage**:

```bash
# Current usage
kubectl top pods -n mojeeb

# Example output:
# NAME                      CPU(cores)   MEMORY(bytes)
# api-5d7f8c9b4d-abc12      450m         1200Mi
# api-5d7f8c9b4d-def34      480m         1150Mi
# worker-7c8d9e0f5g-ghi56   300m         800Mi

# If API pods are using >400m CPU consistently, increase CPU allocation
```

### Increasing Resources

#### Via Helm

```yaml
# values.yaml
api:
  resources:
    requests:
      memory: "1Gi"      # Increased from 512Mi
      cpu: "500m"        # Increased from 250m
    limits:
      memory: "4Gi"      # Increased from 2Gi
      cpu: "2000m"       # Increased from 1000m
```

Apply:

```bash
helm upgrade mojeeb ./helm/mojeeb -f values.yaml
```

#### Via kubectl

```bash
# Edit deployment directly
kubectl edit deployment api -n mojeeb

# Or patch
kubectl patch deployment api -n mojeeb --patch '
spec:
  template:
    spec:
      containers:
      - name: api
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
'
```

### Vertical Pod Autoscaler (VPA)

Automatically adjust resource requests based on actual usage:

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: api-vpa
  namespace: mojeeb
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  updatePolicy:
    updateMode: "Auto"  # or "Recreate" or "Initial"
  resourcePolicy:
    containerPolicies:
    - containerName: api
      minAllowed:
        cpu: 250m
        memory: 512Mi
      maxAllowed:
        cpu: 2000m
        memory: 4Gi
```

**Note**: VPA and HPA can conflict. Use VPA for CPU/memory, HPA for replicas.

## Database Scaling

### PostgreSQL Scaling Strategy

#### 1. Vertical Scaling (Primary Database)

Increase primary database resources:

```yaml
# k8s/postgres-statefulset.yaml
resources:
  requests:
    memory: "2Gi"     # Increase for more cache
    cpu: "1000m"
  limits:
    memory: "8Gi"
    cpu: "4000m"
```

**When to scale up**:
- High CPU during peak hours
- Cache hit ratio < 90%
- Slow query performance
- Connection pool saturation

#### 2. Read Replicas (Horizontal Scaling)

Offload read queries to replicas:

```yaml
# helm/mojeeb/values.yaml
postgresql:
  readReplicas:
    enabled: true
    replicas: 3  # Increase from 2 to 3
```

**Use read replicas for**:
- Analytics queries
- Reporting dashboards
- Background data exports
- Read-heavy API endpoints

**Application code**:

```typescript
// apps/api/src/config/database.ts
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,  // Primary (writes)
    },
  },
});

export const prismaRead = new PrismaClient({
  datasources: {
    db: {
      url: process.env.READ_REPLICA_URL,  // Replica (reads)
    },
  },
});

// Usage in API
// Write operations
await prisma.conversation.create({ data: { ... } });

// Read operations (analytics)
const stats = await prismaRead.conversation.aggregate({
  where: { createdAt: { gte: lastMonth } },
  _count: true,
});
```

#### 3. Connection Pooling

Optimize database connections:

```typescript
// DATABASE_URL with pgbouncer
// postgresql://user:pass@pgbouncer:6432/mojeeb?pgbouncer=true

// Prisma connection pool
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool settings
  pool: {
    max: 20,  // Max connections per API pod
    min: 5,
  },
});
```

**Calculate max connections**:
```
Max DB Connections = (API Pods × Pool Size) + (Worker Pods × Pool Size)
Example: (10 × 20) + (5 × 20) = 300 connections

Ensure PostgreSQL max_connections >= 300 + buffer (20%)
Set PostgreSQL max_connections = 360
```

#### 4. Query Optimization

Before scaling, optimize queries:

```bash
# Enable slow query log
# In PostgreSQL config
log_min_duration_statement = 100  # Log queries > 100ms

# Check slow queries
kubectl exec -it postgres-0 -n mojeeb -- psql -U mojeeb -c "
  SELECT query, calls, total_time, mean_time
  FROM pg_stat_statements
  ORDER BY mean_time DESC
  LIMIT 10;
"

# Add indexes for slow queries
# Example: Index on conversation channelId
CREATE INDEX idx_conversations_channel_id ON conversations(channel_id);
```

### PostgreSQL Monitoring

```bash
# Database connections
kubectl exec -it postgres-0 -n mojeeb -- psql -U mojeeb -c "
  SELECT count(*) as connections,
         state,
         application_name
  FROM pg_stat_activity
  GROUP BY state, application_name;
"

# Cache hit ratio (should be > 90%)
kubectl exec -it postgres-0 -n mojeeb -- psql -U mojeeb -c "
  SELECT
    sum(heap_blks_read) as heap_read,
    sum(heap_blks_hit) as heap_hit,
    sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
  FROM pg_statio_user_tables;
"

# Replication lag (read replicas)
kubectl exec -it postgres-read-0 -n mojeeb -- psql -U mojeeb -c "
  SELECT
    client_addr,
    state,
    sync_state,
    pg_wal_lsn_diff(sent_lsn, write_lsn) AS write_lag,
    pg_wal_lsn_diff(sent_lsn, flush_lsn) AS flush_lag,
    pg_wal_lsn_diff(sent_lsn, replay_lsn) AS replay_lag
  FROM pg_stat_replication;
"
```

## Redis Scaling

### Redis Cluster Architecture

Current setup: 3-node Redis cluster with persistence

```yaml
# k8s/redis-cluster-statefulset.yaml
spec:
  replicas: 3
```

### Scaling Redis

#### 1. Vertical Scaling

Increase memory per Redis node:

```yaml
# k8s/redis-cluster-statefulset.yaml
resources:
  requests:
    memory: "512Mi"    # Increase from 256Mi
    cpu: "200m"
  limits:
    memory: "2Gi"      # Increase from 512Mi
    cpu: "1000m"

# Also increase maxmemory
args:
  - --maxmemory
  - "1gb"  # Increase from 256mb
```

#### 2. Horizontal Scaling (Add Nodes)

Add more Redis nodes to cluster:

```bash
# Scale Redis StatefulSet
kubectl scale statefulset redis-cluster --replicas=6 -n mojeeb

# Wait for new nodes to start
kubectl wait --for=condition=ready pod -l component=redis -n mojeeb --timeout=300s

# Add nodes to cluster (manual step)
kubectl exec -it redis-cluster-0 -n mojeeb -- redis-cli --cluster add-node <new-node-ip>:6379 <existing-node-ip>:6379
```

**When to add nodes**:
- Memory usage > 80% on all nodes
- High eviction rate
- Network bandwidth saturation
- CPU bottleneck on Redis nodes

### Redis Performance Tuning

```yaml
# Redis configuration optimizations
config:
  # Increase max memory
  maxmemory: "1gb"

  # Eviction policy (remove least recently used keys)
  maxmemoryPolicy: "allkeys-lru"

  # Persistence (may impact performance)
  appendonly: "yes"
  appendfsync: "everysec"  # Balance between durability and performance

  # Disable slow commands in production
  rename-command: "FLUSHDB 'DISABLED'"
  rename-command: "FLUSHALL 'DISABLED'"
  rename-command: "KEYS 'DISABLED'"  # Use SCAN instead
```

### Redis Monitoring

```bash
# Redis memory usage
kubectl exec -it redis-cluster-0 -n mojeeb -- redis-cli -a $REDIS_PASSWORD INFO memory

# Key metrics:
# - used_memory: Current memory usage
# - used_memory_peak: Peak memory usage
# - mem_fragmentation_ratio: Should be close to 1.0
# - evicted_keys: Keys evicted due to memory pressure

# Redis stats
kubectl exec -it redis-cluster-0 -n mojeeb -- redis-cli -a $REDIS_PASSWORD INFO stats

# Key metrics:
# - total_commands_processed: Total commands
# - instantaneous_ops_per_sec: Current operations/sec
# - keyspace_hits / keyspace_misses: Cache hit ratio

# Monitor in real-time
kubectl exec -it redis-cluster-0 -n mojeeb -- redis-cli -a $REDIS_PASSWORD --stat
```

### BullMQ Queue Monitoring

```bash
# Check queue depths (requires custom metrics)
kubectl exec -it api-<pod-name> -n mojeeb -- node -e "
const { Queue } = require('bullmq');
const Redis = require('ioredis');

const connection = new Redis(process.env.REDIS_URL);

const queues = [
  'inbound-messages',
  'ai-processing',
  'outbound-messages',
  'analytics',
  'webhook-dispatch',
  'transactional-email',
  'bulk-email'
];

async function checkQueues() {
  for (const queueName of queues) {
    const queue = new Queue(queueName, { connection });
    const counts = await queue.getJobCounts();
    console.log(\`\${queueName}: waiting=\${counts.waiting}, active=\${counts.active}, failed=\${counts.failed}\`);
  }
  process.exit(0);
}

checkQueues();
"
```

**If queue depths are growing**:
- Scale worker pods
- Increase worker concurrency
- Optimize job processing time
- Add more Redis memory

## Load Testing

Test your scaling configuration before production load.

### Load Testing Tools

#### 1. k6 (Recommended)

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import ws from 'k6/ws';

export let options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 500 },   // Ramp to 500 users
    { duration: '5m', target: 500 },   // Stay at 500
    { duration: '2m', target: 1000 },  // Ramp to 1000
    { duration: '10m', target: 1000 }, // Stay at 1000
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],    // Less than 1% failure
  },
};

export default function() {
  // Test REST API
  let response = http.get('https://your-domain.com/api/v1/health');
  check(response, {
    'status is 200': (r) => r.status === 200,
  });

  // Test WebSocket
  const url = 'wss://your-domain.com/socket.io/?EIO=4&transport=websocket';
  const response = ws.connect(url, function(socket) {
    socket.on('open', function() {
      console.log('Connected');
    });

    socket.setTimeout(function() {
      socket.close();
    }, 30000);
  });

  sleep(1);
}
```

Run test:

```bash
k6 run --vus 1000 --duration 30m load-test.js
```

#### 2. Artillery

```yaml
# artillery-config.yml
config:
  target: "https://your-domain.com"
  phases:
    - duration: 300
      arrivalRate: 10
      rampTo: 100
      name: "Ramp up"
    - duration: 600
      arrivalRate: 100
      name: "Sustained load"
  socketio:
    transports: ["websocket"]

scenarios:
  - name: "REST API and WebSocket"
    engine: socketio
    flow:
      - get:
          url: "/api/v1/health"
      - emit:
          channel: "message"
          data:
            text: "Hello"
      - think: 5
```

Run:

```bash
artillery run artillery-config.yml
```

### Interpreting Load Test Results

**Good signs**:
- Response times remain consistent under load
- No 5xx errors
- HPA scales pods appropriately
- CPU/memory stay below limits

**Warning signs**:
- Response times increase linearly with load
- Error rate > 1%
- Pods at resource limits
- Database connection errors

**Action items**:
- If HPA doesn't scale: Check metrics-server, adjust thresholds
- If pods hit limits: Increase resource requests/limits
- If database slow: Add read replicas, optimize queries
- If Redis slow: Add nodes, increase memory

## Performance Optimization

### Application-Level Optimizations

#### 1. Database Query Optimization

```typescript
// Bad: N+1 query
const conversations = await prisma.conversation.findMany();
for (const conv of conversations) {
  const messages = await prisma.message.findMany({
    where: { conversationId: conv.id }
  });
}

// Good: Single query with includes
const conversations = await prisma.conversation.findMany({
  include: {
    messages: true,
  },
});
```

#### 2. Caching

```typescript
// Cache frequently accessed data in Redis
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function getChannel(channelId: string) {
  // Check cache first
  const cached = await redis.get(`channel:${channelId}`);
  if (cached) return JSON.parse(cached);

  // Fetch from database
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  // Cache for 5 minutes
  await redis.setex(`channel:${channelId}`, 300, JSON.stringify(channel));

  return channel;
}
```

#### 3. Pagination

```typescript
// Bad: Fetch all records
const messages = await prisma.message.findMany({
  where: { conversationId },
});

// Good: Paginate
const messages = await prisma.message.findMany({
  where: { conversationId },
  take: 50,
  skip: (page - 1) * 50,
  orderBy: { createdAt: 'desc' },
});
```

#### 4. Background Jobs

Move slow operations to background jobs:

```typescript
// Bad: Process in request handler
app.post('/api/v1/messages', async (req, res) => {
  const message = await processMessage(req.body);  // Slow!
  res.json(message);
});

// Good: Queue background job
app.post('/api/v1/messages', async (req, res) => {
  await messageQueue.add('process', req.body);
  res.json({ status: 'queued' });
});
```

### Infrastructure Optimizations

#### 1. CDN for Static Assets

Use CDN for web frontend:

```yaml
# Ingress annotation for CloudFlare proxy
metadata:
  annotations:
    external-dns.alpha.kubernetes.io/cloudflare-proxied: "true"
```

#### 2. HTTP/2 and Compression

```yaml
# Ingress annotations
metadata:
  annotations:
    nginx.ingress.kubernetes.io/enable-http2: "true"
    nginx.ingress.kubernetes.io/compression: "true"
```

#### 3. Connection Keep-Alive

```typescript
// API server configuration
const server = http.createServer(app);
server.keepAliveTimeout = 65000;  // 65 seconds
server.headersTimeout = 66000;    // Slightly higher than keepAlive
```

## Monitoring and Metrics

### Essential Metrics

#### Application Metrics

- **Request rate**: Requests per second
- **Response time**: P50, P95, P99 latencies
- **Error rate**: % of failed requests
- **Active connections**: WebSocket connections count

#### Infrastructure Metrics

- **CPU usage**: % per pod, per node
- **Memory usage**: MB used, % of limit
- **Network I/O**: Bytes sent/received
- **Disk I/O**: Read/write operations

#### Business Metrics

- **Concurrent users**: Unique users online
- **Messages/minute**: Message throughput
- **Queue depth**: Jobs waiting in queues
- **Conversation creation rate**: New conversations/hour

### Setting Up Monitoring

#### Prometheus + Grafana (Recommended)

```bash
# Install Prometheus Operator
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace

# Port-forward to Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80

# Access Grafana at http://localhost:3000
# Default credentials: admin / prom-operator
```

#### Create Mojeeb Dashboard

Import dashboard or create custom:

```json
{
  "dashboard": {
    "title": "Mojeeb Performance",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{namespace=\"mojeeb\"}[5m]))"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Response Time (P95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{namespace=\"mojeeb\"}[5m])) by (le))"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Active WebSocket Connections",
        "targets": [
          {
            "expr": "sum(socketio_connections{namespace=\"mojeeb\"})"
          }
        ],
        "type": "stat"
      },
      {
        "title": "Pod CPU Usage",
        "targets": [
          {
            "expr": "sum(rate(container_cpu_usage_seconds_total{namespace=\"mojeeb\"}[5m])) by (pod)"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

### Alerting

Set up alerts for critical thresholds:

```yaml
# Prometheus alert rules
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: mojeeb-alerts
  namespace: mojeeb
spec:
  groups:
  - name: mojeeb
    interval: 30s
    rules:
    # High error rate
    - alert: HighErrorRate
      expr: |
        sum(rate(http_requests_total{status=~"5..", namespace="mojeeb"}[5m]))
        /
        sum(rate(http_requests_total{namespace="mojeeb"}[5m]))
        > 0.05
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "High error rate (>5%)"
        description: "{{ $value | humanizePercentage }} of requests are failing"

    # High response time
    - alert: HighResponseTime
      expr: |
        histogram_quantile(0.95,
          sum(rate(http_request_duration_seconds_bucket{namespace="mojeeb"}[5m])) by (le)
        ) > 2
      for: 10m
      labels:
        severity: warning
      annotations:
        summary: "High response time (P95 > 2s)"

    # Pod resource limits
    - alert: PodMemoryNearLimit
      expr: |
        container_memory_usage_bytes{namespace="mojeeb"}
        /
        container_spec_memory_limit_bytes{namespace="mojeeb"}
        > 0.9
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Pod {{ $labels.pod }} memory usage > 90%"

    # Queue depth growing
    - alert: QueueDepthGrowing
      expr: |
        bullmq_queue_waiting_jobs{namespace="mojeeb"} > 1000
      for: 10m
      labels:
        severity: warning
      annotations:
        summary: "Queue {{ $labels.queue }} has > 1000 waiting jobs"
```

## Capacity Planning

### Calculate Required Resources

#### 1. Estimate Load

- **Concurrent users**: 10,000
- **Messages per user per hour**: 20
- **Total messages per hour**: 200,000
- **Messages per second**: ~55

#### 2. Calculate API Pod Requirements

```
Assumptions:
- Each API pod handles 500 concurrent WebSocket connections
- Each pod processes 100 requests/second
- Target CPU usage: 70%

Required API pods for connections:
10,000 connections ÷ 500 connections/pod = 20 pods

Required API pods for throughput:
55 req/s ÷ 100 req/s/pod = 1 pod (not the bottleneck)

Minimum: 20 pods for WebSocket connections
```

#### 3. Calculate Worker Pod Requirements

```
Assumptions:
- Each worker processes 10 jobs/second
- 55 messages/sec + background jobs = ~100 jobs/sec
- Target CPU usage: 70%

Required workers:
100 jobs/s ÷ 10 jobs/s/worker = 10 workers
```

#### 4. Calculate Database Resources

```
Assumptions:
- 100 writes/second
- 400 reads/second (4:1 read/write ratio)

Primary database:
- Handle 100 writes/second
- Estimated: 2 vCPUs, 8GB RAM

Read replicas:
- Distribute 400 reads across replicas
- 2 replicas × 200 reads/s each
- Estimated: 2 vCPUs, 4GB RAM per replica
```

#### 5. Calculate Redis Resources

```
Assumptions:
- 10,000 WebSocket sessions × 1KB session data = 10MB
- 100,000 queued jobs × 2KB per job = 200MB
- Overhead and other data = 300MB
- Total: ~512MB per node

Redis cluster:
- 3 nodes for redundancy
- 1GB memory per node (2× required)
```

### Scaling Timeline

| Users | API Pods | Workers | DB (vCPU/RAM) | Redis Nodes |
|-------|----------|---------|---------------|-------------|
| 100   | 3        | 3       | 1/4GB         | 3 (256MB)   |
| 1,000 | 5        | 5       | 2/8GB         | 3 (512MB)   |
| 5,000 | 12       | 8       | 4/16GB        | 4 (1GB)     |
| 10,000| 20       | 15      | 8/32GB + 2 replicas | 6 (2GB) |
| 50,000| 100      | 50      | 16/64GB + 5 replicas | 12 (4GB) |

## Troubleshooting Performance Issues

### High Response Times

**Symptoms**: API requests slow, P95 latency > 2s

**Diagnosis**:

```bash
# Check if database is slow
kubectl exec -it postgres-0 -n mojeeb -- psql -U mojeeb -c "
  SELECT query, calls, mean_time, total_time
  FROM pg_stat_statements
  ORDER BY mean_time DESC
  LIMIT 10;
"

# Check Redis latency
kubectl exec -it redis-cluster-0 -n mojeeb -- redis-cli -a $REDIS_PASSWORD --latency

# Check pod CPU/memory
kubectl top pods -n mojeeb
```

**Solutions**:
- Optimize slow database queries (add indexes)
- Add read replicas for read-heavy queries
- Increase pod resources if at limits
- Enable caching for frequently accessed data
- Scale out API pods

### Memory Leaks

**Symptoms**: Memory usage grows over time, OOMKilled events

**Diagnosis**:

```bash
# Check memory trends
kubectl top pods -n mojeeb --sort-by=memory

# Get pod memory over time (requires metrics-server)
kubectl get --raw /apis/metrics.k8s.io/v1beta1/namespaces/mojeeb/pods | jq '.items[] | {name:.metadata.name, memory:.containers[0].usage.memory}'

# Check for OOMKilled
kubectl get events -n mojeeb | grep OOMKilled
```

**Solutions**:
- Analyze heap dumps (Node.js: `node --heap-prof`)
- Check for unclosed database connections
- Review caching strategies (set TTLs)
- Increase memory limits (temporary)
- Fix memory leak in code (permanent)

### Database Connection Pool Exhaustion

**Symptoms**: "Too many clients" errors, connection timeouts

**Diagnosis**:

```bash
# Check active connections
kubectl exec -it postgres-0 -n mojeeb -- psql -U mojeeb -c "
  SELECT count(*), state FROM pg_stat_activity GROUP BY state;
"

# Check max connections
kubectl exec -it postgres-0 -n mojeeb -- psql -U mojeeb -c "SHOW max_connections;"
```

**Solutions**:
- Increase PostgreSQL `max_connections`
- Use connection pooler (PgBouncer)
- Reduce connection pool size per pod
- Ensure connections are properly closed
- Scale database vertically

### Queue Backlog

**Symptoms**: Queue depths growing, delayed job processing

**Diagnosis**:

Check queue metrics (see BullMQ monitoring section above)

**Solutions**:
- Scale worker pods
- Increase worker concurrency
- Optimize job processing time
- Add job prioritization
- Investigate failed jobs

## Scaling Checklist

Before major scaling:

- [ ] Load test current configuration
- [ ] Verify HPA is working (check `kubectl get hpa`)
- [ ] Review resource limits (prevent pod eviction)
- [ ] Check database connection limits
- [ ] Ensure read replicas are configured
- [ ] Verify Redis has adequate memory
- [ ] Set up monitoring and alerting
- [ ] Document current baseline metrics
- [ ] Test rollback procedures
- [ ] Review cost implications
- [ ] Validate node capacity in cluster
- [ ] Check storage capacity (PVCs)
- [ ] Test failover scenarios
- [ ] Verify backup and restore procedures
- [ ] Review security (network policies, pod security)

After scaling:

- [ ] Monitor for 24-48 hours
- [ ] Check error rates and latencies
- [ ] Verify auto-scaling behavior
- [ ] Review costs vs. budget
- [ ] Document new baseline metrics
- [ ] Update capacity planning docs
- [ ] Adjust alerts if needed

## Best Practices

1. **Start Conservative** - Begin with minimum resources, scale based on actual usage
2. **Monitor Everything** - You can't optimize what you don't measure
3. **Horizontal Over Vertical** - Scale out (more pods) rather than up (bigger pods)
4. **Set Resource Limits** - Prevent runaway pods from affecting others
5. **Use Read Replicas** - Offload analytics from primary database
6. **Cache Aggressively** - Reduce database load with Redis caching
7. **Test Scaling** - Load test before production traffic
8. **Gradual Rollouts** - Scale incrementally, monitor at each step
9. **Plan for Failure** - Design for pod failures, node failures, region failures
10. **Optimize Code First** - Sometimes a code change beats infrastructure scaling

## Next Steps

- Set up monitoring (Prometheus + Grafana)
- Run initial load tests
- Implement caching strategy
- Review and optimize database queries
- Configure alerts for key metrics
- Document your scaling procedures
- Schedule regular capacity reviews
