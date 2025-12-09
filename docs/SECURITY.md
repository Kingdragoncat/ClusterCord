# Security Documentation

ClusterCord takes security seriously. This document outlines the security model, best practices, and how to report vulnerabilities.

## Security Model

### Overview

ClusterCord implements defense-in-depth with multiple security layers:

1. **Identity & Authentication**: Discord OAuth + Email OTP
2. **Authorization**: Per-user Kubernetes RBAC
3. **Ephemeral Credentials**: Short-lived TokenRequest tokens
4. **Command Validation**: Server-side blacklist enforcement
5. **Network Security**: IP-based access control
6. **Audit Logging**: Complete activity trail

### Threat Model

**Assets Protected:**
- Kubernetes cluster access
- User identity and authentication
- Cluster credentials (kubeconfigs)
- Command execution capabilities

**Threats Considered:**
- Unauthorized cluster access
- Credential theft
- Malicious command execution
- Privilege escalation
- Data exfiltration
- Denial of service

**Out of Scope:**
- Discord account compromise (use 2FA!)
- Underlying Kubernetes vulnerabilities
- Physical access to infrastructure

## Security Features

### 1. Identity Binding

**How it works:**
- Discord User ID mapped to Kubernetes ServiceAccount
- One-to-one relationship enforced
- Mapping encrypted at rest with AES-256-GCM

**Configuration:**
```env
ENCRYPTION_MASTER_KEY=<64-char-hex-string>
```

**Generate secure key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Best practices:**
- Store master key in secrets manager (Vault, AWS Secrets Manager)
- Rotate key periodically (requires re-encryption)
- Never commit keys to version control

### 2. Ephemeral Tokens

**How it works:**
- Uses Kubernetes TokenRequest API
- Tokens valid for 5-10 minutes (configurable)
- Tokens tied to specific ServiceAccount
- Automatically expire, cannot be refreshed

**Configuration:**
```env
SESSION_TTL_SECONDS=600  # 10 minutes
```

**Security benefits:**
- No long-lived credentials
- Limited blast radius if compromised
- Forces re-authentication for long sessions

**Limitations:**
- Maximum session length enforced
- User must re-verify for extended work

### 3. Per-User RBAC

**How it works:**
- Each user gets dedicated ServiceAccount
- ServiceAccount scoped to specific namespace
- Minimal permissions granted via Role

**Default permissions:**
```yaml
apiGroups: [""]
resources: ["pods", "pods/exec", "pods/log"]
verbs: ["get", "list", "watch", "create"]
```

**Customization:**

Edit RBAC templates in `packages/k8s-sdk/src/rbac.ts`:

```typescript
// Grant additional permissions
rules: [
  {
    apiGroups: [''],
    resources: ['pods', 'pods/exec', 'pods/log', 'pods/portforward'],
    verbs: ['get', 'list', 'watch', 'create']
  }
]
```

**Best practices:**
- Use namespace-scoped Roles (not ClusterRoles)
- Grant least privilege required
- Regularly audit RBAC policies
- Remove ServiceAccounts for inactive users

### 4. OTP Verification

**How it works:**
- IP addresses hashed with SHA-256 + salt
- New IP triggers OTP email
- 6-digit code, 5-minute expiry
- Code hashed before storage

**Configuration:**
```env
OTP_TTL_SECONDS=300
IP_SALT=<random-salt>
EMAIL_PROVIDER=smtp
EMAIL_FROM=noreply@example.com
```

**Security benefits:**
- Detects account takeover attempts
- Prevents remote access from new locations
- Creates audit trail of access locations

**User experience:**
- First access from new location requires email check
- Trusted IPs stored for convenience
- Can revoke trust by clearing IP list

**Generate salt:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Command Validation

**How it works:**
- All commands validated server-side
- Blacklist of dangerous patterns
- Rate limiting enforced

**Blocked command categories:**
- Destructive filesystem ops (`rm -rf /`, `dd`, `mkfs`)
- System modifications (`systemctl`, `mount`, `passwd`)
- User management (`useradd`, `usermod`, `passwd`)
- Kernel operations (`modprobe`, `insmod`)
- Escape attempts (`docker`, `kubectl`, `crictl`)
- Obfuscation (`eval`, `base64 decode`)

**Configuration:**
```env
MAX_COMMANDS_PER_MINUTE=30
MAX_OUTPUT_BYTES_PER_MINUTE=1048576  # 1MB
```

**Add custom blacklist:**

Edit `packages/auth/src/command-validator.ts`:

```typescript
commandValidator.addPattern(
  /dangerous-pattern/,
  'Description of why blocked'
);
```

**Bypass (not recommended):**

For trusted users, you can reduce restrictions by modifying the blacklist, but this significantly increases risk.

### 6. Audit Logging

**What's logged:**
- All cluster operations (list, logs, exec)
- OTP generation and verification
- Session start/end events
- Blocked commands
- Failed authentication attempts

**Log format:**
```json
{
  "userId": "uuid",
  "action": "TERMINAL_EXEC",
  "clusterId": "uuid",
  "namespace": "default",
  "podName": "my-pod",
  "command": "ls -la",
  "ipHash": "sha256-hash",
  "timestamp": "2024-01-01T00:00:00Z",
  "metadata": {}
}
```

**Retention:**
- Stored in database indefinitely (configure cleanup)
- Exportable for SIEM integration

**Export logs:**
```
/audit export timeRange:30d
```

**Integration with SIEM:**

Logs can be exported and sent to:
- Splunk
- ELK Stack
- Datadog
- CloudWatch Logs

## Deployment Security

### Environment Variables

