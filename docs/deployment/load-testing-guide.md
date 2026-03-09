# Load Testing Guide - 10,000+ Concurrent Connections

This guide covers load testing the Mojeeb platform to verify it can handle 10,000+ concurrent connections with acceptable performance.

## Overview

The load testing suite simulates massive concurrent load to verify:

1. **Connection Capacity**: System can maintain 10,000+ concurrent Socket.IO connections
2. **Auto-Scaling**: Kubernetes HPA scales API pods based on CPU/memory load
3. **Response Times**: P95 connection time remains under 5 seconds
4. **Message Delivery**: No significant message loss in real-time communication
5. **System Stability**: All connections remain stable throughout the test

## Prerequisites

### Infrastructure Requirements

**Minimum Resources:**
- **Kubernetes Cluster**: 4+ nodes (8 vCPU, 32GB RAM total)
- **PostgreSQL**: Configured for 500+ connections
- **Redis Cluster**: 3+ nodes for high availability
- **API Pods**: Start with 3 replicas (HPA will scale up)

**Local Testing (Docker Compose):**
- **RAM**: 16GB+ recommended
- **CPU**: 8+ cores
- **Docker**: Latest version with increased resources
- **Redis**: `maxclients` set to 20000+
- **PostgreSQL**: `max_connections` set to 500+

### Software Requirements

```bash
# Node.js and pnpm
node --version  # v20+
pnpm --version  # v10+

# Optional: kubectl for K8s monitoring
kubectl version --client

# Optional: k6 for HTTP load testing
k6 version
```

### Configuration

Create or update `.env` file with test credentials:

```bash
# Test user credentials
TEST_USER_EMAIL=admin@test.com
TEST_USER_PASSWORD=Test123!@#

# Test organization ID
TEST_ORG_ID=your-org-id

# API URL (default: http://localhost:80)
API_URL=http://localhost:80
```

## Running Load Tests

### Quick Start

```bash
# Basic test with default settings (10,000 connections)
pnpm tsx scripts/load-test.ts

# Custom configuration
pnpm tsx scripts/load-test.ts \
  --connections 15000 \
  --ramp-up 120 \
  --duration 600 \
  --api-url http://localhost:80 \
  --batch-size 100 \
  --message-interval 5000
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `--connections` | 10000 | Target number of concurrent connections |
| `--ramp-up` | 60 | Ramp-up time in seconds to reach target |
| `--duration` | 300 | Test duration in seconds after ramp-up |
| `--api-url` | http://localhost:80 | API endpoint URL |
| `--batch-size` | 100 | Number of connections per batch |
| `--message-interval` | 5000 | Interval between test messages (ms) |

### Test Scenarios

#### 1. Baseline Test (1,000 connections)

Verify system works before scaling up:

```bash
pnpm tsx scripts/load-test.ts \
  --connections 1000 \
  --ramp-up 30 \
  --duration 60
```

**Expected Results:**
- 100% connection success rate
- P95 < 1 second connection time
- No message loss
- All pods healthy

#### 2. Target Load (10,000 connections)

Main acceptance criteria test:

```bash
pnpm tsx scripts/load-test.ts \
  --connections 10000 \
  --ramp-up 60 \
  --duration 300
```

**Expected Results:**
- 95%+ connection success rate
- P95 < 5 seconds connection time
- 95%+ message delivery rate
- HPA scales API pods from 3 to 10-15 replicas
- Response times remain acceptable

#### 3. Stress Test (20,000 connections)

Find breaking point:

```bash
pnpm tsx scripts/load-test.ts \
  --connections 20000 \
  --ramp-up 120 \
  --duration 600
```

**Expected Results:**
- Identify system limits
- Monitor HPA scaling behavior
- Check error rates at capacity
- Verify graceful degradation

#### 4. Spike Test (Rapid Ramp-Up)

Test sudden traffic spikes:

```bash
pnpm tsx scripts/load-test.ts \
  --connections 10000 \
  --ramp-up 10 \
  --duration 300
```

**Expected Results:**
- System handles rapid connection surge
- HPA responds quickly
- Some initial connection failures acceptable
- System stabilizes after spike

## Monitoring During Tests

### Real-Time Metrics

The load test script displays real-time metrics:

```
Active: 9847 | Success: 98.47% | Avg Conn Time: 1234ms | Msgs: 450/442 (98.22%)
```

- **Active**: Currently connected clients
- **Success**: Connection success rate
- **Avg Conn Time**: Average connection establishment time
- **Msgs**: Messages sent/received (delivery rate)

### Kubernetes Monitoring

In a separate terminal, monitor system resources:

```bash
# Watch HPA scaling
watch kubectl get hpa -n mojeeb

# Monitor pod metrics
kubectl top pods -n mojeeb

# Watch pod count
watch kubectl get pods -n mojeeb | grep api

