# ClusterCord - Kubernetes Management via Discord

A comprehensive Kubernetes management platform for Discord with full GitOps support, Helm chart management, and production-grade security features.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-14-blue)](https://discord.js.org/)

---

## Features

### Core Functionality

- **Multi-Cluster Management** - Connect and manage multiple Kubernetes clusters
- **GitOps Integration** - Native ArgoCD and Flux support with auto-detection
- **Helm Chart Management** - Search, install, upgrade, and rollback charts from ArtifactHub
- **Terminal Access** - Interactive pod shell sessions with recording capabilities
- **Resource Operations** - Manage pods, deployments, and other Kubernetes resources
- **Security** - Encrypted kubeconfigs, automatic secret redaction, approval workflows

### GitOps Support

- Auto-detect ArgoCD or Flux installations
- Sync applications and kustomizations
- Detect configuration drift
- Force reconciliation
- Application status monitoring

### Helm Integration

- Search 10,000+ charts on ArtifactHub
- Install charts with custom values
- Upgrade and rollback releases
- View release history and values
- Interactive Discord UI

### Advanced Features

- **Resource Optimization** - Analyze waste and get cost estimates
- **Deployment Tracking** - Monitor success rates and deployment analytics
- **Chaos Engineering** - Built-in chaos experiments (pod kill, network issues, stress tests)
- **Homelab Templates** - Pre-configured deployments (Minecraft, Plex, GitLab, Monitoring, PostgreSQL)
- **Smart Error Explanation** - Contextual troubleshooting for common Kubernetes errors
- **Terminal Recording** - Record and replay terminal sessions

### Security Features

- AES-256-GCM encryption for sensitive data
- Automatic redaction of secrets (AWS keys, tokens, passwords, etc.)
- Per-command approval workflows
- Rate limiting
- Complete audit logging
- OTP verification for new devices

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Discord Bot Token ([Create one here](https://discord.com/developers/applications))
- Kubernetes cluster with kubeconfig

### Installation

```bash
# Clone and install
git clone https://github.com/yourusername/clustercord.git
cd clustercord
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Setup database
npm run db:migrate
npm run db:seed

# Start development
npm run dev
```

### Configuration

Edit `.env`:

```env
# Discord
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/clustercord

# Security keys (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_MASTER_KEY=your_key_here
IP_SALT=your_salt_here
JWT_SECRET=your_secret_here
```

---

## Usage

### Basic Commands

```bash
# Cluster management
/cluster add name:prod kubeconfig:<file>
/cluster list

# Pod operations
/pod list cluster:prod namespace:default
/pod logs cluster:prod namespace:default pod:app-123
/terminal start cluster:prod namespace:default pod:app-123

# Helm
/helm search query:nginx
/helm install cluster:prod release:web chart:bitnami/nginx namespace:default
/helm upgrade cluster:prod release:web chart:bitnami/nginx version:15.0.0
/helm rollback cluster:prod release:web namespace:default revision:2

# GitOps
/gitops detect cluster:prod
/gitops list cluster:prod type:ArgoCD
/gitops sync cluster:prod type:ArgoCD name:app namespace:default
/gitops diff cluster:prod name:app namespace:argocd
```

---

## Architecture

```
Discord ↔ Bot (discord.js) ↔ Backend (Fastify) ↔ PostgreSQL
                                      ↓
                            Kubernetes Clusters
```

**Stack:**
- Backend: Fastify + Prisma + TypeScript
- Bot: discord.js 14
- Database: PostgreSQL
- K8s Client: @kubernetes/client-node

---

## Project Structure

```
apps/
├── backend/          # Fastify API server
│   ├── src/
│   │   ├── routes/   # API endpoints
│   │   ├── services/ # Business logic
│   │   └── middleware/
│   └── prisma/       # Database schema
└── bot/              # Discord bot
    └── src/
        ├── commands/ # Slash commands
        └── events/   # Event handlers

packages/
├── k8s-sdk/          # Kubernetes client wrapper
├── auth/             # Security utilities
└── ui/               # Discord components

docs/                 # Documentation
```

---

## Development

### Commands

```bash
# Development
npm run dev              # Start both backend and bot
npm run dev:bot          # Bot only
npm run dev:backend      # Backend only

# Build
npm run build

# Database
npm run db:migrate       # Run migrations
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed with templates

# Testing
npm test
npm run lint
```

### Testing with Kind

```bash
kind create cluster --name test
kind get kubeconfig --name test > kubeconfig.yaml
# Upload kubeconfig.yaml via /cluster add
```

---

## Documentation

- **[docs/SETUP.md](docs/SETUP.md)** - Detailed setup guide
- **[docs/GITOPS_INTEGRATION.md](docs/GITOPS_INTEGRATION.md)** - GitOps usage
- **[docs/HELM_GUIDE.md](docs/HELM_GUIDE.md)** - Helm management
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT License - see [LICENSE](LICENSE)

---

## Credits

Built with:
- [discord.js](https://discord.js.org/)
- [Fastify](https://www.fastify.io/)
- [@kubernetes/client-node](https://github.com/kubernetes-client/javascript)
- [Prisma](https://www.prisma.io/)
- [TypeScript](https://www.typescriptlang.org/)
