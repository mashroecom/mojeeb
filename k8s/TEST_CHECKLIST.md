# Kubernetes Deployment Test Checklist

This checklist provides step-by-step verification procedures for validating the Kubernetes deployment.

## Pre-Deployment Validation

### ✓ Manifest Validation (Completed Offline)

- [x] All 14 YAML files have valid syntax
- [x] All manifests have required fields (apiVersion, kind, metadata)
- [x] All resources properly namespaced
- [x] Container images specified
- [x] Resource limits and requests defined
- [x] Health probes configured
- [x] Anti-affinity rules for high availability
- [x] Auto-scaling policies defined

**Status**: PASSED - All manifests are syntactically valid

## Deployment to Local Cluster

When a local cluster (kind/minikube) is available:

### 1. Cluster Setup

```bash
# Create local cluster
kind create cluster --name mojeeb-local

# Verify cluster
kubectl cluster-info
kubectl get nodes
```

- [ ] Cluster created successfully
- [ ] kubectl can connect
- [ ] Node(s) are Ready

### 2. Build and Load Images

```bash
# Build images
docker build -t mojeeb/api:latest -f apps/api/Dockerfile .
docker build -t mojeeb/worker:latest -f apps/worker/Dockerfile .
docker build -t mojeeb/web:latest -f apps/web/Dockerfile .

# Load into kind
kind load docker-image mojeeb/api:latest --name mojeeb-local
kind load docker-image mojeeb/worker:latest --name mojeeb-local
kind load docker-image mojeeb/web:latest --name mojeeb-local
```

- [ ] API image built successfully
- [ ] Worker image built successfully
- [ ] Web image built successfully
- [ ] Images loaded into cluster

### 3. Create Namespace and Secrets

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Verify namespace
kubectl get namespace mojeeb

# Create secrets
kubectl create secret generic mojeeb-secrets \
  --namespace=mojeeb \
  --from-literal=DATABASE_URL='postgresql://mojeeb:testpass123@postgres-primary:5432/mojeeb' \
  --from-literal=READ_REPLICA_URL='postgresql://mojeeb:testpass123@postgres-replica:5432/mojeeb' \
  --from-literal=REDIS_URL='redis://:testpass123@redis-cluster:6379' \
  --from-literal=REDIS_PASSWORD='testpass123' \
  --from-literal=POSTGRES_PASSWORD='testpass123' \
  --from-literal=JWT_SECRET='test-jwt-secret-min-32-characters-long' \
  --from-literal=JWT_REFRESH_SECRET='test-jwt-refresh-secret-min-32-chars' \
  --from-literal=EMAIL_HOST='smtp.example.com' \
  --from-literal=EMAIL_PORT='587' \
  --from-literal=EMAIL_USER='test@mojeeb.local' \
  --from-literal=EMAIL_PASSWORD='testpass' \
  --from-literal=OPENAI_API_KEY='sk-test-key' \
  --from-literal=GOOGLE_CLIENT_ID='test-client-id' \
  --from-literal=GOOGLE_CLIENT_SECRET='test-secret' \
  --from-literal=WHATSAPP_API_URL='http://localhost' \
  --from-literal=WHATSAPP_API_TOKEN='test-token' \
  --from-literal=KASHIER_API_KEY='test-key' \
  --from-literal=KASHIER_MERCHANT_ID='test-id'

# Verify secrets
kubectl get secrets -n mojeeb
```

- [ ] Namespace created
- [ ] Secrets created successfully
- [ ] Secrets contain all required keys

### 4. Deploy Infrastructure (PostgreSQL)

```bash
# Apply ConfigMap and PostgreSQL
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres-statefulset.yaml
kubectl apply -f k8s/postgres-service.yaml

# Watch pods come up
kubectl get pods -n mojeeb --watch

# Wait for primary to be ready
kubectl wait --for=condition=ready pod -l component=postgres,role=primary -n mojeeb --timeout=300s

# Check logs
kubectl logs -n mojeeb statefulset/postgres-primary --tail=50
```

- [ ] ConfigMap created
- [ ] postgres-primary StatefulSet created
- [ ] postgres-replica StatefulSet created
- [ ] Primary pod is Running
- [ ] Replica pods are Running
- [ ] Services created
- [ ] No error logs

**Verify PostgreSQL Health:**
```bash
# Test connection
kubectl exec -it -n mojeeb statefulset/postgres-primary -- pg_isready -U mojeeb

# Check replication status (on primary)
kubectl exec -it -n mojeeb statefulset/postgres-primary -- psql -U mojeeb -c "SELECT * FROM pg_stat_replication;"
```

- [ ] Primary responds to pg_isready
- [ ] Replicas connected to primary
- [ ] Replication lag is minimal

### 5. Deploy Redis Cluster

```bash
# Apply Redis manifests
kubectl apply -f k8s/redis-cluster-statefulset.yaml
kubectl apply -f k8s/redis-cluster-service.yaml

