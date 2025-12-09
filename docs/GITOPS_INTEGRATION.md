# 🔄 GitOps Integration Guide

ClusterCord provides **full native integration** with **ArgoCD** and **Flux CD**, allowing you to manage GitOps deployments directly from Discord.

---

## 🌟 Features

### ArgoCD Integration
- ✅ **Auto-detection** - Automatically detect ArgoCD installation
- ✅ **Application listing** - View all ArgoCD applications
- ✅ **Sync status** - Check sync and health status
- ✅ **Manual sync** - Trigger syncs with optional prune
- ✅ **Drift detection** - See resources out of sync with Git
- ✅ **Suspend/Resume** - Control automatic syncing
- ✅ **Real-time updates** - Monitor sync progress

### Flux CD Integration
- ✅ **Auto-detection** - Automatically detect Flux installation
- ✅ **Kustomization status** - Check Kustomization resources
- ✅ **HelmRelease status** - Monitor Helm deployments via Flux
- ✅ **Force reconcile** - Trigger immediate reconciliation
- ✅ **Source tracking** - View Git repository details
- ✅ **Condition monitoring** - Track Flux conditions

---

## 🚀 Quick Start

### 1. Install GitOps Platform

#### ArgoCD
```bash
# Create namespace
kubectl create namespace argocd

# Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Access UI (optional)
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

#### Flux
```bash
# Install Flux CLI
curl -s https://fluxcd.io/install.sh | sudo bash

# Bootstrap Flux
flux bootstrap github \
  --owner=YOUR_GITHUB_USERNAME \
  --repository=fleet-infra \
  --branch=main \
  --path=./clusters/my-cluster \
  --personal
```

### 2. Auto-Detect Platform

```bash
# In Discord
/gitops detect cluster:my-cluster
```

ClusterCord will automatically detect which GitOps platform you're running!

---

## 💬 Discord Commands

### Detect GitOps Platform
```bash
/gitops detect cluster:prod

# Response:
🔍 GitOps Detection
Detected GitOps Type: 🦊 ArgoCD

Your cluster is running ArgoCD! You can now use GitOps commands.
```

### List Applications
```bash
/gitops list cluster:prod type:ArgoCD

# or for Flux
/gitops list cluster:prod type:Flux namespace:flux-system
```

**Output:**
```
🦊 ARGOCD Applications
Found 5 applications

✅ guestbook
Namespace: default
Sync: Synced
Health: 💚 Healthy

⚠️ backend-api
Namespace: production
Sync: OutOfSync
Health: 🟡 Progressing
```

### Check Application Status
```bash
/gitops status cluster:prod type:ArgoCD name:guestbook namespace:default
```

**Output:**
```
🦊 guestbook
Namespace: default

✅ Sync Status: Synced
💚 Health Status: Healthy
📦 Synced Revision: abc123
🎯 Target Revision: HEAD
🕐 Last Synced: 2024-12-07 10:30 AM

📋 Conditions
• SyncSucceeded: True - Sync succeeded
```

### Sync Application
```bash
# Basic sync
/gitops sync cluster:prod type:ArgoCD name:guestbook namespace:default

# Sync with prune (remove resources not in Git)
/gitops sync cluster:prod type:ArgoCD name:guestbook namespace:default prune:true
```

**For Flux:**
```bash
/gitops sync cluster:prod type:Flux name:podinfo namespace:flux-system
```

### Detect Drift
```bash
/gitops diff cluster:prod name:guestbook namespace:argocd
```

**Output:**
```
📊 Drift Detection: guestbook
⚠️ Drift detected - Cluster state differs from Git

Resources (5 total)
✅ Deployment/guestbook-ui (default)
⚠️ Service/guestbook (default)
✅ ConfigMap/app-config (default)
⚠️ Ingress/guestbook (default)
```

---

## 🎯 Use Cases

### 1. Monitor Production Deployments
```bash
# Check all apps
/gitops list cluster:prod type:ArgoCD

# Check specific critical app
/gitops status cluster:prod type:ArgoCD name:backend-api namespace:production
```

### 2. Emergency Rollback
```bash
# Check drift
/gitops diff cluster:prod name:backend-api namespace:argocd

# If needed, sync to restore Git state
/gitops sync cluster:prod type:ArgoCD name:backend-api namespace:argocd prune:true
```

### 3. Deploy New Version
```bash
# 1. Push changes to Git repository
# 2. Trigger sync from Discord
/gitops sync cluster:prod type:ArgoCD name:backend-api namespace:argocd

# 3. Monitor status
/gitops status cluster:prod type:ArgoCD name:backend-api namespace:argocd
```

### 4. Multi-Environment Sync
```bash
# Sync dev
/gitops sync cluster:dev type:ArgoCD name:myapp namespace:default

# Verify in staging
/gitops status cluster:staging type:ArgoCD name:myapp namespace:default