**Never commit these to version control:**
- `DISCORD_TOKEN`
- `ENCRYPTION_MASTER_KEY`
- `IP_SALT`
- `JWT_SECRET`
- `EMAIL_PROVIDER_API_KEY`
- Database credentials

**Use secrets management:**
- Kubernetes Secrets
- HashiCorp Vault
- AWS Secrets Manager
- Azure Key Vault

### Network Security

**Recommended setup:**
- Run backend in private network
- Use TLS for all external connections
- Restrict database access to backend only
- Use Discord bot token, never embed in client

**Firewall rules:**
- Backend: Allow only from Discord IPs
- Database: Allow only from backend
- Kubernetes API: mTLS required

### Database Security

**Best practices:**
- Use strong database password
- Enable SSL/TLS for connections
- Regular backups (encrypted at rest)
- Restricted network access
- Regular updates and patching

**Encryption:**
- Kubeconfigs: AES-256-GCM
- Passwords: bcrypt (if storing user passwords)
- Hashes: SHA-256 with salt

### Kubernetes Security

**Cluster hardening:**
- Enable RBAC
- Use Network Policies
- Pod Security Standards (restricted)
- Regular updates
- Audit logging enabled

**ServiceAccount security:**
- `automountServiceAccountToken: false` (for bot pods)
- Minimal permissions for ClusterCord admin SA
- Regular cleanup of unused SAs

## Security Best Practices

### For Self-Hosters

1. **Change all default secrets**
2. **Use strong passwords** (20+ chars, random)
3. **Enable 2FA** on Discord accounts
4. **Regular updates** - watch for security releases
5. **Monitor audit logs** - set up alerts
6. **Backup securely** - encrypt backups
7. **Test disaster recovery** - practice restores
8. **Principle of least privilege** - only grant needed access
9. **Network segmentation** - isolate components
10. **Security scanning** - use Snyk, Trivy, etc.

### For Users

1. **Enable Discord 2FA**
2. **Use strong email password**
3. **Don't share Discord account**
4. **Review trusted IPs regularly**
5. **Report suspicious activity**
6. **Use `/terminal kill` when done**
7. **Don't execute untrusted commands**
8. **Verify email OTP codes**

### For Developers

1. **Never log secrets**
2. **Validate all inputs**
3. **Use parameterized queries**
4. **Sanitize outputs**
5. **Handle errors securely**
6. **Review dependencies** - `npm audit`
7. **Code reviews** for security changes
8. **Security testing** - SAST, DAST
9. **Follow OWASP guidelines**

## Incident Response

### If Credentials Are Compromised

1. **Rotate immediately:**
   ```bash
   # Generate new encryption key
   NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

   # Update environment variable
   kubectl set env deployment/clustercord-backend ENCRYPTION_MASTER_KEY=$NEW_KEY
   ```

2. **Revoke all active sessions**
3. **Force user re-authentication**
4. **Review audit logs** for suspicious activity
5. **Notify affected users**

### If Cluster Access is Compromised

1. **Revoke ServiceAccount tokens:**
   ```bash
   kubectl delete sa clustercord-user-* -n <namespace>
   ```

2. **Remove RoleBindings:**
   ```bash
   kubectl delete rolebinding -l app.kubernetes.io/managed-by=clustercord -n <namespace>
   ```

3. **Review cluster audit logs**
4. **Investigate extent of access**
5. **Rotate cluster credentials if needed**

### If Database is Compromised

1. **Isolate database** (network policies)
2. **Change database password**
3. **Review data access logs**
4. **Assess data exfiltration**
5. **Notify users if PII compromised**
6. **Consider master key rotation**

## Vulnerability Reporting

**Found a security issue?**

**DO NOT** open a public GitHub issue.

Instead, email: **security@clustercord.example.com**

Include:
- Description of vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will:
- Acknowledge within 48 hours
- Provide regular updates
- Credit you in security advisory (if desired)
- Coordinate responsible disclosure

**Bug bounty:** Not currently available

## Security Audits

**Last audit:** Not yet conducted

**Planned audits:**
- Code review by security firm (planned)
- Penetration testing (planned)
- Dependency scanning (automated via Snyk)

**Third-party dependencies:**

We rely on:
- `@kubernetes/client-node` - Official K8s client
- `discord.js` - Official Discord API wrapper
- `fastify` - Mature, security-focused web framework
- `prisma` - Type-safe ORM with SQL injection protection

All dependencies are regularly updated and scanned.

## Compliance

**Relevant standards:**
- CIS Kubernetes Benchmark
- OWASP Top 10
- NIST Cybersecurity Framework

**Not certified for:**
- SOC 2
- ISO 27001
- HIPAA
- PCI DSS

(Self-hosting allows you to implement additional controls as needed)

## Security Checklist

Before going to production:

- [ ] All secrets rotated from defaults
- [ ] HTTPS/TLS enabled
- [ ] Database encrypted at rest
- [ ] Backups configured and tested
- [ ] Monitoring and alerting set up
- [ ] Audit log retention configured
- [ ] Incident response plan documented
- [ ] Security contacts identified
- [ ] Regular update schedule established
- [ ] Dependency scanning automated
- [ ] Network policies enforced
- [ ] RBAC policies reviewed
- [ ] User documentation provided

## Resources

- [Kubernetes Security Best Practices](https://kubernetes.io/docs/concepts/security/security-checklist/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks/)
- [Discord Security](https://discord.com/safety/360043653552-Account-Security-Tips)

---

**Last updated:** 2024-01-01
**Version:** 1.0

For questions, contact: security@clustercord.example.com
