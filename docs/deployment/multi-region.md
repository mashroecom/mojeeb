# Multi-Region Deployment Guide

This guide covers deploying Mojeeb across multiple regions for improved latency, high availability, and data residency compliance (MENA region requirements).

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Use Cases](#use-cases)
- [Deployment Strategies](#deployment-strategies)
- [Data Residency Compliance](#data-residency-compliance)
- [Region-Specific Deployments](#region-specific-deployments)
- [DNS and Traffic Routing](#dns-and-traffic-routing)
- [Data Synchronization](#data-synchronization)
- [Disaster Recovery](#disaster-recovery)
- [Monitoring Multi-Region Deployments](#monitoring-multi-region-deployments)
- [Cost Optimization](#cost-optimization)

## Overview

Multi-region deployment allows you to:

1. **Reduce Latency** - Serve users from geographically closer servers
2. **Ensure Data Residency** - Keep data within specific jurisdictions (KSA, UAE requirements)
3. **Improve Availability** - Continue operating if one region fails
4. **Scale Globally** - Handle users across different time zones and regions

### Supported Regions

Mojeeb provides pre-configured Helm values for:

- **Default Region** - General deployment (`values.yaml`)
- **Saudi Arabia (KSA)** - Data residency for Saudi market (`values-ksa.yaml`)
- **UAE** - Data residency for UAE market (`values-uae.yaml`)
- **Custom Regions** - Create your own values file for any region

## Architecture

### Multi-Region Architecture

```
                        Internet
                           |
                    Global DNS (Route53/CloudFlare)
                           |
        ┌──────────────────┼──────────────────┐
        |                  |                  |
    Region 1          Region 2           Region 3
    (Default)           (KSA)              (UAE)
        |                  |                  |
   ┌────┴────┐        ┌────┴────┐       ┌────┴────┐
   | Ingress |        | Ingress |       | Ingress |
   └────┬────┘        └────┬────┘       └────┬────┘
        |                  |                  |
   ┌────┴─────┐      ┌────┴─────┐      ┌────┴─────┐
   | Mojeeb   |      | Mojeeb   |      | Mojeeb   |
   | Services |      | Services |      | Services |
   └────┬─────┘      └────┬─────┘      └────┬─────┘
        |                  |                  |
   ┌────┴─────┐      ┌────┴─────┐      ┌────┴─────┐
   | Regional |      | Regional |      | Regional |
   | Database |      | Database |      | Database |
   └──────────┘      └──────────┘      └──────────┘
```

### Deployment Modes

#### 1. Independent Regional Deployments (Recommended)

Each region operates independently with its own:
- Database (no cross-region replication)
- Redis cluster
- Application services
- Storage

**Use Case**: Data residency compliance (KSA, UAE)

**Pros**:
- Simple to manage
- No cross-region latency
- Full data sovereignty
- Region failures are isolated

**Cons**:
- No automatic failover between regions
- Data is region-locked

#### 2. Active-Active with Data Replication

All regions serve traffic, with data replicated:
- Database replication (PostgreSQL logical replication)
- Shared Redis (challenging at scale)
- Eventual consistency model

**Use Case**: Global availability with disaster recovery

**Pros**:
- Automatic failover
- Best global performance
- No single point of failure

**Cons**:
- Complex to manage
- Replication lag
- Data conflicts possible
- Higher costs

#### 3. Active-Passive with Failover

Primary region serves traffic, secondary is standby:
- Regular backups to secondary region
- Manual or automatic failover

**Use Case**: Disaster recovery only

**Pros**:
- Simple disaster recovery
- Cost-effective
- Clear data ownership

**Cons**:
- Secondary region wasted during normal operation
- Failover delay
- Users may experience service interruption

## Use Cases

### 1. MENA Data Residency Compliance

**Scenario**: Saudi Arabian enterprise requires all data to remain in Saudi Arabia per regulatory requirements.

**Solution**: Independent regional deployment in KSA

```bash
# Deploy to Saudi Arabia region
helm install mojeeb ./helm/mojeeb \
  -f helm/mojeeb/values.yaml \
  -f helm/mojeeb/values-ksa.yaml \
  -f secrets-ksa.yaml \
  --namespace mojeeb-ksa \
  --create-namespace
```

### 2. Global Enterprise with Regional Performance

**Scenario**: Multinational company with users in MENA, Europe, and Asia needs low latency everywhere.

**Solution**: Independent deployments per region with geo-routing

```bash
# Deploy to multiple regions
helm install mojeeb ./helm/mojeeb -f values-ksa.yaml --namespace mojeeb-ksa
helm install mojeeb ./helm/mojeeb -f values-uae.yaml --namespace mojeeb-uae
helm install mojeeb ./helm/mojeeb -f values-eu.yaml --namespace mojeeb-eu
```

Configure DNS to route users to nearest region.

### 3. High Availability with DR

**Scenario**: Business requires 99.99% uptime with disaster recovery.

**Solution**: Active-passive deployment with automated backups

Primary region (active) + Secondary region (passive with regular backups)

## Data Residency Compliance

### Saudi Arabia (KSA) Requirements

Saudi Arabia's data protection laws require:
- Customer data stored within Saudi borders
- No data transfer outside kingdom without consent
- Government access on request

**Compliance Configuration**:

```yaml
# values-ksa.yaml
global:
  region: ksa
  dataResidency:
    enabled: true
    country: "SA"
    complianceLevel: "regulated"

# Node selector ensures pods run in Saudi region
nodeSelector:
  topology.kubernetes.io/region: saudi-arabia
  topology.kubernetes.io/zone: ksa-central-1
```

### UAE Requirements

UAE data protection regulations require:
- Personal data stored in UAE for residents
- Cross-border transfers require consent
- Data localization for government entities

**Compliance Configuration**:

```yaml
# values-uae.yaml
global:
  region: uae
  dataResidency:
    enabled: true
    country: "AE"
    complianceLevel: "regulated"

nodeSelector:
  topology.kubernetes.io/region: uae
  topology.kubernetes.io/zone: uae-north-1
```

### Compliance Verification

```bash
# Verify pods are running in correct region
kubectl get pods -n mojeeb-ksa -o wide

# Check node locations
kubectl get nodes -L topology.kubernetes.io/region

# Audit data residency
kubectl get pvc -n mojeeb-ksa -o yaml | grep storageClassName
# Verify storage class is region-specific (e.g., ksa-ssd)
```

## Region-Specific Deployments

### Saudi Arabia Deployment

```bash
# 1. Create namespace
kubectl create namespace mojeeb-ksa

# 2. Create secrets for KSA region
kubectl create secret generic mojeeb-secrets \
  --from-literal=DATABASE_URL="postgresql://..." \
  --from-literal=REDIS_URL="redis://..." \
  # ... other secrets
  --namespace mojeeb-ksa

# 3. Deploy using KSA values
helm install mojeeb-ksa ./helm/mojeeb \
  -f helm/mojeeb/values.yaml \
  -f helm/mojeeb/values-ksa.yaml \
  --namespace mojeeb-ksa

# 4. Verify deployment
kubectl get pods -n mojeeb-ksa
kubectl get ingress -n mojeeb-ksa

# 5. Configure DNS
# Point ksa.mojeeb.app to KSA ingress IP
```

**Key Differences in KSA Deployment**:
- Higher replica counts (4 vs 3)
- Increased resources for regional load
- Larger persistent volumes (100Gi vs 50Gi)
- More read replicas (3 vs 2)
- Stricter pod anti-affinity (required vs preferred)
- Network policies enabled
- Extended backup retention (30 days)

### UAE Deployment

```bash
# Deploy to UAE region
helm install mojeeb-uae ./helm/mojeeb \
  -f helm/mojeeb/values.yaml \
  -f helm/mojeeb/values-uae.yaml \
  --namespace mojeeb-uae \
  --create-namespace
```

Configuration similar to KSA with UAE-specific settings.

### Custom Region Deployment

Create your own values file for any region:

```yaml
# values-eu.yaml
global:
  namespace: mojeeb-eu
  environment: production
  region: eu-west
  domain: eu.mojeeb.app

  dataResidency:
    enabled: true
    country: "IE"
    complianceLevel: "standard"

nodeSelector:
  topology.kubernetes.io/region: europe-west1

# ... other overrides
```

Deploy:

```bash
helm install mojeeb-eu ./helm/mojeeb \
  -f helm/mojeeb/values.yaml \
  -f values-eu.yaml \
  --namespace mojeeb-eu
```

## DNS and Traffic Routing

### Geo-DNS Routing

Use DNS-based geographic routing to direct users to nearest region.

#### Using AWS Route 53

```hcl
# Terraform example
resource "aws_route53_zone" "main" {
  name = "mojeeb.app"
}

# Default region (catch-all)
resource "aws_route53_record" "default" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "app.mojeeb.app"
  type    = "A"

  set_identifier = "default"

  geolocation_routing_policy {
    continent = "NA"  # North America
  }

  alias {
    name                   = var.default_ingress_hostname
    zone_id                = var.default_ingress_zone_id
    evaluate_target_health = true
  }
}

# KSA region
resource "aws_route53_record" "ksa" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "app.mojeeb.app"
  type    = "A"

  set_identifier = "ksa"

  geolocation_routing_policy {
    country = "SA"  # Saudi Arabia
  }

  alias {
    name                   = var.ksa_ingress_hostname
    zone_id                = var.ksa_ingress_zone_id
    evaluate_target_health = true
  }
}

# UAE region
resource "aws_route53_record" "uae" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "app.mojeeb.app"
  type    = "A"

  set_identifier = "uae"

  geolocation_routing_policy {
    country = "AE"  # UAE
  }

  alias {
    name                   = var.uae_ingress_hostname
    zone_id                = var.uae_ingress_zone_id
    evaluate_target_health = true
  }
}

# Health checks
resource "aws_route53_health_check" "ksa" {
  fqdn              = "ksa.mojeeb.app"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/api/v1/health"
  failure_threshold = 3
  request_interval  = 30
}
```

#### Using CloudFlare

```bash
# CloudFlare Load Balancer with geo-steering
# Configuration via CloudFlare dashboard or API

# Create origin pools for each region
# KSA Pool: ksa.mojeeb.app
# UAE Pool: uae.mojeeb.app
# Default Pool: api.mojeeb.app

# Enable Geo Steering
# SA → KSA Pool
# AE → UAE Pool
# Other → Default Pool (with failover)
```

### Latency-Based Routing

Alternative to geo-routing: use latency-based routing to send users to fastest region.

```hcl
# AWS Route 53 latency-based routing
resource "aws_route53_record" "ksa_latency" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "app.mojeeb.app"
  type    = "A"

  set_identifier = "ksa"

  latency_routing_policy {
    region = "me-south-1"  # Bahrain (closest to KSA)
  }

  alias {
    name                   = var.ksa_ingress_hostname
    zone_id                = var.ksa_ingress_zone_id
    evaluate_target_health = true
  }
}
```

### Application-Level Routing

For more control, implement routing in your application:

```typescript
// Example: Redirect users based on IP geolocation
import geoip from 'geoip-lite';

app.use((req, res, next) => {
  const ip = req.ip;
  const geo = geoip.lookup(ip);

  if (geo?.country === 'SA' && !req.hostname.includes('ksa.')) {
    return res.redirect(`https://ksa.mojeeb.app${req.url}`);
  }

  if (geo?.country === 'AE' && !req.hostname.includes('uae.')) {
    return res.redirect(`https://uae.mojeeb.app${req.url}`);
  }

  next();
});
```

## Data Synchronization

### When Independent Deployments (Recommended)

Each region operates independently - **no synchronization needed**.

Users in each region have isolated data:
- KSA customers only in KSA database
- UAE customers only in UAE database

Benefits:
- Simple to manage
- No replication lag
- Full compliance
- Clear data ownership

### When Synchronization Required

If you need data across regions (not typical for Mojeeb):

#### PostgreSQL Logical Replication

```sql
-- On primary database (e.g., KSA)
CREATE PUBLICATION mojeeb_pub FOR ALL TABLES;

-- On secondary database (e.g., UAE - read-only copy)
CREATE SUBSCRIPTION mojeeb_sub
  CONNECTION 'host=ksa-db.example.com port=5432 dbname=mojeeb user=replication password=...'
  PUBLICATION mojeeb_pub;
```

**Warning**: This creates eventual consistency and may violate data residency requirements.

#### Redis Replication

Redis doesn't support multi-region clustering well. Options:

1. **Independent Redis per region** (recommended)
2. **Redis Enterprise** with Active-Active replication
3. **Application-level sync** using message queues

### User Profile Synchronization

If users need to access from multiple regions:

```yaml
# Option 1: Central authentication service
# - Auth service in neutral region
# - Regional deployments query auth service
# - Session data cached locally

# Option 2: Replicated auth database
# - User profiles replicated across regions
# - Business data stays regional
# - Careful with privacy laws
```

## Disaster Recovery

### Backup Strategy

Each region should have independent backups:

```yaml
# values-ksa.yaml
backup:
  enabled: true
  schedule: "0 3 * * *"  # Daily at 3 AM local time
  retention: 30  # days

  postgresql:
    enabled: true
    # Backup to regional storage (S3, GCS, etc.)
    s3Bucket: mojeeb-backups-ksa
    region: me-south-1

  redis:
    enabled: true
```

### Backup Script (CronJob)

```yaml
# k8s/backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: mojeeb-ksa
spec:
  schedule: "0 3 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:16
            command:
            - /bin/sh
            - -c
            - |
              pg_dump $DATABASE_URL | gzip > /backup/mojeeb-$(date +%Y%m%d-%H%M%S).sql.gz
              # Upload to S3
              aws s3 cp /backup/*.sql.gz s3://mojeeb-backups-ksa/
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: mojeeb-secrets
                  key: DATABASE_URL
            volumeMounts:
            - name: backup
              mountPath: /backup
          volumes:
          - name: backup
            emptyDir: {}
          restartPolicy: OnFailure
```

### Restore Procedure

```bash
# Download backup
aws s3 cp s3://mojeeb-backups-ksa/mojeeb-20260309-030000.sql.gz .

# Extract
gunzip mojeeb-20260309-030000.sql.gz

# Restore to database
kubectl port-forward -n mojeeb-ksa svc/postgres 5432:5432
psql $DATABASE_URL < mojeeb-20260309-030000.sql
```

### Cross-Region Backup Replication

For additional safety, replicate backups across regions:

```bash
# Replicate KSA backups to UAE region
aws s3 sync s3://mojeeb-backups-ksa s3://mojeeb-backups-uae --source-region me-south-1 --region me-central-1
```

### Failover Plan

**Scenario**: KSA region becomes unavailable

**Manual Failover Steps**:

1. **Assess Impact**
   ```bash
   # Check KSA region status
   kubectl get nodes -n mojeeb-ksa
   kubectl get pods -n mojeeb-ksa
   ```

2. **Update DNS**
   ```bash
   # Point ksa.mojeeb.app to backup region (e.g., UAE)
   # Or activate default region for KSA users
   ```

3. **Restore Data (if needed)**
   ```bash
   # Restore latest backup to failover region
   ```

4. **Notify Users**
   - Send email/SMS about temporary region change
   - Update status page

5. **Monitor**
   ```bash
   # Watch traffic and errors in failover region
   ```

**Automatic Failover** (if using active-active):
- Health checks detect KSA unavailability
- Route 53 automatically routes to healthy region
- Users experience minimal disruption

## Monitoring Multi-Region Deployments

### Centralized Monitoring

Use centralized monitoring to observe all regions:

#### Prometheus Federation

```yaml
# Central Prometheus scrapes regional Prometheus instances
scrape_configs:
  - job_name: 'federate-ksa'
    honor_labels: true
    metrics_path: '/federate'
    params:
      'match[]':
        - '{job=~"mojeeb.*"}'
    static_configs:
      - targets:
        - 'prometheus.mojeeb-ksa.svc.cluster.local:9090'
        labels:
          region: 'ksa'

  - job_name: 'federate-uae'
    honor_labels: true
    metrics_path: '/federate'
    params:
      'match[]':
        - '{job=~"mojeeb.*"}'
    static_configs:
      - targets:
        - 'prometheus.mojeeb-uae.svc.cluster.local:9090'
        labels:
          region: 'uae'
```

#### Grafana Dashboards

Create multi-region dashboard:

```json
{
  "dashboard": {
    "title": "Mojeeb Multi-Region Overview",
    "panels": [
      {
        "title": "Requests by Region",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (region)"
          }
        ]
      },
      {
        "title": "Latency by Region",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (region, le))"
          }
        ]
      }
    ]
  }
}
```

### Health Checks

Monitor each region's health:

```bash
# Script to check all regions
regions=("https://api.mojeeb.app" "https://ksa.mojeeb.app" "https://uae.mojeeb.app")

for region in "${regions[@]}"; do
  echo "Checking $region..."
  status=$(curl -s -o /dev/null -w "%{http_code}" $region/api/v1/health)

  if [ $status -eq 200 ]; then
    echo "✓ $region is healthy"
  else
    echo "✗ $region is unhealthy (HTTP $status)"
    # Send alert
  fi
done
```

### Alerting

Configure alerts for regional issues:

```yaml
# Prometheus alert rules
groups:
  - name: multi-region
    rules:
      - alert: RegionDown
        expr: up{job="mojeeb-api"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Region {{ $labels.region }} is down"
          description: "Mojeeb API in {{ $labels.region }} has been down for 5 minutes"

      - alert: HighLatencyRegion
        expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (region, le)) > 2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High latency in {{ $labels.region }}"
          description: "P95 latency in {{ $labels.region }} is {{ $value }}s"
```

## Cost Optimization

### Right-Sizing Resources

Start conservative, scale based on actual usage:

```yaml
# Initial deployment - minimal resources
api:
  replicaCount: 3
  resources:
    requests:
      memory: "512Mi"
      cpu: "250m"

# After monitoring, optimize per region
# KSA (high traffic)
api:
  replicaCount: 5
  resources:
    requests:
      memory: "1Gi"
      cpu: "500m"

# UAE (medium traffic)
api:
  replicaCount: 3
  resources:
    requests:
      memory: "512Mi"
      cpu: "250m"
```

### Spot/Preemptible Instances

Use spot instances for worker pods (non-critical):

```yaml
# Worker node pool with spot instances
nodeSelector:
  cloud.google.com/gke-preemptible: "true"

tolerations:
  - key: cloud.google.com/gke-preemptible
    operator: Equal
    value: "true"
    effect: NoSchedule
```

### Regional Resource Allocation

Deploy full stack only where needed:

```yaml
# High-traffic region (KSA) - full deployment
postgresql:
  enabled: true
  readReplicas:
    replicas: 3

redis:
  enabled: true
  cluster:
    replicas: 4

# Low-traffic region - minimal deployment
postgresql:
  enabled: true
  readReplicas:
    replicas: 1

redis:
  enabled: true
  cluster:
    replicas: 2
```

### Storage Optimization

```yaml
# Use appropriate storage classes
# Production KSA - SSD
postgresql:
  persistence:
    storageClassName: ksa-ssd
    size: 100Gi

# Dev/Test - Standard
postgresql:
  persistence:
    storageClassName: standard
    size: 20Gi
```

## Best Practices

1. **Isolate Customer Data by Region** - Simplifies compliance and reduces complexity
2. **Use Geo-DNS Routing** - Automatically route users to correct region
3. **Monitor All Regions Centrally** - Single pane of glass for operations
4. **Regular Backup Testing** - Verify you can restore in each region
5. **Document Failover Procedures** - Have runbooks ready for incidents
6. **Start Simple** - Begin with independent deployments, add complexity only if needed
7. **Label Everything** - Use consistent labels across regions for monitoring
8. **Automate Deployments** - Use CI/CD to deploy consistently to all regions
9. **Test Cross-Region** - Ensure region-specific features work as expected
10. **Cost Monitoring** - Track costs per region to optimize resource allocation

## Checklist

Before going live with multi-region:

- [ ] Reviewed data residency requirements for target regions
- [ ] Created region-specific Helm values files
- [ ] Set up Kubernetes clusters in target regions
- [ ] Configured network policies and security
- [ ] Tested deployments in each region
- [ ] Configured DNS routing (geo or latency-based)
- [ ] Set up monitoring and alerting for all regions
- [ ] Configured backups for each region
- [ ] Tested backup and restore procedures
- [ ] Documented failover procedures
- [ ] Performed disaster recovery drill
- [ ] Validated compliance requirements
- [ ] Load tested each region independently
- [ ] Set up cost tracking per region

## Next Steps

- [Kubernetes Deployment Guide](./kubernetes.md) - Deploy to a single region
- [Scaling Guide](./scaling-guide.md) - Scale within and across regions
- Monitor and optimize based on regional usage patterns