# View API pod logs
kubectl logs -f -n mojeeb -l app=api --tail=100
```

### System Metrics

```bash
# CPU and memory usage
kubectl top nodes

# Redis cluster status
kubectl exec -n mojeeb redis-cluster-0 -- redis-cli cluster info

# PostgreSQL connections
kubectl exec -n mojeeb postgres-primary-0 -- psql -U mojeeb -c "SELECT count(*) FROM pg_stat_activity;"

# Check for errors
kubectl get events -n mojeeb --sort-by='.lastTimestamp'
```

### Docker Compose Monitoring

```bash
# Container stats
docker stats

# API container logs
docker-compose -f docker-compose.scale-test.yml logs -f api

# Redis monitor
docker-compose exec redis redis-cli monitor

# PostgreSQL connections
docker-compose exec postgres psql -U mojeeb -c "SELECT count(*) FROM pg_stat_activity;"
```

## Understanding Test Results

### Test Report Sections

#### 1. Connection Metrics

```
Connection Metrics:
  Attempted:           10000
  Connected:           9847
  Failed:              153
  Disconnected:        45
  Success Rate:        98.47%
```

**Analysis:**
- ✅ **Good**: Success rate > 95%
- ⚠️ **Warning**: Success rate 90-95%
- ❌ **Fail**: Success rate < 90%

#### 2. Connection Time

```
Connection Time (ms):
  Average:             1234ms
  Min:                 245ms
  Max:                 8901ms
  P50 (Median):        1089ms
  P95:                 3456ms
  P99:                 5678ms
```

**Analysis:**
- ✅ **Good**: P95 < 3000ms
- ⚠️ **Warning**: P95 3000-5000ms
- ❌ **Fail**: P95 > 5000ms

#### 3. Message Delivery

```
Message Metrics:
  Messages Sent:       450
  Messages Received:   442
  Success Rate:        98.22%
  Message Loss:        8
```

**Analysis:**
- ✅ **Good**: Success rate > 95%, loss < 5%
- ⚠️ **Warning**: Success rate 90-95%, loss 5-10%
- ❌ **Fail**: Success rate < 90%, loss > 10%

#### 4. Error Report

```
Errors:
  Connection timeout: 103
  ECONNREFUSED: 35
  Authentication failed: 15
```

**Common Errors:**
- **Connection timeout**: System overloaded, increase resources
- **ECONNREFUSED**: Not enough API replicas, check HPA
- **Authentication failed**: Database connection pool exhausted
- **Socket error**: Redis cluster issues

### Acceptance Criteria

The test passes if ALL criteria are met:

1. ✅ **10,000+ connections**: Maintains at least 9,500 concurrent connections (95%+)
2. ✅ **Acceptable response times**: P95 connection time < 5 seconds
3. ✅ **No significant message loss**: 95%+ message delivery rate
4. ✅ **System stability**: Connections remain stable throughout test duration
5. ✅ **HPA scaling**: Kubernetes scales API pods based on load (if using K8s)

## Troubleshooting

### Problem: Low Connection Success Rate (< 90%)

**Possible Causes:**
- Insufficient system resources
- PostgreSQL connection pool exhausted
- Redis cluster overloaded
- Network limits

**Solutions:**
```bash
# Increase PostgreSQL max_connections
kubectl edit configmap postgres-config -n mojeeb
# Set max_connections = 500

# Scale API pods manually
kubectl scale deployment api -n mojeeb --replicas=10

# Increase Redis maxclients
kubectl exec -n mojeeb redis-cluster-0 -- redis-cli CONFIG SET maxclients 20000

# Check network limits (Linux)
sysctl net.core.somaxconn  # Should be 1024+
sysctl net.ipv4.ip_local_port_range  # Should allow many ephemeral ports
```

### Problem: High Connection Times (P95 > 5s)

**Possible Causes:**
- Slow database queries during auth
- Redis latency
- Insufficient API resources
- Network congestion

**Solutions:**
```bash
# Add database indexes
kubectl exec -n mojeeb postgres-primary-0 -- psql -U mojeeb -c "CREATE INDEX idx_users_email ON users(email);"

# Increase API resource limits
kubectl edit deployment api -n mojeeb
# Increase CPU/memory requests and limits

# Check Redis latency
kubectl exec -n mojeeb redis-cluster-0 -- redis-cli --latency

# Enable connection pooling
# Update ConfigMap with REDIS_MAX_RETRIES_PER_REQUEST=3
```

### Problem: Message Loss (> 5%)

**Possible Causes:**
- Redis adapter misconfiguration
- Socket.IO namespace issues
- Network packet loss
- API pod crashes

**Solutions:**
```bash
# Check Redis adapter logs
kubectl logs -n mojeeb -l app=api | grep "redis-adapter"

# Verify Redis cluster health
kubectl exec -n mojeeb redis-cluster-0 -- redis-cli cluster info