# Wait for Redis to be ready
kubectl wait --for=condition=ready pod -l component=redis -n mojeeb --timeout=300s

# Check Redis logs
kubectl logs -n mojeeb statefulset/redis-cluster-0 --tail=50
```

- [ ] redis-cluster StatefulSet created
- [ ] All 3 Redis pods Running
- [ ] Service created
- [ ] No error logs

**Verify Redis Health:**
```bash
# Test connection
kubectl exec -it -n mojeeb statefulset/redis-cluster-0 -- redis-cli -a testpass123 PING

# Check Redis info
kubectl exec -it -n mojeeb statefulset/redis-cluster-0 -- redis-cli -a testpass123 INFO server
```

- [ ] Redis responds to PING with PONG
- [ ] Redis version info displays

### 6. Deploy Application Services

```bash
# Deploy API
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/api-service.yaml

# Deploy Worker
kubectl apply -f k8s/worker-deployment.yaml

# Deploy Web
kubectl apply -f k8s/web-deployment.yaml
kubectl apply -f k8s/web-service.yaml

# Watch all pods
kubectl get pods -n mojeeb --watch

# Wait for deployments
kubectl wait --for=condition=available deployment/api -n mojeeb --timeout=300s
kubectl wait --for=condition=available deployment/worker -n mojeeb --timeout=300s
kubectl wait --for=condition=available deployment/web -n mojeeb --timeout=300s
```

- [ ] API deployment created (3 replicas)
- [ ] Worker deployment created (2 replicas)
- [ ] Web deployment created (3 replicas)
- [ ] All pods reach Running state
- [ ] All pods pass readiness probes

**Check Pod Status:**
```bash
kubectl get pods -n mojeeb
kubectl describe deployment -n mojeeb api
kubectl describe deployment -n mojeeb worker
kubectl describe deployment -n mojeeb web
```

- [ ] API: 3/3 pods running
- [ ] Worker: 2/2 pods running
- [ ] Web: 3/3 pods running
- [ ] No CrashLoopBackOff or ImagePullBackOff

### 7. Deploy Auto-Scaling

```bash
# Apply HPA manifests
kubectl apply -f k8s/api-hpa.yaml
kubectl apply -f k8s/worker-hpa.yaml

# Check HPA status
kubectl get hpa -n mojeeb
kubectl describe hpa api -n mojeeb
kubectl describe hpa worker -n mojeeb
```

- [ ] API HPA created (min: 3, max: 20)
- [ ] Worker HPA created (min: 3, max: 20)
- [ ] Metrics available (may take a few minutes)
- [ ] Current CPU/Memory utilization shown

## Functional Testing

### 8. Verify Database Connectivity

```bash
# Connect to API pod
kubectl exec -it -n mojeeb deployment/api -- /bin/sh

# Test database connection (inside pod)
node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => { console.log('✓ Connected to PostgreSQL'); return client.query('SELECT version()'); })
  .then(res => console.log('PostgreSQL version:', res.rows[0].version))
  .catch(err => console.error('✗ Database error:', err.message))
  .finally(() => client.end());
"

# Test read replica
node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.READ_REPLICA_URL });
client.connect()
  .then(() => console.log('✓ Connected to Read Replica'))
  .catch(err => console.error('✗ Read replica error:', err.message))
  .finally(() => client.end());
"
```

- [ ] API can connect to primary database
- [ ] API can query primary database
- [ ] API can connect to read replica
- [ ] PostgreSQL version displayed

### 9. Verify Redis Connectivity

```bash
# From API pod
node -e "
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);
redis.ping()
  .then(result => console.log('✓ Redis PING:', result))
  .then(() => redis.set('test-key', 'test-value'))
  .then(() => redis.get('test-key'))
  .then(value => console.log('✓ Redis GET test-key:', value))
  .catch(err => console.error('✗ Redis error:', err.message))
  .finally(() => redis.quit());
"
```

- [ ] API can connect to Redis
- [ ] PING returns PONG
- [ ] Can write and read from Redis

### 10. Verify Health Endpoints

```bash
# Port forward API service
kubectl port-forward -n mojeeb svc/api 4000:4000 &

# Test health endpoints
curl http://localhost:4000/api/v1/health
curl http://localhost:4000/api/v1/health/ready

