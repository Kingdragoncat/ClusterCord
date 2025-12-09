# Helm Chart Management Guide

Complete guide to managing Helm charts with ClusterCord via Discord and REST API.

---

## Table of Contents

1. [Overview](#overview)
2. [Discord Commands](#discord-commands)
3. [REST API Reference](#rest-api-reference)
4. [Common Workflows](#common-workflows)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

---

## Overview

ClusterCord provides complete Helm chart lifecycle management:

- **Chart Discovery**: Search 10,000+ charts on ArtifactHub
- **Installation**: Deploy charts with custom values
- **Upgrades**: Update releases to new versions
- **Rollbacks**: Revert to previous revisions
- **Management**: List releases, view values, check history
- **Cleanup**: Uninstall releases with optional history retention

### Features

- Native Helm CLI integration
- ArtifactHub search integration
- Custom values file support
- Revision history tracking
- Interactive Discord embeds with action buttons
- Full REST API for automation

---

## Discord Commands

All Helm operations are available via the `/helm` slash command.

### Search Charts

Search ArtifactHub for Helm charts:

```bash
/helm search query:prometheus limit:10
```

**Parameters:**
- `query` (required): Search query (chart name, keyword, etc.)
- `limit` (optional): Number of results (default: 20, max: 50)

**Example Output:**
```
🔍 Helm Chart Search Results

Found 10 charts matching "prometheus"

📦 prometheus
Version: 25.3.1 | App: v2.48.1
Repository: prometheus-community
Description: Prometheus monitoring system and time series database

📦 kube-prometheus-stack
Version: 55.5.0 | App: v0.70.0
Repository: prometheus-community
Description: Complete Prometheus monitoring stack with Grafana
```

---

### List Releases

List all Helm releases in a namespace or cluster:

```bash
/helm list cluster:prod-cluster namespace:monitoring
/helm list cluster:prod-cluster                      # All namespaces
```

**Parameters:**
- `cluster` (required): Cluster ID or name
- `namespace` (optional): Specific namespace (omit for all)

**Example Output:**
```
📦 Helm Releases

Cluster: prod-cluster
Namespace: monitoring

✅ prometheus
Chart: prometheus-25.3.1 | App: v2.48.1
Status: deployed | Revision: 3
Updated: 2025-01-15 14:30:22

✅ grafana
Chart: grafana-7.0.8 | App: 10.2.3
Status: deployed | Revision: 1
Updated: 2025-01-14 10:15:00

Total: 2 releases
```

---

### Get Release Status

Get detailed status of a specific release:

```bash
/helm status cluster:prod-cluster release:prometheus namespace:monitoring
```

**Parameters:**
- `cluster` (required): Cluster ID or name
- `release` (required): Release name
- `namespace` (required): Release namespace

**Example Output:**
```
📦 Helm Release: prometheus

Status: ✅ deployed
Namespace: monitoring
Chart: prometheus-25.3.1
App Version: v2.48.1
Revision: 3
Last Updated: 2025-01-15 14:30:22

[View Values] [View History] [Upgrade] [Rollback] [Uninstall]
```

Interactive buttons provide quick access to common operations.

---

### Install Chart

Install a new Helm chart:

```bash
/helm install cluster:prod-cluster release:my-prometheus chart:prometheus-community/prometheus namespace:monitoring
```

**Parameters:**
- `cluster` (required): Cluster ID or name
- `release` (required): Name for the release
- `chart` (required): Chart name (repo/chart or URL)
- `namespace` (required): Target namespace
- `values` (optional): Custom values (YAML format)
- `create-namespace` (optional): Create namespace if missing (default: true)

**Example with Custom Values:**
```bash
/helm install cluster:prod-cluster release:my-app chart:bitnami/nginx namespace:web values:
replicaCount: 3
resources:
  limits:
    cpu: 500m
    memory: 512Mi
```

**Example Output:**
```
✅ Helm Chart Installed

Release: my-prometheus
Chart: prometheus-community/prometheus
Namespace: monitoring
Revision: 1
Status: deployed

The chart has been successfully deployed to your cluster.
```

---

### Upgrade Release

Upgrade an existing release to a new version:

```bash
/helm upgrade cluster:prod-cluster release:prometheus chart:prometheus-community/prometheus namespace:monitoring version:25.4.0
```

**Parameters:**
- `cluster` (required): Cluster ID or name
- `release` (required): Release name
- `chart` (required): Chart name
- `namespace` (required): Release namespace
- `version` (optional): Specific chart version
- `values` (optional): Custom values (YAML format)

**Example Output:**
```
✅ Helm Release Upgraded

Release: prometheus
Chart: prometheus-community/prometheus
Version: 25.4.0
Namespace: monitoring
New Revision: 4
Status: deployed

The release has been successfully upgraded.
Previous revision: 3
```

---

### Rollback Release

Rollback a release to a previous revision:

```bash
/helm rollback cluster:prod-cluster release:prometheus namespace:monitoring revision:3
/helm rollback cluster:prod-cluster release:prometheus namespace:monitoring    # Previous revision
```

**Parameters:**
- `cluster` (required): Cluster ID or name
- `release` (required): Release name
- `namespace` (required): Release namespace
- `revision` (optional): Target revision (default: previous)

**Example Output:**
```
🔄 Helm Release Rolled Back

Release: prometheus
Namespace: monitoring
Rolled back to revision: 3
Current revision: 5
Status: deployed

The release has been successfully rolled back.
```

---

### Uninstall Release

Uninstall a Helm release:

```bash
/helm uninstall cluster:prod-cluster release:old-app namespace:default keep-history:false
```

**Parameters:**
- `cluster` (required): Cluster ID or name
- `release` (required): Release name
- `namespace` (required): Release namespace
- `keep-history` (optional): Keep release history (default: false)

**Example Output:**
```
🗑️ Helm Release Uninstalled

Release: old-app
Namespace: default
History retained: No

The release has been successfully uninstalled and removed from the cluster.
```

---

### View Release Values

View current values for a release:

```bash
/helm values cluster:prod-cluster release:prometheus namespace:monitoring
```

**Parameters:**
- `cluster` (required): Cluster ID or name
- `release` (required): Release name
- `namespace` (required): Release namespace

**Example Output:**
```yaml
📋 Helm Release Values

Release: prometheus
Namespace: monitoring

replicaCount: 2
image:
  repository: quay.io/prometheus/prometheus
  tag: v2.48.1
resources:
  limits:
    cpu: 1000m
    memory: 2Gi
  requests:
    cpu: 500m
    memory: 1Gi
persistence:
  enabled: true
  size: 50Gi
```

---

### View Release History

View revision history for a release:

```bash
/helm history cluster:prod-cluster release:prometheus namespace:monitoring
```

**Parameters:**
- `cluster` (required): Cluster ID or name
- `release` (required): Release name
- `namespace` (required): Release namespace

**Example Output:**
```
📜 Helm Release History

Release: prometheus
Namespace: monitoring

Revision 5 - 2025-01-15 16:45:00
Status: superseded
Description: Upgrade complete

Revision 4 - 2025-01-15 14:30:00
Status: superseded
Description: Upgrade complete

Revision 3 - 2025-01-14 10:00:00
Status: deployed
Description: Rollback to 3

Revision 2 - 2025-01-13 15:20:00
Status: superseded
Description: Upgrade complete

Revision 1 - 2025-01-12 09:00:00
Status: superseded
Description: Install complete
```

---

## REST API Reference

### Search Charts

```http
GET /api/helm/search?query=prometheus&limit=20
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "name": "prometheus",
      "version": "25.3.1",
      "appVersion": "v2.48.1",
      "description": "Prometheus monitoring system",
      "url": "https://prometheus-community.github.io/helm-charts",
      "repository": "prometheus-community"
    }
  ],
  "count": 10
}
```

---

### List Releases

```http
GET /api/helm/releases?clusterId=abc123&namespace=monitoring
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "releases": [
    {
      "name": "prometheus",
      "namespace": "monitoring",
      "revision": "3",
      "updated": "2025-01-15T14:30:22Z",
      "status": "deployed",
      "chart": "prometheus-25.3.1",
      "appVersion": "v2.48.1"
    }
  ],
  "count": 1
}
```

---

### Get Release Status

```http
GET /api/helm/releases/prometheus?clusterId=abc123&namespace=monitoring
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "release": {
    "name": "prometheus",
    "namespace": "monitoring",
    "revision": "3",
    "updated": "2025-01-15T14:30:22Z",
    "status": "deployed",
    "chart": "prometheus-25.3.1",
    "appVersion": "v2.48.1"
  }
}
```

---

### Install Chart

```http
POST /api/helm/install
Authorization: Bearer <token>
Content-Type: application/json

{
  "clusterId": "abc123",
  "releaseName": "my-prometheus",
  "chart": "prometheus-community/prometheus",
  "namespace": "monitoring",
  "values": {
    "replicaCount": 2
  },
  "createNamespace": true
}
```

**Response:**
```json
{
  "success": true,
  "revision": "1"
}
```

---

### Upgrade Release

```http
PUT /api/helm/upgrade
Authorization: Bearer <token>
Content-Type: application/json

{
  "clusterId": "abc123",
  "releaseName": "prometheus",
  "chart": "prometheus-community/prometheus",
  "namespace": "monitoring",
  "version": "25.4.0",
  "values": {
    "replicaCount": 3
  }
}
```

**Response:**
```json
{
  "success": true,
  "revision": "4"
}
```

---

### Rollback Release

```http
POST /api/helm/rollback
Authorization: Bearer <token>
Content-Type: application/json

{
  "clusterId": "abc123",
  "releaseName": "prometheus",
  "namespace": "monitoring",
  "revision": 3
}
```

**Response:**
```json
{
  "success": true,
  "revision": "5"
}
```

---

### Uninstall Release

```http
DELETE /api/helm/releases/prometheus
Authorization: Bearer <token>
Content-Type: application/json

{
  "clusterId": "abc123",
  "namespace": "monitoring",
  "keepHistory": false
}
```

**Response:**
```json
{
  "success": true
}
```

---

### Get Release Values

```http
GET /api/helm/releases/prometheus/values?clusterId=abc123&namespace=monitoring
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "values": {
    "replicaCount": 2,
    "image": {
      "repository": "quay.io/prometheus/prometheus",
      "tag": "v2.48.1"
    }
  }
}
```

---

### Get Release History

```http
GET /api/helm/releases/prometheus/history?clusterId=abc123&namespace=monitoring
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "revision": 5,
      "updated": "2025-01-15T16:45:00Z",
      "status": "deployed",
      "description": "Upgrade complete"
    },
    {
      "revision": 4,
      "updated": "2025-01-15T14:30:00Z",
      "status": "superseded",
      "description": "Upgrade complete"
    }
  ]
}
```

---

## Common Workflows

### Deploy a New Application

1. **Search for chart:**
```bash
/helm search query:nginx
```

2. **Install chart:**
```bash
/helm install cluster:prod release:my-nginx chart:bitnami/nginx namespace:web
```

3. **Check status:**
```bash
/helm status cluster:prod release:my-nginx namespace:web
```

---

### Upgrade Production Application

1. **Check current version:**
```bash
/helm list cluster:prod namespace:production
```

2. **Upgrade to new version:**
```bash
/helm upgrade cluster:prod release:api chart:myrepo/api namespace:production version:2.0.0
```

3. **Verify upgrade:**
```bash
/helm status cluster:prod release:api namespace:production
```

4. **If issues, rollback:**
```bash
/helm rollback cluster:prod release:api namespace:production
```

---

### Customize Values

**Method 1: Inline values (simple)**
```bash
/helm install cluster:prod release:app chart:repo/app namespace:default values:
replicaCount: 3
```

**Method 2: Complex values**
```bash
/helm install cluster:prod release:app chart:repo/app namespace:default values:
replicaCount: 3
image:
  tag: v2.0.0
resources:
  limits:
    cpu: 1000m
    memory: 1Gi
```

---

### Manage Multiple Environments

**Development:**
```bash
/helm install cluster:dev release:app chart:myrepo/app namespace:dev values:
replicaCount: 1
resources:
  limits:
    cpu: 200m
```

**Staging:**
```bash
/helm install cluster:staging release:app chart:myrepo/app namespace:staging values:
replicaCount: 2
resources:
  limits:
    cpu: 500m
```

**Production:**
```bash
/helm install cluster:prod release:app chart:myrepo/app namespace:production values:
replicaCount: 5
resources:
  limits:
    cpu: 2000m
```

---

## Best Practices

### Chart Selection

- Search ArtifactHub for official charts first
- Check chart popularity and maintenance status
- Review chart documentation before installing
- Use specific versions in production (avoid `latest`)

### Values Management

- Keep values files in Git (GitOps)
- Use different values per environment
- Never commit secrets to values files
- Use Kubernetes Secrets or external secrets managers

### Releases

- Use meaningful release names (e.g., `prod-api`, `staging-web`)
- Follow naming conventions across environments
- Document customizations in values files
- Use namespaces to organize releases

### Upgrades

- Test upgrades in dev/staging first
- Review release notes before upgrading
- Always check current values before upgrading
- Have rollback plan ready
- Monitor application after upgrade

### Rollbacks

- Know your last working revision
- Test rollback procedure in non-prod first
- Document rollback steps for critical apps
- Keep release history for important deployments

### Cleanup

- Remove unused releases to save resources
- Use `keep-history` for critical applications
- Document uninstall procedures
- Check for orphaned resources after uninstall

---

## Troubleshooting

### Chart Not Found

**Error:** `Chart "myrepo/mychart" not found`

**Solution:**
1. Verify chart name with search:
```bash
/helm search query:mychart
```

2. Ensure Helm repository is added on server
3. Check chart name spelling

---

### Release Already Exists

**Error:** `Release "myapp" already exists`

**Solution:**
1. List existing releases:
```bash
/helm list cluster:prod namespace:default
```

2. Either use different release name or uninstall existing:
```bash
/helm uninstall cluster:prod release:myapp namespace:default
```

---

### Namespace Not Found

**Error:** `Namespace "production" not found`

**Solution:**
Use `create-namespace:true` parameter:
```bash
/helm install cluster:prod release:app chart:repo/app namespace:production create-namespace:true
```

---

### Values Format Error

**Error:** `Failed to parse values`

**Solution:**
Ensure proper YAML formatting:
```yaml
# Correct
replicaCount: 3
image:
  tag: v2.0.0

# Incorrect
replicaCount:3
image: {tag:v2.0.0}
```

---

### Failed Upgrade

**Error:** `Upgrade failed`

**Solution:**
1. Check release status:
```bash
/helm status cluster:prod release:app namespace:default
```

2. View history to find last working revision:
```bash
/helm history cluster:prod release:app namespace:default
```

3. Rollback to working revision:
```bash
/helm rollback cluster:prod release:app namespace:default revision:3
```

---

### Insufficient Permissions

**Error:** `User cannot create resource in namespace`

**Solution:**
1. Verify cluster RBAC permissions
2. Check service account permissions
3. Ensure ClusterCord has appropriate cluster role

---

## Advanced Features

### Custom Chart Repositories

Helm service supports custom chart repositories. Contact administrator to add:

```bash
helm repo add myrepo https://charts.example.com
helm repo update
```

Then use in Discord:
```bash
/helm install cluster:prod release:app chart:myrepo/app namespace:default
```

---

### Integration with GitOps

Helm works seamlessly with ArgoCD and Flux:

1. **Install with Helm:**
```bash
/helm install cluster:prod release:app chart:myrepo/app namespace:default
```

2. **Manage with GitOps:**
```bash
/gitops sync cluster:prod type:ArgoCD name:app namespace:default
```

---

### CI/CD Integration

Use REST API in CI/CD pipelines:

```bash
# GitHub Actions example
- name: Deploy with Helm
  run: |
    curl -X POST https://api.clustercord.com/api/helm/install \
      -H "Authorization: Bearer ${{ secrets.CLUSTERCORD_TOKEN }}" \
      -H "Content-Type: application/json" \
      -d '{
        "clusterId": "prod",
        "releaseName": "api",
        "chart": "myrepo/api",
        "namespace": "production",
        "values": {"tag": "${{ github.sha }}"}
      }'
```

---

## Security Considerations

- All Helm operations require authentication
- Cluster ownership is verified for all operations
- Rate limiting applied to prevent abuse
- Kubeconfig files stored securely and cleaned up
- Values files with secrets are encrypted in transit
- Audit logs track all Helm operations

---

## Support

For issues or questions:
- Use `/help category:helm` in Discord
- Check [GitHub Issues](https://github.com/yourusername/clustercord)
- Read [main documentation](../README.md)

---

**Helm Manager - Complete Kubernetes package management from Discord** 🚀
