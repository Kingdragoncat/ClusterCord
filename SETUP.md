# ClusterCord - Complete Setup Guide

## 🚀 Quick Start (5 Minutes)

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+
- Discord Bot Token
- Kubernetes cluster with kubeconfig

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
```

Edit `.env` and set:
```bash
# Required
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DATABASE_URL=postgresql://user:password@localhost:5432/clustercord
ENCRYPTION_MASTER_KEY=$(openssl rand -hex 32)
IP_SALT=$(openssl rand -hex 32)

# Email (for OTP)
EMAIL_PROVIDER=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
EMAIL_FROM=ClusterCord <noreply@example.com>
```

### 3. Database Setup

```bash
# Run Prisma migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate
```

### 4. Start Services

```bash
# Option 1: Docker Compose (recommended)
docker-compose up -d

# Option 2: Manual
npm run dev
```

## 📦 What's Included

### Core Features
✅ **Cluster Management** - Add/remove clusters via Discord
✅ **Pod Operations** - List, logs, describe pods
✅ **Live Terminal** - Secure, ephemeral shell access
✅ **OTP Authentication** - Location-based 2FA
✅ **Command Blacklist** - Prevent dangerous operations
✅ **Audit Logging** - Complete activity trail

### Advanced Features
✅ **Terminal Recording** - Capture & replay sessions
✅ **Homelab Templates** - One-click deployments (Minecraft, Plex, GitLab, etc.)
✅ **Namespace Isolation** - Multi-guild cluster sharing
✅ **Chaos Engineering** - Litmus/ChaosMesh integration
✅ **RBAC Visualizer** - Graph generation (SVG/PDF)
✅ **Cluster SSO** - Discord OAuth for kubectl
✅ **Plugin System** - Extensible architecture

## 🎮 Discord Commands

### Cluster Management
```
/cluster add name:prod kubeconfig:[file]
/cluster list
/cluster status name:prod
/cluster remove name:prod
```

### Pod Operations
```
/pod list cluster:prod namespace:default
/pod logs cluster:prod namespace:default pod:web-123
/pod describe cluster:prod namespace:default pod:web-123
```

### Terminal Access
```
/terminal exec cluster:prod namespace:default pod:web-123
/terminal verify code:123456
/terminal kill session:abc123
```

### Templates
```
/template list
/template list category:GAMING
/template deploy template:Minecraft cluster:prod namespace:minecraft
/template info template:Plex
```

### Recordings
```
/recording list
/recording playback id:abc123
/recording export id:abc123 format:html
/recording delete id:abc123
/recording stats
```

## 🔧 Configuration

### Security Settings
```bash
# OTP Settings
OTP_TTL_SECONDS=300  # 5 minutes

# Session Settings
SESSION_TTL_SECONDS=600  # 10 minutes
MAX_COMMANDS_PER_MINUTE=30

# Recording Settings
TERMINAL_RECORDING_ENABLED=true
RECORDING_RETENTION_DAYS=30
```

### Feature Flags
```bash
ENABLE_TERMINAL=true
ENABLE_HELM_MANAGER=false
ENABLE_GITOPS=false
```

## 🏗️ Architecture

```
ClusterCord/
├── apps/
│   ├── backend/          # Fastify API server
│   │   ├── src/
│   │   │   ├── routes/   # API endpoints
│   │   │   ├── services/ # Business logic
│   │   │   ├── middleware/ # Auth, rate limiting, validation
│   │   │   └── utils/    # Helper functions
│   │   └── prisma/       # Database schema
│   └── bot/              # Discord bot
│       └── src/
│           ├── commands/ # Slash commands
│           └── events/   # Event handlers
├── packages/
│   ├── k8s-sdk/         # Kubernetes client wrapper
│   ├── auth/            # Security utilities
│   └── ui/              # Discord embeds
└── docs/                 # Documentation
```

## 🔐 Security

### Authentication Flow
1. User initiates terminal session
2. IP address is hashed and checked
3. If new location → OTP sent via email
4. User verifies OTP code
5. ServiceAccount + RBAC created
6. Ephemeral token issued (10 min TTL)
7. Commands validated against blacklist
8. All activity audit logged

### Encryption
- **Kubeconfigs**: AES-256-GCM encryption at rest
- **IP Addresses**: SHA-256 hashing (salted)
- **Secrets**: Auto-redacted in recordings
- **Tokens**: Ephemeral (TokenRequest API)

## 📊 API Endpoints

### Clusters
- `POST /api/clusters` - Add cluster
- `GET /api/clusters` - List clusters
- `GET /api/clusters/:name/status` - Get status
- `DELETE /api/clusters/:name` - Remove cluster

### Terminal
- `POST /api/terminal/start` - Start session
- `POST /api/terminal/verify` - Verify OTP
- `POST /api/terminal/exec` - Execute command
- `POST /api/terminal/kill` - Kill session

### Recordings
- `GET /api/recordings/:id` - Get recording
- `GET /api/recordings/search` - Search recordings
- `GET /api/recordings/:id/playback` - Playback data
- `GET /api/recordings/:id/export` - Export recording
- `DELETE /api/recordings/:id` - Delete recording

### Templates
- `GET /api/templates` - List templates
- `GET /api/templates/:id` - Get template
- `POST /api/templates/:id/deploy` - Deploy template
- `POST /api/templates/init` - Initialize built-in templates

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Type check
npm run typecheck
```

## 🐳 Docker Deployment

```bash
# Build images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📝 Database Management

```bash
# Create migration
npm run db:migrate:create

# Apply migrations
npm run db:migrate

# Reset database
npm run db:reset

# Studio (GUI)
npm run db:studio
```

## 🔄 Updates

```bash
# Pull latest code
git pull

# Install dependencies
npm install

# Run migrations
npm run db:migrate

# Restart services
docker-compose restart
```

## 🐛 Troubleshooting

### Bot not responding
- Check `DISCORD_TOKEN` is valid
- Verify bot has necessary permissions
- Check bot is online in Discord Developer Portal

### Database connection failed
- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check firewall rules

### OTP emails not sending
- Check `EMAIL_PROVIDER` settings
- Verify SMTP server is accessible
- Test with MailHog (included in docker-compose)

### Terminal session fails
- Verify kubeconfig is valid
- Check ServiceAccount permissions
- Ensure cluster is reachable

## 📚 Documentation

- [Terminal Recording Guide](docs/TERMINAL_RECORDING.md)
- [Security Documentation](docs/SECURITY.md)
- [Feature Implementation Status](FEATURES_IMPLEMENTATION_STATUS.md)
- [Complete Feature List](COMPLETE_FEATURE_LIST.md)

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🆘 Support

- GitHub Issues: https://github.com/yourusername/clustercord/issues
- Discord Server: https://discord.gg/yourserver
- Documentation: https://clustercord.dev

---

**Made with ❤️ for the homelab community**