# Kill port-forward
pkill -f "port-forward"
```

- [ ] /health endpoint returns 200 OK
- [ ] /health/ready endpoint returns 200 OK
- [ ] Response includes database and Redis status

### 11. Verify Workers Can Process Jobs

```bash
# Add a test job from API pod
kubectl exec -it -n mojeeb deployment/api -- node -e "
const { Queue } = require('bullmq');
const queue = new Queue('analytics-events', {
  connection: { url: process.env.REDIS_URL }
});
queue.add('test-job', {
  message: 'Test job from validation',
  timestamp: new Date().toISOString()
})
.then(() => console.log('✓ Test job added to queue'))
.catch(err => console.error('✗ Error adding job:', err.message));
"

# Watch worker logs for job processing
kubectl logs -n mojeeb -l component=worker -f --tail=50
```

- [ ] Job successfully added to queue
- [ ] Worker picks up job (visible in logs)
- [ ] Job processes without errors
- [ ] Job completes successfully

### 12. Test Auto-Scaling

```bash
# Create load generator
kubectl run -n mojeeb load-generator \
  --image=busybox \
  --restart=Never \
  -- /bin/sh -c "while true; do wget -q -O- http://api:4000/api/v1/health; done"

# Watch HPA scale up (in separate terminal)
kubectl get hpa -n mojeeb --watch

# Watch pods scale (in separate terminal)
kubectl get pods -n mojeeb -l component=api --watch

# Wait 2-3 minutes for scaling

# Check HPA status
kubectl describe hpa api -n mojeeb

# Clean up load generator
kubectl delete pod -n mojeeb load-generator
```

- [ ] Load generator creates CPU load
- [ ] HPA detects increased CPU utilization
- [ ] API pods scale up beyond initial 3 replicas
- [ ] New pods become Ready
- [ ] After stopping load, HPA scales down (after stabilization window)

### 13. Test Rolling Updates

```bash
# Trigger rolling update by changing an annotation
kubectl patch deployment api -n mojeeb \
  -p '{"spec":{"template":{"metadata":{"annotations":{"test-update":"'$(date +%s)'"}}}}}'

# Watch rolling update
kubectl rollout status deployment/api -n mojeeb

# Verify no downtime (from another terminal during update)
for i in {1..60}; do
  kubectl exec -n mojeeb deployment/api -- wget -q -O- http://localhost:4000/api/v1/health || echo "Failed";
  sleep 1;
done
```

- [ ] Rolling update initiated
- [ ] Old pods terminated gracefully
- [ ] New pods come up successfully
- [ ] No health check failures during update
- [ ] Service remains available throughout

### 14. Test Pod Recovery

```bash
# Delete a pod and watch it recover
kubectl delete pod -n mojeeb -l component=api --field-selector=status.phase=Running | head -1

# Watch new pod come up
kubectl get pods -n mojeeb -l component=api --watch

# Verify service still works
kubectl exec -n mojeeb deployment/api -- wget -q -O- http://localhost:4000/api/v1/health
```

- [ ] Deleted pod terminates
- [ ] New pod automatically created by deployment
- [ ] New pod passes readiness probe
- [ ] Service continues to work during recovery

## Load Testing

### 15. Stress Test (Optional)

```bash
# Install hey (HTTP load generator)
# https://github.com/rakyll/hey

# Run load test
hey -z 2m -c 50 -q 10 http://api.mojeeb.local/api/v1/health

# Watch resource usage
kubectl top pods -n mojeeb
kubectl get hpa -n mojeeb
```

- [ ] System handles sustained load
- [ ] Response times remain acceptable
- [ ] Auto-scaling responds appropriately
- [ ] No pod crashes or restarts

## Summary

### Infrastructure
- [ ] PostgreSQL primary running with 2 replicas
- [ ] Redis cluster running with 3 nodes
- [ ] All StatefulSets healthy

### Application
- [ ] API deployment: 3+ pods running
- [ ] Worker deployment: 2+ pods running
- [ ] Web deployment: 3 pods running
- [ ] All health probes passing

### Connectivity
- [ ] API connects to PostgreSQL (primary and replica)
- [ ] API connects to Redis
- [ ] Workers connect to Redis queues
- [ ] Services can communicate internally

### Auto-Scaling
- [ ] HPA configured for API and workers
- [ ] Scaling up works based on CPU load
- [ ] Scaling down works after stabilization

### High Availability
- [ ] Pods distributed across nodes (if multi-node)
- [ ] Rolling updates work without downtime
- [ ] Pod self-healing works
- [ ] Service remains available during pod failures

## Final Validation

✓ All manifests are syntactically valid
⚠ Full end-to-end testing requires:
  - Local Kubernetes cluster (kind/minikube)
  - Docker images built and loaded
  - Secrets created with valid credentials
  - Network access to services

**Status**: Ready for deployment to test cluster
