# Kubernetes Deployment Guide

This guide covers deploying Mojeeb on Kubernetes using either raw manifests or Helm charts.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [Deployment Options](#deployment-options)
- [Option 1: Using Helm (Recommended)](#option-1-using-helm-recommended)
- [Option 2: Using Raw Kubernetes Manifests](#option-2-using-raw-kubernetes-manifests)
- [Configuration](#configuration)
- [Health Checks](#health-checks)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- **Kubernetes Cluster** (v1.24+)
  - Managed cluster (GKE, EKS, AKS) or self-hosted
  - At least 3 worker nodes for production
  - 8GB+ RAM and 4+ vCPUs per node recommended

- **kubectl** (v1.24+)
  ```bash
  kubectl version --client
  ```

- **Helm** (v3.10+) - if using Helm deployment
  ```bash
  helm version
  ```

- **Docker Registry Access**
  - Public registry (Docker Hub) or private registry
  - Images: `mojeeb/api:latest`, `mojeeb/worker:latest`, `mojeeb/web:latest`

### Required Kubernetes Resources

- **Ingress Controller** (NGINX recommended)
  ```bash
  kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
  ```

- **cert-manager** (for TLS certificates)
  ```bash
  kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
  ```

- **Storage Class**
  - For PersistentVolumeClaims
  - `ReadWriteMany` support required for API uploads
  - Check available storage classes:
    ```bash
    kubectl get storageclass
    ```

## Architecture Overview

### Components

Mojeeb's Kubernetes deployment consists of:

1. **API Servers** (stateless, horizontally scaled)
   - REST API endpoints
   - WebSocket server (Socket.IO)
   - Health checks and readiness probes
   - Auto-scaling: 3-20 replicas

2. **Worker Pods** (background job processing)
   - BullMQ queue consumers
   - Independent scaling from API
   - Auto-scaling: 3-20 replicas

3. **Web Frontend** (Next.js)
   - Static assets and SSR
   - 3+ replicas for high availability

4. **PostgreSQL** (stateful)
   - Primary instance for writes
   - Read replicas for analytics queries
   - Persistent storage

5. **Redis Cluster** (stateful)
   - Socket.IO adapter (session sharing)
   - BullMQ job queues
   - Persistent storage with AOF

### Network Architecture

```
Internet
    ↓
Ingress (NGINX + TLS)
    ↓
    ├─→ /api, /ws, /socket.io → API Service → API Pods (3-20)
    └─→ /                     → Web Service → Web Pods (3+)
                                       ↓
                               ┌───────┴───────┐
                               ↓               ↓
                         PostgreSQL      Redis Cluster
                      (primary + replicas)   (3+ nodes)
                               ↑
                         Worker Pods (3-20)
```

## Deployment Options

Mojeeb can be deployed using either:

1. **Helm Charts** (Recommended) - Easier configuration management
2. **Raw Kubernetes Manifests** - More control, manual configuration

## Option 1: Using Helm (Recommended)

Helm provides the easiest way to deploy Mojeeb with sensible defaults and easy customization.

### Step 1: Review and Customize Values

```bash
# Review default values
cat helm/mojeeb/values.yaml

# For production, create a custom values file
cp helm/mojeeb/values.yaml my-values.yaml
```

Edit `my-values.yaml`:

```yaml
# Example customization
global:
  domain: my-company.com
  tlsEnabled: true

api:
  replicaCount: 5
  autoscaling:
    minReplicas: 5
    maxReplicas: 30

postgresql:
  readReplicas:
    replicas: 3

secrets:
  databaseUrl: "postgresql://user:pass@postgres:5432/mojeeb"
  redisUrl: "redis://:password@redis-cluster:6379"
  jwtSecret: "your-jwt-secret-here"
  # ... other secrets
```

### Step 2: Create Kubernetes Secrets

**IMPORTANT**: Never commit secrets to version control. Use one of these methods:

#### Method A: Using --set flags

```bash
helm install mojeeb ./helm/mojeeb \
  -f my-values.yaml \
  --set secrets.databaseUrl="postgresql://..." \
  --set secrets.redisUrl="redis://..." \
  --set secrets.jwtSecret="..." \
  --set secrets.openaiApiKey="..."
  # ... other secrets
```

#### Method B: Using a separate secrets file (encrypted)

```bash
# Create secrets file (DO NOT commit this)
cat > secrets.yaml <<EOF
secrets:
  databaseUrl: "postgresql://..."
  redisUrl: "redis://..."
  jwtSecret: "..."
  openaiApiKey: "..."
EOF

# Encrypt with SOPS or sealed-secrets before committing
# Then install:
helm install mojeeb ./helm/mojeeb \
  -f my-values.yaml \
  -f secrets.yaml
```

#### Method C: Using Kubernetes Secrets (recommended for production)

```bash
# Create secret manually
kubectl create secret generic mojeeb-secrets \
  --from-literal=DATABASE_URL="postgresql://..." \
  --from-literal=REDIS_URL="redis://..." \
  --from-literal=JWT_SECRET="..." \
  --from-literal=OPENAI_API_KEY="..." \
  --namespace mojeeb

# Disable secret creation in Helm
# In my-values.yaml, the chart will use existing secret
```

### Step 3: Install with Helm

```bash
# Install Mojeeb
helm install mojeeb ./helm/mojeeb \
  -f my-values.yaml \
  --namespace mojeeb \
  --create-namespace

# Or upgrade existing installation
helm upgrade mojeeb ./helm/mojeeb \
  -f my-values.yaml \
  --namespace mojeeb
```

### Step 4: Verify Deployment

```bash
# Check pod status
kubectl get pods -n mojeeb

# Check services
kubectl get svc -n mojeeb

# Check ingress
kubectl get ingress -n mojeeb

# View logs
kubectl logs -n mojeeb -l component=api --tail=100
kubectl logs -n mojeeb -l component=worker --tail=100
```

### Helm Management Commands

```bash
# List releases
helm list -n mojeeb

# Get values
helm get values mojeeb -n mojeeb

# Rollback to previous version
helm rollback mojeeb -n mojeeb

# Uninstall
helm uninstall mojeeb -n mojeeb
```

## Option 2: Using Raw Kubernetes Manifests

For those who prefer direct control over Kubernetes resources.

### Step 1: Create Namespace

```bash
kubectl apply -f k8s/namespace.yaml
```

### Step 2: Configure Secrets

Edit `k8s/secrets.yaml` with your actual secrets (or create manually):

```bash
# IMPORTANT: Do not commit actual secrets to Git
# Use base64 encoding for secret values
echo -n "your-secret-value" | base64

# Or create secrets imperatively
kubectl create secret generic mojeeb-secrets \
  --from-literal=DATABASE_URL="postgresql://user:pass@postgres:5432/mojeeb" \
  --from-literal=READ_REPLICA_URL="postgresql://user:pass@postgres-read:5432/mojeeb" \
  --from-literal=REDIS_URL="redis://:password@redis-cluster:6379" \
  --from-literal=REDIS_PASSWORD="your-redis-password" \
  --from-literal=JWT_SECRET="your-jwt-secret" \
  --from-literal=JWT_REFRESH_SECRET="your-jwt-refresh-secret" \
  --from-literal=OPENAI_API_KEY="sk-..." \
  --from-literal=EMAIL_HOST="smtp.example.com" \
  --from-literal=EMAIL_PORT="587" \
  --from-literal=EMAIL_USER="noreply@example.com" \
  --from-literal=EMAIL_PASSWORD="email-password" \
  --from-literal=GOOGLE_CLIENT_ID="..." \
  --from-literal=GOOGLE_CLIENT_SECRET="..." \
  --from-literal=WHATSAPP_API_URL="https://..." \
  --from-literal=WHATSAPP_API_TOKEN="..." \
  --from-literal=KASHIER_API_KEY="..." \
  --from-literal=KASHIER_MERCHANT_ID="..." \
  --namespace mojeeb
```

### Step 3: Configure ConfigMaps

Edit `k8s/configmap.yaml` with your non-sensitive configuration:

```yaml
# Update these values based on your environment
FRONTEND_URL: "https://your-domain.com"
API_URL: "https://your-domain.com/api"
```

Apply:

```bash
kubectl apply -f k8s/configmap.yaml
```

### Step 4: Deploy Infrastructure (PostgreSQL and Redis)

```bash
# Deploy PostgreSQL
kubectl apply -f k8s/postgres-statefulset.yaml
kubectl apply -f k8s/postgres-service.yaml

# Wait for PostgreSQL to be ready
kubectl wait --for=condition=ready pod -l component=postgres -n mojeeb --timeout=300s

# Deploy Redis Cluster
kubectl apply -f k8s/redis-cluster-statefulset.yaml
kubectl apply -f k8s/redis-cluster-service.yaml

# Wait for Redis to be ready
kubectl wait --for=condition=ready pod -l component=redis -n mojeeb --timeout=300s
```

### Step 5: Deploy Application Services

```bash
# Deploy API servers
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/api-service.yaml
kubectl apply -f k8s/api-hpa.yaml

# Deploy Worker pods
kubectl apply -f k8s/worker-deployment.yaml
kubectl apply -f k8s/worker-hpa.yaml

# Deploy Web frontend
kubectl apply -f k8s/web-deployment.yaml
kubectl apply -f k8s/web-service.yaml

# Wait for all pods to be ready
kubectl wait --for=condition=ready pod -l app=mojeeb -n mojeeb --timeout=300s
```

### Step 6: Configure Ingress

Edit `k8s/ingress.yaml` to set your domain:

```yaml
spec:
  rules:
  - host: your-domain.com  # Update this
    http:
      paths:
      # ... paths
```

Apply ingress:

```bash
kubectl apply -f k8s/ingress.yaml
```

### Step 7: Verify Deployment

```bash
# Check all resources
kubectl get all -n mojeeb

# Check pods are running
kubectl get pods -n mojeeb

# Expected output:
# NAME                      READY   STATUS    RESTARTS   AGE
# api-xxxxxxxxx-xxxxx       1/1     Running   0          2m
# api-xxxxxxxxx-xxxxx       1/1     Running   0          2m
# api-xxxxxxxxx-xxxxx       1/1     Running   0          2m
# worker-xxxxxxxxx-xxxxx    1/1     Running   0          2m
# worker-xxxxxxxxx-xxxxx    1/1     Running   0          2m
# web-xxxxxxxxx-xxxxx       1/1     Running   0          2m
# postgres-0                1/1     Running   0          5m
# redis-cluster-0           1/1     Running   0          5m
# redis-cluster-1           1/1     Running   0          5m
# redis-cluster-2           1/1     Running   0          5m
```

## Configuration

### Environment Variables

All configuration is managed through ConfigMaps and Secrets:

#### ConfigMap (`mojeeb-config`)

Non-sensitive configuration:
- `NODE_ENV`: production
- `API_PORT`: 4000
- `FRONTEND_URL`: Your frontend URL
- `API_URL`: Your API URL
- `JWT_ACCESS_EXPIRY`: 15m
- `JWT_REFRESH_EXPIRY`: 7d
- `EMAIL_FROM`: noreply@your-domain.com
- `ENABLE_WEBSOCKET`: true
- `ENABLE_QUEUE_PROCESSING`: true (API), false (Worker)

#### Secret (`mojeeb-secrets`)

Sensitive configuration:
- Database credentials
- Redis credentials
- JWT secrets
- API keys (OpenAI, Google, WhatsApp, Kashier)
- Email credentials

### Resource Limits

Default resource allocations:

**API Pods:**
- Requests: 512Mi memory, 250m CPU
- Limits: 2Gi memory, 1000m CPU

**Worker Pods:**
- Requests: 512Mi memory, 250m CPU
- Limits: 2Gi memory, 1000m CPU

**Web Pods:**
- Requests: 256Mi memory, 100m CPU
- Limits: 1Gi memory, 500m CPU

Adjust in deployment files or Helm values based on your load.

### Persistent Storage

**API Uploads:**
- 10Gi ReadWriteMany volume
- Mounted at `/app/apps/api/uploads`
- Storage class: `standard` (customize as needed)

**PostgreSQL:**
- 50Gi per instance
- Storage class: `standard`

**Redis:**
- 5Gi per node
- Append-only file enabled

## Health Checks

### API Health Endpoints

**Liveness Probe:** `GET /api/v1/health`
- Checks if application is alive
- Initial delay: 60s
- Period: 10s
- Failure threshold: 3

**Readiness Probe:** `GET /api/v1/health/ready`
- Checks if application is ready to serve traffic
- Validates database and Redis connectivity
- Initial delay: 30s
- Period: 5s
- Failure threshold: 3

### Worker Health Checks

Workers use process checks:
```bash
pgrep -f node || pgrep -f worker
```

### Manual Health Check

```bash
# Port-forward to API pod
kubectl port-forward -n mojeeb svc/api 4000:4000

# Check health
curl http://localhost:4000/api/v1/health

# Expected response:
# {"status":"ok","timestamp":"2026-03-09T..."}

# Check readiness
curl http://localhost:4000/api/v1/health/ready

# Expected response:
# {"status":"ready","services":{"database":"connected","redis":"connected"}}
```

## Verification

### 1. Check Pod Status

```bash
kubectl get pods -n mojeeb

# All pods should be Running and READY
```

### 2. Check Logs

```bash
# API logs
kubectl logs -n mojeeb -l component=api --tail=50

# Worker logs
kubectl logs -n mojeeb -l component=worker --tail=50

# Follow logs in real-time
kubectl logs -n mojeeb -l component=api -f
```

### 3. Check Services

```bash
kubectl get svc -n mojeeb

# Expected services:
# - api (ClusterIP)
# - web (ClusterIP)
# - postgres (ClusterIP)
# - redis-cluster (Headless)
```

### 4. Check Ingress

```bash
kubectl get ingress -n mojeeb

# Check if ADDRESS is populated (external IP or hostname)
kubectl describe ingress mojeeb -n mojeeb
```

### 5. Test External Access

```bash
# Get ingress address
INGRESS_IP=$(kubectl get ingress mojeeb -n mojeeb -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Test API endpoint
curl -k https://$INGRESS_IP/api/v1/health

# Or use domain if DNS is configured
curl https://your-domain.com/api/v1/health
```

### 6. Test WebSocket Connection

```bash
# Use a WebSocket client or browser console
const socket = io('https://your-domain.com', {
  path: '/socket.io',
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('Connected!');
});
```

### 7. Check Auto-scaling

```bash
# Check HPA status
kubectl get hpa -n mojeeb

# Expected output showing current/desired replicas
# NAME     REFERENCE        TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
# api      Deployment/api   50%/70%   3         20        3          10m
# worker   Deployment/worker 40%/70%  3         20        3          10m
```

## Troubleshooting

### Pods Not Starting

```bash
# Describe pod to see events
kubectl describe pod <pod-name> -n mojeeb

# Common issues:
# - Image pull errors: Check registry credentials
# - Insufficient resources: Check node capacity
# - ConfigMap/Secret missing: Verify they exist
```

### Database Connection Issues

```bash
# Check PostgreSQL pod
kubectl logs -n mojeeb postgres-0

# Test connection from API pod
kubectl exec -it -n mojeeb <api-pod-name> -- sh
# Inside pod:
nc -zv postgres 5432
```

### Redis Connection Issues

```bash
# Check Redis pods
kubectl logs -n mojeeb redis-cluster-0

# Test connection from API pod
kubectl exec -it -n mojeeb <api-pod-name> -- sh
# Inside pod:
nc -zv redis-cluster 6379
```

### Ingress Not Working

```bash
# Check ingress controller
kubectl get pods -n ingress-nginx

# Check ingress events
kubectl describe ingress mojeeb -n mojeeb

# Verify TLS certificate
kubectl get certificate -n mojeeb
```

### High Memory Usage

```bash
# Check pod memory usage
kubectl top pods -n mojeeb

# If pods are being OOMKilled, increase memory limits
# Edit deployment or Helm values and apply
```

### Logs Show Errors

```bash
# Get logs from all API pods
kubectl logs -n mojeeb -l component=api --tail=100

# Search for specific errors
kubectl logs -n mojeeb -l component=api | grep ERROR

# Export logs to file for analysis
kubectl logs -n mojeeb -l component=api > api-logs.txt
```

### Zero-Downtime Deployments

When updating deployments:

```bash
# Rolling update is default, but verify:
kubectl get deployment api -n mojeeb -o yaml | grep strategy

# Should show:
# strategy:
#   type: RollingUpdate
#   rollingUpdate:
#     maxSurge: 1
#     maxUnavailable: 0

# Watch rollout status
kubectl rollout status deployment/api -n mojeeb

# If issues occur, rollback
kubectl rollout undo deployment/api -n mojeeb
```

### Scaling Issues

```bash
# Manually scale if HPA is not working
kubectl scale deployment api --replicas=5 -n mojeeb

# Check HPA metrics
kubectl get hpa api -n mojeeb --watch

# If metrics are unavailable, ensure metrics-server is installed
kubectl get deployment metrics-server -n kube-system
```

## Best Practices

1. **Use Helm for Production** - Easier management and upgrades
2. **Never Commit Secrets** - Use encrypted secrets or external secret management
3. **Monitor Resource Usage** - Use kubectl top and set appropriate limits
4. **Enable Auto-scaling** - Start with conservative limits and adjust based on load
5. **Use Readiness Probes** - Prevent traffic to unhealthy pods
6. **Configure Pod Disruption Budgets** - Ensure availability during node maintenance
7. **Use Pod Anti-affinity** - Spread pods across nodes for high availability
8. **Regular Backups** - Schedule database and Redis backups
9. **Review Logs Regularly** - Set up log aggregation (ELK, Loki, etc.)
10. **Test Disaster Recovery** - Practice restoring from backups

## Next Steps

- [Multi-Region Deployment](./multi-region.md) - Deploy across multiple regions
- [Scaling Guide](./scaling-guide.md) - Learn about scaling strategies
- Monitoring Setup - Configure Prometheus and Grafana
- CI/CD Integration - Automate deployments with GitHub Actions or GitLab CI
