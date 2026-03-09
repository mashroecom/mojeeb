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
