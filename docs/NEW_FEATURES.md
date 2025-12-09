# ClusterCord Advanced Features Guide

This document details all the advanced features that make ClusterCord a comprehensive Kubernetes management platform.

## Table of Contents

- [1. Namespace Isolation for Multi-Server Sharing](#1-namespace-isolation)
- [2. Helm Chart Browser & Installer](#2-helm-management)
- [3. Cluster Blueprints](#3-cluster-blueprints)
- [4. AI-Powered Diagnostics](#4-ai-diagnostics)
- [5. Resource Usage & Cost Dashboard](#5-cost-dashboard)
- [6. Interactive Deployment Rollouts](#6-deployment-rollouts)
- [7. GitOps Integration](#7-gitops)
- [8. YAML Upload & Validation](#8-yaml-management)
- [9. Built-In Secret Management](#9-secret-management)
- [10. Job Runner](#10-job-runner)
- [11. Cluster Snapshots](#11-cluster-snapshots)
- [12. Alerts & Subscriptions](#12-alerts)
- [13. Image Vulnerability Scanning](#13-image-scanning)
- [14. Cluster Policy Enforcement](#14-policy-enforcement)
- [15. Web UI Companion (Roadmap)](#15-web-ui)

---

## 1. Namespace Isolation

### Overview

ClusterCord automatically creates isolated namespaces when multiple Discord servers share the same Kubernetes cluster. This ensures complete separation between teams with no cross-visibility.

### How It Works

**Guild-Level Namespaces:**
```
clustercord-guild-<guildID>
```

**User-Level Namespaces:**
```
clustercord-user-<userID>
```

### Features

✅ **Automatic Creation**: Namespaces created on first cluster access
✅ **Resource Quotas**: Configurable CPU/memory/pod limits per namespace
✅ **Network Policies**: Complete network isolation between guilds
✅ **RBAC Isolation**: Users can only see their guild's resources
✅ **No Cross-Team Visibility**: Perfect for multi-tenant scenarios

### Commands

```
/cluster add name:prod kubeconfig:<file> shared:true
```

When `shared:true`, ClusterCord creates guild-specific namespaces automatically.

### Use Cases

- **Shared homelab cluster** across multiple friend groups
- **Company cluster** with department isolation
- **Educational environment** with student/team sandboxes
- **Service provider** offering K8s access to multiple clients

### Configuration

```yaml
# Auto-applied resource quota
apiVersion: v1
kind: ResourceQuota
metadata:
  name: clustercord-quota
  namespace: clustercord-guild-123456
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    pods: "50"
```

### Security

- Network policies block inter-namespace traffic
- Metadata service (169.254.169.254) blocked by default
- DNS allowed for service discovery
- Internet egress permitted (configurable)

---

## 2. Helm Management

### Overview

Search, install, upgrade, and manage Helm charts directly from Discord using the ArtifactHub API.

### Commands

#### Search Charts

```
/helm search name:postgres
/helm search name:nginx repo:bitnami
```

Returns:
- Chart name and repo
- Latest version
- Description
- Star rating

#### Install Chart

```
/helm install chart:bitnami/postgresql version:15.2.0 namespace:db
/helm install chart:prometheus-community/kube-prometheus-stack namespace:monitoring
```

Options:
- `values:<file>` - Upload custom values.yaml
- `dry_run:true` - Preview before installing
- `create_namespace:true` - Auto-create namespace

#### List Releases

```
/helm list namespace:all
/helm list namespace:production status:deployed
```

Shows:
- Release name
- Chart version
- Status (deployed/failed/uninstalling)
- Last updated
- Revision number

#### Upgrade Release

```
/helm upgrade release:my-postgres version:15.3.0
/helm upgrade release:my-app values:<new-values.yaml>
```

Features:
- Version picker with changelog
- Values diff preview
- Rollback on failure

#### Uninstall Release

```
/helm uninstall release:my-postgres namespace:db
```

Confirmation required with impact preview.

### Advanced Features

**Diff Preview:**
Shows what will change before apply:
```diff
+ apiVersion: v1
+ kind: ConfigMap
+ metadata:
+   name: new-config
- replicas: 2
+ replicas: 3
```

**Values Override:**
Upload custom values.yaml:
```yaml
postgresql:
  auth:
    postgresPassword: ${SECRET}
  primary:
    resources:
      limits:
        memory: 2Gi
```

**Version History:**
View all available versions with release notes

### Use Cases

- Quick app deployment without kubectl
- Team members without Helm CLI access
- Standardized deployments
- Version management
- Disaster recovery

---

## 3. Cluster Blueprints

### Overview

One-click installation of popular stacks (monitoring, logging, GitOps, etc.).

### Commands

```
/cluster bootstrap preset:monitoring
/cluster bootstrap preset:logging
/cluster bootstrap preset:argocd
/cluster bootstrap preset:cert-manager
/cluster bootstrap preset:full-stack
```

### Available Presets

#### Monitoring Stack
Installs:
- Prometheus
- Grafana
- Alertmanager
- Node Exporter
- Kube State Metrics

Default credentials and access URLs provided.

#### Logging Stack
Installs:
- Loki
- Promtail
- Grafana (if not present)

Auto-configured log aggregation.

#### ArgoCD
Installs:
- ArgoCD
- ArgoCD CLI access configured
- Default admin credentials

Ready for GitOps workflows.

#### Cert-Manager + Ingress
Installs:
- cert-manager
- Ingress-NGINX
- ClusterIssuer for Let's Encrypt

Automatic TLS for ingresses.

#### Full Stack
Installs all of the above + storage provisioner

### Customization

```
/cluster bootstrap preset:monitoring custom_values:<file>
```

Upload values to override defaults.

### Post-Installation

Bot DMs you:
- Access URLs
- Default credentials
- Next steps guide
- Configuration tips

---

## 4. AI-Powered Diagnostics

### Overview

Intelligent troubleshooting for common Kubernetes issues with actionable recommendations.

### Commands

```
/diagnose pod:nginx-123 namespace:prod
/diagnose deployment:api namespace:prod
/diagnose node:worker-1
```

### Detects

#### CrashLoop Backoff
```
🔴 Pod is crash looping
Cause: Exit code 137 (OOMKilled)
Container memory limit: 128Mi
Current usage: 145Mi

Recommendation:
✅ Increase memory limit to 256Mi-512Mi
✅ Add memory requests for better scheduling
⚠️  Check for memory leaks in application
```

#### ImagePullError
```
🔴 Image pull failed
Error: unauthorized: authentication required

Recommendations:
✅ Verify image name is correct
✅ Create imagePullSecret if private registry
✅ Check registry credentials
```

#### High CPU/Memory
```
⚠️  High CPU usage detected
Current: 2.8 / 3.0 cores (93%)

Recommendations:
✅ Add HPA (Horizontal Pod Autoscaler)
✅ Review CPU limits (may be too restrictive)
✅ Check for CPU-intensive operations
```

#### Failed Health Probes
```
🔴 Liveness probe failing
Endpoint: GET /healthz timeout after 1s

Recommendations:
✅ Increase probe timeout to 3s
✅ Add initialDelaySeconds: 30
✅ Verify endpoint returns 200 OK
```

#### Pod Eviction
```
🔴 Pod evicted due to node pressure
Reason: MemoryPressure on node worker-2

Recommendations:
✅ Add resource requests to prevent eviction
✅ Check node resource usage
✅ Consider cluster autoscaling
```

### Advanced Diagnostics

**Network Issues:**
- Service not found
- DNS resolution failures
- Network policy blocks

**Storage Problems:**
- PVC not bound
- StorageClass missing
- Insufficient disk space

**Configuration Errors:**
- Missing ConfigMaps/Secrets
- Invalid YAML syntax
- Resource conflicts

### Future: AI-Powered

Integration with LLMs for:
- Natural language troubleshooting
- Historical issue correlation
- Cluster-wide pattern analysis
- Predictive failure detection

---

## 5. Cost Dashboard

### Overview

Track resource usage and costs across namespaces, deployments, and users.

### Commands

```
/cost daily
/cost weekly
/cost monthly
/cost deployment:api namespace:prod
/cost namespace:production
/cost user:@username
```

### Metrics

**By Namespace:**
```
Namespace: production
CPU: 12.5 cores ($30/day)
Memory: 48Gi ($24/day)
Storage: 500Gi ($15/day)
Total: $69/day
```

**By Deployment:**
```
Deployment: api (3 replicas)
CPU: 1.5 cores/replica
Memory: 2Gi/replica
Estimated cost: $12/day
```

**By User:**
```
User: @alice
Namespaces: 2
Total pods: 15
CPU: 4 cores ($10/day)
Memory: 16Gi ($8/day)
```

### Integrations

**KubeCost API:**
Accurate cloud provider costs (AWS, GCP, Azure)

**Metrics Server:**
Resource usage tracking

**Custom Pricing:**
```
/cost config cpu_per_core_hour:0.05
/cost config memory_per_gb_hour:0.01
/cost config storage_per_gb_month:0.10
```

### Alerts

```
/cost alert type:budget threshold:100 period:daily
```

DM when daily budget exceeded.

### Export

```
/cost export format:csv period:last_30_days
```

CSV with per-resource breakdown for billing.

---

## 6. Interactive Deployment Rollouts

### Overview

Monitor deployments in real-time with live updates and easy rollback.

### Commands

```
/deploy rollout status deployment:api namespace:prod
/deploy rollout pause deployment:api
/deploy rollout resume deployment:api
/deploy rollout undo deployment:api
/deploy rollout history deployment:api
```

### Real-Time Updates

When rolling out:
```
🔄 Rollout in progress...

Replicas: 3/5 updated
Available: 2/5
Unavailable: 1

Events:
✅ Scaled up replica set api-v2 to 3
⏳ Waiting for new pods to be ready
✅ Pod api-v2-abc ready
```

Updates every 5 seconds until complete.

### Rollback

```
/deploy rollout undo deployment:api
```

Confirmation:
```
⚠️ Rollback deployment 'api'?

Current version: v2.1.0 (revision 5)
Previous version: v2.0.9 (revision 4)

Changes will be reverted to:
- Image: myapp:v2.0.9
- Replicas: 5
- Environment: production config

[Confirm] [Cancel]
```

### History

```
/deploy rollout history deployment:api
```

Shows:
```
Revision 5: v2.1.0 (current) - deployed 2h ago
Revision 4: v2.0.9 - deployed 1d ago
Revision 3: v2.0.8 - deployed 3d ago (rolled back)
Revision 2: v2.0.7 - deployed 5d ago
```

### Canary Deployments

```
/deploy canary deployment:api image:myapp:v2.2.0 percentage:20
```

Routes 20% traffic to new version, monitors, then promotes or rolls back.

---

## 7. GitOps Integration

### Overview

Manage ArgoCD and Flux applications directly from Discord.

### ArgoCD Commands

```
/gitops sync app:frontend
/gitops status app:frontend
/gitops diff app:frontend
/gitops rollback app:frontend revision:123
/gitops list namespace:argocd
```

#### Sync Application

```
/gitops sync app:frontend prune:true
```

Response:
```
🔄 Syncing application 'frontend'...

Status: Synced
Health: Healthy
Revision: abc123
Resources: 5/5 synced

Recent changes:
+ Deployment frontend (updated)
+ Service frontend-svc (unchanged)
```

#### Status Check

```
/gitops status app:api
```

Shows:
```
Application: api
Sync Status: OutOfSync
Health: Progressing
Target Revision: main
Actual Revision: abc123

Out of sync resources:
- Deployment api (desired replicas: 5, actual: 3)
- ConfigMap api-config (modified)
```

#### Diff Preview

```
/gitops diff app:frontend
```

Shows Git → Cluster diff:
```diff
apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 3
- image: frontend:v1.0.0
+ image: frontend:v1.1.0
```

### Flux Commands

```
/flux reconcile source:frontend
/flux status kustomization:apps
/flux suspend helmrelease:database
```

### Auto-Discovery

```
/gitops discover cluster:prod
```

Scans for ArgoCD/Flux installations and registers them.

---

## 8. YAML Management

### Overview

Upload, validate, lint, and apply Kubernetes manifests safely.

### Commands

```
/apply file:deployment.yaml dry_run:true
/apply file:deployment.yaml namespace:prod
/validate file:manifest.yaml
```

### Validation Flow

1. **Parse YAML**: Check syntax
2. **Schema Validation**: Verify K8s resource structure
3. **Dry Run**: Server-side validation
4. **Lint**: Best practices check
5. **Diff**: Show what will change
6. **Apply**: Actually create resources

### Lint Checks

```
⚠️ Linting results for deployment.yaml:

❌ Missing resource limits
   → containers[0].resources.limits not set

❌ No health probes
   → containers[0].livenessProbe not defined
   → containers[0].readinessProbe not defined

⚠️ Using 'latest' tag
   → containers[0].image should use specific version

⚠️ No labels
   → metadata.labels recommended for organization

ℹ️ Missing nodeSelector
   → Consider adding for targeted scheduling
```

### Diff Preview

Before applying:
```diff
Applying to namespace: production

+ apiVersion: apps/v1
+ kind: Deployment
+ metadata:
+   name: new-app
+ spec:
+   replicas: 3

Existing deployment 'api' will be updated:
  spec:
-   replicas: 2
+   replicas: 5
```

### Batch Apply

```
/apply directory:manifests/ recursive:true
```

Applies all YAML files in order.

---

## 9. Secret Management

### Overview

Securely store and apply secrets without exposing values.

### Commands

```
/secret create name:db-creds namespace:prod data:<file>
/secret list namespace:prod
/secret apply name:db-creds namespace:prod
/secret delete name:db-creds
/secret diff name:db-creds file:<new-file>
```

### Create Secret

Upload encrypted data:
```yaml
# secret-data.yaml
database_url: postgresql://user:pass@host:5432/db
api_key: sk_live_abc123
```

Bot encrypts with AES-256-GCM and stores.

### Apply Secret

```
/secret apply name:db-creds namespace:prod
```

Creates Kubernetes secret without showing values:
```
✅ Secret 'db-creds' applied to namespace 'prod'

Keys: database_url, api_key
Type: Opaque
Last updated: 2 minutes ago
```

### Diff Without Values

```
/secret diff name:db-creds file:<updated.yaml>
```

Shows:
```
Keys added: smtp_password
Keys removed: old_api_key
Keys updated: database_url (value changed)

⚠️ Values not shown for security
```

### Rotation

```
/secret rotate name:db-creds namespace:prod
```

Generates new values and updates secret.

---

## 10. Job Runner

### Overview

Execute one-off tasks and ephemeral jobs.

### Commands

```
/job run image:alpine command:"echo hello"
/job run image:postgres:15 command:"pg_dump" args:"-h localhost db"
/job list namespace:prod
/job logs job:migration-123
/job delete job:migration-123
```

### Run Job

```
/job run image:alpine command:"echo hello world" name:test-job
```

Bot creates Job:
```
🚀 Job 'test-job' started

Status: Running
Pod: test-job-abc123
Started: 5 seconds ago

Waiting for completion...
```

Auto-updates when complete:
```
✅ Job 'test-job' completed

Exit code: 0
Duration: 2s

Logs:
hello world
```

### Use Cases

**Database Migration:**
```
/job run image:myapp:latest command:"npm run migrate" namespace:prod
```

**Backup:**
```
/job run image:postgres:15 command:"pg_dump" args:"-h db-host dbname > backup.sql"
```

**Debugging:**
```
/job run image:busybox command:"nslookup" args:"my-service"
```

**Testing:**
```
/job run image:curlimages/curl command:"curl" args:"http://api-service/health"
```

### Advanced

**With Secrets:**
```
/job run image:myapp command:"process" env_from_secret:db-creds
```

**With Volumes:**
```
/job run image:backup command:"backup.sh" volume:data-pvc:/mnt/data
```

**Scheduled (CronJob):**
```
/job schedule cron:"0 2 * * *" image:backup command:"daily-backup.sh"
```

---

## 11. Cluster Snapshots

### Overview

Generate comprehensive cluster state exports for troubleshooting and backups.

### Commands

```
/cluster snapshot cluster:prod description:"Pre-upgrade backup"
/cluster snapshot list cluster:prod
/cluster snapshot download id:abc123
/cluster snapshot restore id:abc123 dry_run:true
```

### Snapshot Contents

```json
{
  "metadata": {
    "cluster": "production",
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.28.0"
  },
  "nodes": [...],
  "namespaces": [...],
  "deployments": [...],
  "services": [...],
  "configmaps": [...],
  "secrets": [...],  // encrypted
  "persistentVolumes": [...],
  "events": [...],
  "metrics": {
    "cpu": {...},
    "memory": {...}
  }
}
```

### Use Cases

**Pre-Upgrade Backup:**
```
/cluster snapshot cluster:prod description:"Before K8s upgrade to 1.29"
```

**Troubleshooting:**
Attach snapshot to GitHub issue for debugging

**Disaster Recovery:**
Restore entire cluster state

**Audit Trail:**
Historical cluster configurations

---

## 12. Alerts & Subscriptions

### Overview

Get DM notifications for cluster events.

### Commands

```
/alert create type:pod-crash namespace:prod
/alert create type:high-cpu threshold:80
/alert list
/alert delete id:abc123
/alert mute id:abc123 duration:1h
```

### Alert Types

**Pod Crash:**
```
🔴 Pod Crash Alert

Pod: api-abc123
Namespace: production
Reason: CrashLoopBackOff
Exit code: 1
Restart count: 5

Last log lines:
Error: Cannot connect to database
    at app.js:42
```

**High CPU:**
```
⚠️ High CPU Alert

Node: worker-2
Current: 85% (threshold: 80%)
Duration: 15 minutes

Top pods:
- api-123: 2.5 cores
- worker-456: 1.8 cores
```

**ImagePullError:**
```
🔴 ImagePullError Alert

Pod: frontend-xyz
Namespace: production
Image: ghcr.io/org/app:v2.0.0
Error: unauthorized

Suggestions:
- Verify image exists
- Check imagePullSecret
```

### Configuration

**Throttling:**
Max 1 alert per resource per 5 minutes

**Quiet Hours:**
```
/alert config quiet_start:22:00 quiet_end:08:00
```

**Severity Levels:**
- CRITICAL: Always notify
- HIGH: Notify during business hours
- MEDIUM: Daily summary
- LOW: Weekly summary

---

## 13. Image Vulnerability Scanning

### Overview

Scan container images for security vulnerabilities.

### Commands

```
/image scan image:nginx:latest
/image scan image:ghcr.io/org/app:v1.2.0 cluster:prod
/image list-vulnerabilities severity:critical
```

### Scan Results

```
🔍 Scanning image: nginx:1.25.0

Vulnerabilities found:
🔴 CRITICAL: 2
🟠 HIGH: 5
🟡 MEDIUM: 12
🔵 LOW: 23

Top vulnerabilities:
CVE-2023-1234 (CRITICAL)
  Package: openssl 1.1.1
  Fix: Upgrade to 1.1.1t
  CVSS: 9.8

CVE-2023-5678 (HIGH)
  Package: curl 7.68.0
  Fix: Upgrade to 7.88.0
  CVSS: 7.5
```

### Integrations

**Trivy:**
Open-source scanner

**Harbor:**
Registry with built-in scanning

**GitHub Container Registry:**
Native vulnerability data

### Auto-Scan

```
/image auto-scan enable cluster:prod
```

Automatically scans all running images daily.

### Policies

```
/policy create type:prevent-critical-vulnerabilities
```

Blocks deployments with critical CVEs.

---

## 14. Cluster Policy Enforcement

### Overview

Prevent insecure configurations with policy validation.

### Commands

```
/policy enable type:require-resource-limits cluster:prod
/policy list cluster:prod
/policy violations cluster:prod
/policy report cluster:prod format:pdf
```

### Available Policies

**Require Resource Limits:**
All containers must have CPU/memory limits

**Require Health Probes:**
Deployments must have liveness/readiness probes

**Prevent Privileged Containers:**
Block containers with `privileged: true`

**Require Read-Only Root Filesystem:**
Enforce `readOnlyRootFilesystem: true`

**Prevent Host Networking:**
Block `hostNetwork: true`

**Prevent Latest Tag:**
Require specific image versions

**Require Non-Root User:**
Enforce `runAsNonRoot: true`

### Enforcement Modes

**Audit:**
Log violations, allow deployment

**Warn:**
Show warning, allow deployment

**Enforce:**
Block deployment

### Violation Reports

```
📋 Policy Violations Report

Cluster: production
Date: 2024-01-15

CRITICAL (2):
- Deployment 'nginx-debug' uses privileged container
- Deployment 'legacy-app' runs as root

HIGH (5):
- Deployment 'api' missing resource limits
- Deployment 'worker' missing health probes
- ...

MEDIUM (12):
- Deployment 'frontend' uses 'latest' tag
- ...
```

### Remediation

```
/policy fix deployment:api violation:missing-limits
```

Generates YAML patch to fix the issue.

---

## 15. Web UI Companion (Roadmap)

### Vision

Optional web interface for users who prefer GUI over Discord.

### Planned Features

**Dashboard:**
- Cluster overview
- Resource usage graphs
- Real-time pod status
- Cost analytics

**Authentication:**
- OAuth login with Discord
- Same permissions as Discord bot
- Session management

**Terminal:**
- Browser-based kubectl exec
- File upload/download
- Copy/paste support
- Split panes for multi-pod debugging

**Logs:**
- Live log streaming
- Search and filter
- Log aggregation
- Export to file

**GitOps:**
- Visual app sync status
- Drag-and-drop YAML upload
- Diff viewer with syntax highlighting
- Git commit history

**Audit:**
- Full command history
- Filter by user/action/date
- Export for compliance
- Suspicious activity detection

### Technology Stack

- **Frontend:** Next.js + React
- **Backend:** Existing Fastify API
- **Real-time:** WebSockets for live updates
- **Charts:** Recharts or Chart.js
- **Terminal:** xterm.js

### Timeline

Phase 1 (Q2 2024): Dashboard + basic pod management
Phase 2 (Q3 2024): Terminal + log viewer
Phase 3 (Q4 2024): Full GitOps integration
Phase 4 (2025): Advanced analytics

---

## Feature Comparison Matrix

| Feature | Discord | Web UI | CLI (kubectl) |
|---------|---------|--------|---------------|
| Pod logs | ✅ | ✅ | ✅ |
| Terminal exec | ✅ | ✅ | ✅ |
| Helm management | ✅ | ✅ | ✅ (helm CLI) |
| Visual dashboards | ❌ | ✅ | ❌ |
| Mobile access | ✅ | ✅ (responsive) | ❌ |
| Team collaboration | ✅ | ✅ | ❌ |
| Notifications | ✅ | ✅ (email) | ❌ |
| Audit logging | ✅ | ✅ | ❌ |
| Accessibility | ✅ | ✅ | ⚠️ |

---

## Contributing

Want to implement these features? See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

Priority features for community contributions:
1. Helm search and install
2. Basic diagnostics engine
3. Job runner
4. Alert system
5. Image scanning

---

**Made with ❤️ by the ClusterCord community**
