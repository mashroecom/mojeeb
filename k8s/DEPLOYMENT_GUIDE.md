# Kubernetes Deployment Guide

This guide provides instructions for deploying Mojeeb to a Kubernetes cluster (local or production).

## Prerequisites

- Kubernetes cluster (kind, minikube, or production cluster)
- kubectl configured to access your cluster
- Docker images built for api, worker, and web services

## Quick Start (Local Cluster)

### 1. Create Local Cluster

Using kind:
```bash
kind create cluster --name mojeeb-local
```

Or using minikube:
```bash
minikube start --cpus=4 --memory=8192
```

### 2. Build Docker Images

```bash
# Build all images
docker build -t mojeeb/api:latest -f apps/api/Dockerfile .
docker build -t mojeeb/worker:latest -f apps/worker/Dockerfile .
docker build -t mojeeb/web:latest -f apps/web/Dockerfile .

# For kind, load images into cluster
kind load docker-image mojeeb/api:latest --name mojeeb-local
kind load docker-image mojeeb/worker:latest --name mojeeb-local
kind load docker-image mojeeb/web:latest --name mojeeb-local

# For minikube, use minikube's docker daemon
eval $(minikube docker-env)
# Then rebuild images
```

### 3. Create Secrets

Create the required secrets before deploying:

```bash
# Create namespace first
kubectl apply -f k8s/namespace.yaml

# Create secrets (replace with your actual values)
kubectl create secret generic mojeeb-secrets \
  --namespace=mojeeb \
  --from-literal=DATABASE_URL='postgresql://mojeeb:password@postgres-primary:5432/mojeeb' \
  --from-literal=READ_REPLICA_URL='postgresql://mojeeb:password@postgres-replica:5432/mojeeb' \
  --from-literal=REDIS_URL='redis://:password@redis-cluster:6379' \
  --from-literal=REDIS_PASSWORD='your-redis-password' \
  --from-literal=POSTGRES_PASSWORD='your-postgres-password' \
  --from-literal=JWT_SECRET='your-jwt-secret-min-32-chars' \
  --from-literal=JWT_REFRESH_SECRET='your-jwt-refresh-secret-min-32-chars' \
  --from-literal=EMAIL_HOST='smtp.example.com' \
  --from-literal=EMAIL_PORT='587' \
  --from-literal=EMAIL_USER='noreply@mojeeb.app' \
  --from-literal=EMAIL_PASSWORD='your-email-password' \
  --from-literal=OPENAI_API_KEY='sk-...' \
  --from-literal=GOOGLE_CLIENT_ID='your-google-client-id' \
  --from-literal=GOOGLE_CLIENT_SECRET='your-google-client-secret' \
  --from-literal=WHATSAPP_API_URL='https://api.whatsapp.com' \
  --from-literal=WHATSAPP_API_TOKEN='your-whatsapp-token' \
  --from-literal=KASHIER_API_KEY='your-kashier-key' \
  --from-literal=KASHIER_MERCHANT_ID='your-merchant-id'
```

### 4. Apply Manifests

Apply in order to handle dependencies:

```bash
# 1. Namespace and ConfigMaps
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml

# 2. Database
kubectl apply -f k8s/postgres-statefulset.yaml
kubectl apply -f k8s/postgres-service.yaml

# Wait for PostgreSQL to be ready
kubectl wait --for=condition=ready pod -l component=postgres,role=primary -n mojeeb --timeout=300s

# 3. Redis
kubectl apply -f k8s/redis-cluster-statefulset.yaml
kubectl apply -f k8s/redis-cluster-service.yaml

# Wait for Redis to be ready
kubectl wait --for=condition=ready pod -l component=redis -n mojeeb --timeout=300s

# 4. Application services
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/api-service.yaml
kubectl apply -f k8s/worker-deployment.yaml
kubectl apply -f k8s/web-deployment.yaml
kubectl apply -f k8s/web-service.yaml

# 5. Ingress (if using ingress controller)
kubectl apply -f k8s/ingress.yaml

# 6. Auto-scaling
kubectl apply -f k8s/api-hpa.yaml
kubectl apply -f k8s/worker-hpa.yaml
```

### 5. Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n mojeeb

# Check services
kubectl get services -n mojeeb

# Check HPA status
kubectl get hpa -n mojeeb

# View logs
kubectl logs -n mojeeb -l component=api --tail=50
kubectl logs -n mojeeb -l component=worker --tail=50