# Promote to production
/gitops sync cluster:prod type:ArgoCD name:myapp namespace:default
```

---

## 🔧 API Endpoints

### GET /api/gitops/detect
Detect GitOps platform type

**Query Parameters:**
- `clusterId` - Cluster ID

**Response:**
```json
{
  "success": true,
  "gitopsType": "ARGOCD",
  "detected": true
}
```

### GET /api/gitops/apps
List all GitOps applications

**Query Parameters:**
- `clusterId` - Cluster ID
- `type` - ARGOCD or FLUX
- `namespace` - Optional namespace

**Response:**
```json
{
  "success": true,
  "apps": [
    {
      "name": "guestbook",
      "namespace": "default",
      "syncStatus": "Synced",
      "healthStatus": "Healthy"
    }
  ],
  "count": 1
}
```

### GET /api/gitops/status
Get application sync status

**Query Parameters:**
- `clusterId` - Cluster ID
- `type` - ARGOCD or FLUX
- `name` - Application name
- `namespace` - Namespace

**Response:**
```json
{
  "success": true,
  "status": {
    "status": "Synced",
    "health": "Healthy",
    "syncedRevision": "abc123",
    "targetRevision": "HEAD",
    "lastSyncedAt": "2024-12-07T10:30:00Z",
    "conditions": [...]
  }
}
```

### POST /api/gitops/sync
Trigger application sync

**Body:**
```json
{
  "clusterId": "cluster-id",
  "type": "ARGOCD",
  "name": "guestbook",
  "namespace": "default",
  "prune": false,
  "dryRun": false
}
```

### GET /api/gitops/diff
Detect drift (ArgoCD only)

**Query Parameters:**
- `clusterId` - Cluster ID
- `name` - Application name
- `namespace` - Namespace

**Response:**
```json
{
  "success": true,
  "diff": {
    "drifted": true,
    "resources": [
      {
        "group": "apps",
        "kind": "Deployment",
        "name": "guestbook",
        "namespace": "default",
        "status": "OutOfSync",
        "message": "Replicas differ: 3 (Git) vs 5 (Cluster)"
      }
    ]
  }
}
```

---

## 🔐 Security

### RBAC Requirements

ClusterCord needs appropriate permissions to interact with GitOps CRDs:

#### ArgoCD
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: clustercord-argocd
rules:
  - apiGroups: ["argoproj.io"]
    resources: ["applications"]
    verbs: ["get", "list", "watch", "patch"]
```

#### Flux
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: clustercord-flux
rules:
  - apiGroups: ["kustomize.toolkit.fluxcd.io"]
    resources: ["kustomizations"]
    verbs: ["get", "list", "watch", "patch"]
  - apiGroups: ["helm.toolkit.fluxcd.io"]
    resources: ["helmreleases"]
    verbs: ["get", "list", "watch", "patch"]
  - apiGroups: ["source.toolkit.fluxcd.io"]
    resources: ["gitrepositories", "helmrepositories"]
    verbs: ["get", "list", "watch"]
```

### Approval Flow

Dangerous operations (sync with prune, suspend) require approval:

```bash
/gitops sync cluster:prod type:ArgoCD name:backend-api prune:true

# ClusterCord responds:
⚠️ This is a HIGH priority operation requiring approval
Operation: Sync with prune enabled
Target: backend-api (production)
Risk: Resources not in Git will be deleted

[Approve] [Reject] [Cancel]
Expires in: 4m 58s
```

---

## 📊 Monitoring & Alerts

### Discord Notifications

Configure alerts for GitOps events:

```bash
/alerts subscribe type:gitops-sync-failed cluster:prod

# You'll receive DMs when syncs fail:
❌ GitOps Sync Failed
Application: backend-api
Cluster: production
Error: Failed to apply manifest: connection refused
```

### Health Checks

Automatically monitor application health:

```bash
/gitops list cluster:prod type:ArgoCD

# Shows real-time health status
✅ app1 - Healthy
⚠️ app2 - Progressing
❌ app3 - Degraded
```

---

## 🎨 Integration Examples

### ArgoCD Application Manifest
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: guestbook
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: HEAD
    path: guestbook
  destination:
    server: https://kubernetes.default.svc
    namespace: default
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

**Manage from Discord:**
```bash
/gitops status cluster:prod type:ArgoCD name:guestbook namespace:argocd
/gitops sync cluster:prod type:ArgoCD name:guestbook namespace:argocd
```

### Flux Kustomization
```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: podinfo
  namespace: flux-system
spec:
  interval: 5m
  path: ./kustomize
  prune: true
  sourceRef:
    kind: GitRepository
    name: podinfo
```

**Manage from Discord:**
```bash
/gitops status cluster:prod type:Flux name:podinfo namespace:flux-system
/gitops sync cluster:prod type:Flux name:podinfo namespace:flux-system
```

---

## 🚀 Best Practices

### 1. Use Separate Clusters for Dev/Prod
```bash
/gitops sync cluster:dev type:ArgoCD name:myapp  # Test first
/gitops status cluster:dev type:ArgoCD name:myapp  # Verify
/gitops sync cluster:prod type:ArgoCD name:myapp  # Then production
```

### 2. Monitor Sync Status Regularly
```bash
# Daily health check
/gitops list cluster:prod type:ArgoCD

# Investigate issues immediately
/gitops status cluster:prod type:ArgoCD name:failing-app
/gitops diff cluster:prod name:failing-app
```

### 3. Use Prune Carefully
```bash
# Without prune (safer)
/gitops sync cluster:prod type:ArgoCD name:myapp prune:false

# With prune (removes extra resources)
/gitops sync cluster:prod type:ArgoCD name:myapp prune:true  # Requires approval!
```

### 4. Enable Auto-Detection
```bash
# Run once per cluster to cache GitOps type
/gitops detect cluster:prod
/gitops detect cluster:staging
/gitops detect cluster:dev
```

---

## 🎉 Summary

ClusterCord's GitOps integration provides:

- ✅ **Seamless Discord integration** for ArgoCD and Flux
- ✅ **Auto-detection** of GitOps platforms
- ✅ **Real-time sync status** and health monitoring
- ✅ **Drift detection** to catch manual changes
- ✅ **Approval flows** for dangerous operations
- ✅ **Multi-cluster support** for dev/staging/prod
- ✅ **Comprehensive API** for custom integrations

**Manage your entire GitOps workflow from Discord!** 🚀

---

*For more information, see:*
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [Flux Documentation](https://fluxcd.io/docs/)
- [ClusterCord Setup Guide](../SETUP.md)
