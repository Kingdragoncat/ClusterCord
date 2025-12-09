# 🚀 ClusterCord Production Deployment Checklist

This checklist ensures a smooth, secure production deployment of ClusterCord.

---

## ✅ Pre-Deployment Checklist

### 1. Environment Setup

- [ ] **Node.js 18+** installed
- [ ] **PostgreSQL 14+** provisioned (or cloud database ready)
- [ ] **Discord Bot** created and configured
  - [ ] Bot token obtained
  - [ ] Client ID obtained
  - [ ] Bot invited to server with proper permissions
  - [ ] Slash commands deployed
- [ ] **Domain name** configured (optional but recommended)
- [ ] **SSL/TLS certificates** obtained (for HTTPS)

### 2. Security Configuration

- [ ] **Encryption keys** generated (32 random bytes each):
  ```bash
  node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
  node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] **Database password** is strong (min 16 chars, mixed case, numbers, symbols)
- [ ] **Environment variables** stored securely (not in source control)
- [ ] **Firewall rules** configured:
  - Port 3000 (backend) - internal only
  - Port 5432 (PostgreSQL) - internal only
  - Port 443 (HTTPS) - public (if exposing API)
- [ ] **Rate limiting** configured appropriately for production load

### 3. Database Setup

- [ ] PostgreSQL database created
- [ ] Database user created with appropriate permissions
- [ ] Connection string tested
- [ ] SSL enabled for database connections (if cloud-hosted)
- [ ] Backup strategy in place
  - [ ] Automated daily backups
  - [ ] Backup retention policy (30+ days recommended)
  - [ ] Backup restoration tested

### 4. Code Preparation

- [ ] Latest stable version pulled from repository
- [ ] Dependencies installed: `npm install`
- [ ] Environment variables configured in `.env`
- [ ] Database migrations run: `npm run db:migrate`
- [ ] Database seeded: `npm run db:seed`
- [ ] Application built: `npm run build`
- [ ] Tests passing: `npm test`

---

## 🔧 Environment Variables

Create a `.env` file with the following (DO NOT commit this file):

```env
# Node Environment
NODE_ENV=production
LOG_LEVEL=info

# Backend API
PORT=3000
HOST=0.0.0.0
CORS_ORIGIN=https://your-domain.com

# Database
DATABASE_URL=postgresql://user:password@host:5432/clustercord?sslmode=require

# Discord
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-client-id
DISCORD_GUILD_ID=your-guild-id

# Security
ENCRYPTION_KEY=your-32-byte-hex-key
JWT_SECRET=your-32-byte-hex-key

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=ClusterCord <noreply@your-domain.com>

# Optional: Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Optional: Session
SESSION_TIMEOUT_MINUTES=10

# Optional: Recording
RECORDING_MAX_DURATION_SECONDS=3600
RECORDING_MAX_SIZE_BYTES=10485760
```

---

## 🐳 Deployment Options

### Option 1: Docker Compose (Recommended)

1. **Build images:**
   ```bash
   docker-compose -f docker-compose.prod.yml build
   ```

2. **Start services:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Check logs:**
   ```bash
   docker-compose -f docker-compose.prod.yml logs -f
   ```

4. **Health check:**
   ```bash
   curl http://localhost:3000/health
   ```

### Option 2: PM2 Process Manager

1. **Install PM2:**
   ```bash
   npm install -g pm2
   ```

2. **Create ecosystem file** (`ecosystem.config.js`):
   ```javascript
   module.exports = {
     apps: [
       {
         name: 'clustercord-backend',
         script: 'apps/backend/dist/index.js',
         instances: 2,
         exec_mode: 'cluster',
         env: {
           NODE_ENV: 'production'
         }
       },
       {
         name: 'clustercord-bot',
         script: 'apps/bot/dist/index.js',
         instances: 1,
         env: {
           NODE_ENV: 'production'
         }
       }
     ]
   };
   ```

3. **Start with PM2:**
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

4. **Monitor:**
   ```bash
   pm2 monit
   pm2 logs
   ```

### Option 3: Kubernetes Deployment

See `infra/k8s/` for Kubernetes manifests or use Helm chart:

```bash
helm install clustercord ./infra/helm/clustercord \
  --set discord.token=$DISCORD_BOT_TOKEN \
  --set discord.clientId=$DISCORD_CLIENT_ID \
  --set database.url=$DATABASE_URL \
  --set encryption.key=$ENCRYPTION_KEY
```

### Option 4: Systemd Service

1. **Create service files:**

`/etc/systemd/system/clustercord-backend.service`:
```ini
[Unit]
Description=ClusterCord Backend API
After=network.target postgresql.service

[Service]
Type=simple
User=clustercord
WorkingDirectory=/opt/clustercord
Environment=NODE_ENV=production
EnvironmentFile=/opt/clustercord/.env
ExecStart=/usr/bin/node apps/backend/dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/clustercord-bot.service`:
```ini
[Unit]
Description=ClusterCord Discord Bot
After=network.target clustercord-backend.service

[Service]
Type=simple
User=clustercord
WorkingDirectory=/opt/clustercord
Environment=NODE_ENV=production
EnvironmentFile=/opt/clustercord/.env
ExecStart=/usr/bin/node apps/bot/dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

2. **Enable and start:**
   ```bash
   sudo systemctl enable clustercord-backend
   sudo systemctl enable clustercord-bot
   sudo systemctl start clustercord-backend
   sudo systemctl start clustercord-bot
   ```

3. **Check status:**
   ```bash
   sudo systemctl status clustercord-backend
   sudo systemctl status clustercord-bot
   ```

---

## 🔒 Post-Deployment Security

### 1. Verify Security Settings