# Check health endpoints
kubectl port-forward -n mojeeb svc/api 4000:4000 &
curl http://localhost:4000/api/v1/health
curl http://localhost:4000/api/v1/health/ready
```

## Verification Checklist

### Database Connectivity
```bash
# Connect to API pod
kubectl exec -it -n mojeeb deployment/api -- /bin/sh

# Inside pod, test database connection
node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => console.log('✓ Connected to PostgreSQL'))
  .catch(err => console.error('✗ Database error:', err.message))
  .finally(() => client.end());
"
```

### Redis Connectivity
```bash
# Test Redis connection from API pod
kubectl exec -it -n mojeeb deployment/api -- /bin/sh

# Inside pod
node -e "
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);
redis.ping()
  .then(() => console.log('✓ Connected to Redis'))
  .catch(err => console.error('✗ Redis error:', err.message))
  .finally(() => redis.quit());
"
```

### Worker Queue Processing
```bash
# Check worker logs for job processing
kubectl logs -n mojeeb -l component=worker -f

# Add a test job (from API pod)
kubectl exec -it -n mojeeb deployment/api -- node -e "
const Queue = require('bullmq').Queue;
const queue = new Queue('test', { connection: { url: process.env.REDIS_URL } });
queue.add('test-job', { message: 'Hello from test' });
console.log('✓ Test job added');
"
```

### Auto-scaling Test
```bash
# Generate load to trigger HPA
kubectl run -n mojeeb load-generator --image=busybox --restart=Never -- /bin/sh -c "while true; do wget -q -O- http://api:4000/api/v1/health; done"

# Watch HPA scale up
kubectl get hpa -n mojeeb --watch

# Clean up
kubectl delete pod -n mojeeb load-generator
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl describe pod -n mojeeb <pod-name>

# Check events
kubectl get events -n mojeeb --sort-by='.lastTimestamp'

# Check logs
kubectl logs -n mojeeb <pod-name> --previous  # For crashed pods
```

### Database Connection Issues

```bash
# Check if PostgreSQL is ready
kubectl exec -it -n mojeeb statefulset/postgres-primary -- pg_isready

# Check database logs
kubectl logs -n mojeeb statefulset/postgres-primary
```

### Redis Connection Issues

```bash
# Check Redis connectivity
kubectl exec -it -n mojeeb statefulset/redis-cluster-0 -- redis-cli -a $REDIS_PASSWORD ping

# Check Redis logs
kubectl logs -n mojeeb statefulset/redis-cluster-0
```

### Image Pull Issues

```bash
# For local cluster, ensure images are loaded
kind load docker-image mojeeb/api:latest --name mojeeb-local
kind load docker-image mojeeb/worker:latest --name mojeeb-local
kind load docker-image mojeeb/web:latest --name mojeeb-local
```

## Production Deployment

### Pre-requisites
- Production Kubernetes cluster (EKS, GKE, AKS, or on-premise)
- SSL certificates
- External load balancer
- Backup solution for PostgreSQL
- Monitoring setup (Prometheus, Grafana)

### Additional Steps

1. **Use production-grade storage classes**
   ```yaml
   storageClassName: fast-ssd  # Replace 'standard' in manifests
   ```

2. **Configure ingress with TLS**
   ```yaml
   tls:
   - hosts:
     - api.mojeeb.app
     secretName: mojeeb-tls
   ```

3. **Set up external database** (recommended for production)
   - Use managed PostgreSQL (RDS, Cloud SQL, etc.)
   - Update DATABASE_URL in secrets
   - Skip postgres-statefulset.yaml

4. **Set up external Redis** (optional)
   - Use managed Redis (ElastiCache, Cloud Memorystore, etc.)
   - Update REDIS_URL in secrets
   - Skip redis-cluster-statefulset.yaml

5. **Configure resource limits** based on load testing

6. **Set up monitoring**
   ```bash
   kubectl apply -f monitoring/prometheus.yaml
   kubectl apply -f monitoring/grafana.yaml
   ```

## Multi-Region Deployment

For multi-region setup:

1. Deploy to each region with region-specific configuration
2. Set up cross-region database replication
3. Configure global load balancer (Cloud Load Balancer, Route 53, etc.)
4. Set data residency configuration per region

See `k8s/multi-region/` for region-specific configurations.

## Clean Up

```bash
# Delete all resources
kubectl delete namespace mojeeb

# Or delete individually
kubectl delete -f k8s/
```

## Support

For issues or questions:
- Check logs: `kubectl logs -n mojeeb <pod-name>`
- Check status: `kubectl describe pod -n mojeeb <pod-name>`
- View events: `kubectl get events -n mojeeb`