# Check for pod restarts
kubectl get pods -n mojeeb | grep api

# Monitor Socket.IO events
# Add LOG_LEVEL=debug to ConfigMap
```

### Problem: HPA Not Scaling

**Possible Causes:**
- Metrics server not installed
- Resource requests not defined
- HPA misconfigured
- Low CPU/memory usage

**Solutions:**
```bash
# Install metrics server (if missing)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Verify metrics server
kubectl top nodes
kubectl top pods -n mojeeb

# Check HPA configuration
kubectl describe hpa api-hpa -n mojeeb

# Manually scale for testing
kubectl scale deployment api -n mojeeb --replicas=15
```

### Problem: Test Script Errors

**Error: "Authentication failed"**
```bash
# Check credentials
cat .env | grep TEST_USER

# Create test user in database
docker-compose exec api pnpm db:seed
```

**Error: "ECONNREFUSED"**
```bash
# Check API is running
curl http://localhost:80/health

# Check docker-compose
docker-compose -f docker-compose.scale-test.yml ps

# Check port forwarding (K8s)
kubectl port-forward -n mojeeb svc/api 80:80
```

**Error: "socket.io-client not found"**
```bash
# Install dependencies
pnpm install socket.io-client node-fetch
```

## Performance Optimization

### Database Optimization

```sql
-- Create indexes for frequently queried fields
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_sessions_token ON sessions(token);
CREATE INDEX CONCURRENTLY idx_conversations_org ON conversations(organization_id);

-- Increase connection pool
ALTER SYSTEM SET max_connections = 500;
ALTER SYSTEM SET shared_buffers = '2GB';
SELECT pg_reload_conf();

-- Monitor slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### Redis Optimization

```bash
# Increase max clients
redis-cli CONFIG SET maxclients 20000

# Enable cluster mode for HA
# (Already configured in redis-cluster-statefulset.yaml)

# Monitor memory usage
redis-cli INFO memory

# Set eviction policy
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### API Optimization

```typescript
// Enable compression
app.use(compression({ threshold: 1024 }));

// Increase Socket.IO ping timeout
io.engine.pingTimeout = 60000;
io.engine.pingInterval = 25000;

// Configure connection pool
const redisClient = new Redis({
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
  enableReadyCheck: true,
  lazyConnect: true,
});
```

### Kubernetes Optimization

```yaml
# Increase resource limits
resources:
  requests:
    cpu: 1000m
    memory: 2Gi
  limits:
    cpu: 2000m
    memory: 4Gi

# Adjust HPA thresholds
targetCPUUtilizationPercentage: 70
targetMemoryUtilizationPercentage: 80

# Enable pod anti-affinity
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        topologyKey: kubernetes.io/hostname
```

## Best Practices

1. **Start Small**: Run baseline tests (1K connections) before scaling up
2. **Monitor Resources**: Watch CPU, memory, network during tests
3. **Gradual Ramp-Up**: Use 60-120 second ramp-up for realistic load
4. **Clean Environment**: Reset state between tests
5. **Consistent Config**: Use same test parameters for comparison
6. **Document Results**: Track metrics over time to identify trends
7. **Test Regularly**: Run load tests before major releases
8. **Simulate Reality**: Use message patterns similar to production
9. **Plan Capacity**: Size infrastructure for 2x expected peak load
10. **Monitor Production**: Use similar metrics in production monitoring

## Production Deployment Checklist

Before deploying to production with 10K+ capacity:

- [ ] Load test passed with 95%+ success rate
- [ ] HPA scales appropriately (verified in staging)
- [ ] Database connection pool configured (500+ connections)
- [ ] Redis cluster tested and stable (3+ nodes)
- [ ] Resource limits tested and verified
- [ ] Network policies allow required traffic
- [ ] Monitoring and alerting configured
- [ ] Backup and disaster recovery tested
- [ ] Security scan completed (no critical issues)
- [ ] Documentation updated with scaling procedures
- [ ] Runbook created for incident response
- [ ] Load balancer health checks configured
- [ ] SSL/TLS certificates valid and renewed
- [ ] DNS configured with failover
- [ ] Cost analysis completed (infrastructure at scale)

## Related Documentation

- [Horizontal Scaling Test Guide](./horizontal-scaling-test.md)
- [Kubernetes Deployment Guide](../../k8s/DEPLOYMENT_GUIDE.md)
- [Scaling Guide](./scaling-guide.md)
- [Multi-Region Deployment](./multi-region.md)

## Support

For issues or questions:

1. Check troubleshooting section above
2. Review Kubernetes logs: `kubectl logs -n mojeeb -l app=api`
3. Check system metrics: `kubectl top pods -n mojeeb`
4. Consult deployment guide: `docs/deployment/kubernetes.md`
5. Contact DevOps team with test report output