- [ ] **HTTPS enabled** (if exposing API publicly)
- [ ] **Database connections encrypted** (SSL/TLS)
- [ ] **Secrets not logged** (check application logs)
- [ ] **Rate limiting working** (test with rapid requests)
- [ ] **OTP system working** (test new IP verification)
- [ ] **Approval flow working** (test dangerous commands)

### 2. Monitoring Setup

- [ ] **Application logs** centralized (Loki, CloudWatch, etc.)
- [ ] **Error tracking** configured (Sentry, Rollbar, etc.)
- [ ] **Uptime monitoring** (UptimeRobot, Pingdom, etc.)
- [ ] **Database monitoring** (query performance, connections)
- [ ] **Disk space monitoring** (especially for recordings)

### 3. Alerts Configuration

- [ ] **Critical errors** alert immediately
- [ ] **High CPU/memory** usage alerts
- [ ] **Database connection** failures alert
- [ ] **Disk space** warnings (< 20% free)
- [ ] **Failed login attempts** (potential security issue)

---

## 📊 Performance Optimization

### 1. Database Optimization

- [ ] **Connection pooling** configured (Prisma handles this)
- [ ] **Indexes created** on frequently queried fields
- [ ] **Query performance** analyzed (slow query log)
- [ ] **Database vacuuming** scheduled (PostgreSQL VACUUM)

### 2. Application Optimization

- [ ] **Clustering enabled** (multiple backend instances)
- [ ] **Caching layer** considered (Redis for sessions)
- [ ] **Static assets** served via CDN (if applicable)
- [ ] **Gzip compression** enabled

### 3. Kubernetes Cluster Access

- [ ] **Kubeconfig tokens** short-lived (use TokenRequest API)
- [ ] **Cluster connection pooling** optimized
- [ ] **API request batching** where possible

---

## 🧪 Testing Production Deployment

### 1. Smoke Tests

```bash
# Health check
curl https://your-domain.com/health

# Discord bot is online
# Check Discord - bot should show as online

# Test basic command
# In Discord: /cluster list
```

### 2. Load Testing (Optional)

```bash
# Install artillery
npm install -g artillery

# Run load test
artillery quick --count 100 --num 10 https://your-domain.com/health
```

### 3. Security Testing

- [ ] **Penetration testing** (OWASP Top 10)
- [ ] **SQL injection** attempts blocked
- [ ] **XSS attempts** sanitized
- [ ] **CSRF protection** working
- [ ] **Rate limiting** prevents DoS

---

## 📈 Scaling Considerations

### Horizontal Scaling

- [ ] **Backend**: Run multiple instances behind load balancer
- [ ] **Bot**: Single instance only (Discord limitation)
- [ ] **Database**: Read replicas for read-heavy workloads
- [ ] **Redis**: For distributed session storage (optional)

### Vertical Scaling

- [ ] **CPU**: 2-4 cores recommended
- [ ] **Memory**: 2-4 GB minimum, 8 GB recommended
- [ ] **Disk**: 20 GB minimum, more for recordings
- [ ] **Network**: 100 Mbps minimum

---

## 🔄 Maintenance Tasks

### Daily
- [ ] Check application logs for errors
- [ ] Monitor disk space usage
- [ ] Review rate limit violations

### Weekly
- [ ] Review audit logs
- [ ] Check database performance
- [ ] Update dependencies (patch versions)

### Monthly
- [ ] Security updates (minor versions)
- [ ] Database backups tested
- [ ] Performance review
- [ ] Cost optimization review

### Quarterly
- [ ] Major version updates
- [ ] Security audit
- [ ] Disaster recovery drill
- [ ] Documentation update

---

## 🚨 Disaster Recovery

### Backup Strategy

1. **Database**: Daily automated backups, 30-day retention
2. **Configuration**: `.env` backed up securely
3. **User data**: Export audit logs monthly

### Recovery Procedures

1. **Database failure**:
   ```bash
   # Restore from latest backup
   pg_restore -h localhost -U postgres -d clustercord backup.dump
   ```

2. **Application crash**:
   ```bash
   # Restart services
   pm2 restart all
   # or
   systemctl restart clustercord-backend
   systemctl restart clustercord-bot
   ```

3. **Complete system failure**:
   - Provision new infrastructure
   - Restore database from backup
   - Deploy application from source
   - Update DNS (if needed)
   - Verify functionality

---

## 📞 Support & Troubleshooting

### Common Issues

**Bot not responding:**
- Check bot is online in Discord
- Verify slash commands deployed: `npm run deploy-commands --workspace=apps/bot`
- Check logs for errors

**Database connection errors:**
- Verify DATABASE_URL is correct
- Check PostgreSQL is running
- Test connection: `psql $DATABASE_URL`

**High memory usage:**
- Check for memory leaks (terminal sessions not closed)
- Review connection pooling settings
- Consider adding more RAM or scaling horizontally

### Getting Help

- **GitHub Issues**: Report bugs
- **GitHub Discussions**: Ask questions
- **Discord Support**: Real-time help
- **Email**: security@clustercord.dev (security issues only)

---

## ✅ Final Checklist

Before going live:

- [ ] All tests passing
- [ ] Security audit completed
- [ ] Backups configured and tested
- [ ] Monitoring and alerts set up
- [ ] Documentation updated
- [ ] Team trained on operations
- [ ] Disaster recovery plan documented
- [ ] Performance benchmarks established
- [ ] Cost budget approved
- [ ] Legal/compliance review (if required)

---

## 🎉 Deployment Complete!

Congratulations! ClusterCord is now running in production. 🚀

Remember to:
- Monitor logs regularly
- Keep dependencies updated
- Review security practices
- Scale as needed
- Document all changes

**Happy clustering!** 🎯
