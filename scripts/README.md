# Scripts Directory

This directory contains utility scripts for testing, deployment, and maintenance.

## Horizontal Scaling Tests

### Quick Start

Run the automated horizontal scaling test:

```bash
./scripts/test-scaling.sh
```

This script will:
1. Build Docker images
2. Start services with 3 API instances using `docker-compose.scale-test.yml`
3. Verify all services are healthy
4. Display manual verification steps
5. Optionally run automated tests
6. Cleanup on exit (Ctrl+C)

### Manual Testing

For production-like testing with SSL:

```bash
# Start services
docker-compose -f docker-compose.prod.yml up -d --scale api=3

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f api

# Cleanup
docker-compose -f docker-compose.prod.yml down
```

### Automated Test Suite

Run the comprehensive test suite:

```bash
pnpm tsx scripts/test-horizontal-scaling.ts
```

Tests include:
- API instance health checks
- Socket.IO session persistence across instances
- Online presence tracking via Redis
- Conversation room functionality
- Worker service verification

### Configuration Files

- `docker-compose.scale-test.yml` - Simplified configuration for local testing (HTTP, no SSL)
- `docker-compose.prod.yml` - Production configuration with SSL certificates
- `nginx-local.conf` - Nginx configuration for local testing
- `nginx.conf` - Production nginx configuration

## Load Testing (10,000+ Concurrent Connections)

### Quick Start

Run predefined load test scenarios:

```bash
# Baseline test (1,000 connections)
./scripts/run-load-test.sh baseline

# Standard test (10,000 connections) - Main acceptance criteria
./scripts/run-load-test.sh standard

# Stress test (20,000 connections) - Find system limits
./scripts/run-load-test.sh stress

# Spike test (10,000 connections, rapid ramp-up)
./scripts/run-load-test.sh spike
```

### Custom Load Test

Run with custom parameters:

```bash
./scripts/run-load-test.sh custom \
  --connections 15000 \
  --ramp-up 90 \
  --duration 600 \
  --api-url http://localhost:80
```

### Direct Script Usage

Run the load test script directly with full control:

```bash
pnpm tsx scripts/load-test.ts \
  --connections 10000 \
  --ramp-up 60 \
  --duration 300 \
  --batch-size 100 \
  --message-interval 5000
```

### Load Test Options

| Option | Default | Description |
|--------|---------|-------------|
| `--connections` | 10000 | Target concurrent connections |
| `--ramp-up` | 60 | Ramp-up time (seconds) |
| `--duration` | 300 | Test duration (seconds) |
| `--api-url` | http://localhost:80 | API endpoint |
| `--batch-size` | 100 | Connections per batch |
| `--message-interval` | 5000 | Message send interval (ms) |

### Prerequisites

Before running load tests:

1. **Start scaled services:**
   ```bash
   docker-compose -f docker-compose.scale-test.yml up -d --scale api=3
   ```

2. **Configure test credentials in `.env`:**
   ```env
   TEST_USER_EMAIL=admin@test.com
   TEST_USER_PASSWORD=Test123!@#
   TEST_ORG_ID=test-org-id
   ```

3. **Ensure sufficient resources:**
   - RAM: 16GB+ recommended
   - CPU: 8+ cores
   - Redis max_connections: 20000+
   - PostgreSQL max_connections: 500+

### Monitoring During Load Tests

**Kubernetes:**
```bash
# Watch HPA scaling
watch kubectl get hpa -n mojeeb

# Monitor pods
kubectl top pods -n mojeeb

# View logs
kubectl logs -f -n mojeeb -l app=api
```

**Docker Compose:**
```bash
# Container stats
docker stats

# View logs
docker-compose -f docker-compose.scale-test.yml logs -f api
```

### Understanding Results

The load test reports:
- Connection success rate (target: 95%+)
- Connection time percentiles (P95 target: < 5s)
- Message delivery rate (target: 95%+)
- Errors and failures

**Acceptance Criteria:**
- ✅ 10,000+ concurrent connections maintained
- ✅ P95 connection time < 5 seconds
- ✅ Message delivery rate > 95%
- ✅ HPA scales API pods (Kubernetes only)

### Detailed Documentation

For comprehensive load testing guide, see:
- [Load Testing Guide](../docs/deployment/load-testing-guide.md)

## Other Scripts

### Database Backup

```bash
./scripts/backup-db.sh
```

Creates a backup of the PostgreSQL database.

### i18n Check

```bash
node scripts/check-i18n.js
```

Validates internationalization (i18n) translation files.

### Docker Entrypoint

The `docker-entrypoint.sh` script is used by Docker containers to initialize the application.

## Environment Variables

Most scripts require environment variables to be set in `.env`:

```env
# Database
POSTGRES_PASSWORD=your_postgres_password

# Redis
REDIS_PASSWORD=your_redis_password

# For testing
TEST_USER_EMAIL=admin@test.com
TEST_USER_PASSWORD=Test123!@#
TEST_ORG_ID=test-org-id
```

## Troubleshooting

### Port Already in Use

If port 80 is already in use:

```bash
# Find the process using port 80
sudo lsof -i :80

# Stop the process or use different ports in docker-compose
```

### Docker Build Errors

Clear Docker cache and rebuild:

```bash
docker-compose -f docker-compose.scale-test.yml build --no-cache
```

### Health Checks Failing

Check service logs:

```bash
docker-compose -f docker-compose.scale-test.yml logs api
docker-compose -f docker-compose.scale-test.yml logs redis
docker-compose -f docker-compose.scale-test.yml logs postgres
```

## Documentation

For detailed testing procedures, see:
- [Horizontal Scaling Test Guide](../docs/deployment/horizontal-scaling-test.md)
- [Kubernetes Deployment](../docs/deployment/kubernetes.md)
- [Multi-Region Deployment](../docs/deployment/multi-region.md)
- [Scaling Guide](../docs/deployment/scaling-guide.md)
