# Command Reference

Complete reference for all ClusterCord Discord slash commands.

## Table of Contents

- [Cluster Management](#cluster-management)
- [Pod Operations](#pod-operations)
- [Terminal Sessions](#terminal-sessions)
- [Audit & Administration](#audit--administration)

---

## Cluster Management

### `/cluster add`

Add a new Kubernetes cluster to ClusterCord.

**Parameters:**
- `name` (required): Unique name for the cluster
- `kubeconfig` (required): Kubeconfig file (attachment)

**Example:**
```
/cluster add name:production kubeconfig:<upload-file>
```

**Permissions:** All users

**Notes:**
- Cluster connection is tested before saving
- Kubeconfig is encrypted at rest
- Only you can access clusters you add

---

### `/cluster list`

List all clusters you've added.

**Parameters:** None

**Example:**
```
/cluster list
```

**Output:** Paginated embed showing:
- Cluster name
- API endpoint
- Date added

---

### `/cluster status`

Get current status of a cluster.

**Parameters:**
- `name` (required): Cluster name

**Example:**
```
/cluster status name:production
```

**Output:** Embed showing:
- Connection status
- Kubernetes version
- API endpoint

---

### `/cluster remove`

Remove a cluster from ClusterCord.

**Parameters:**
- `name` (required): Cluster name

**Example:**
```
/cluster remove name:staging
```

**Warning:** This will revoke all active sessions on this cluster.

---

## Pod Operations

### `/pod list`

List all pods in a namespace.

**Parameters:**
- `cluster` (required): Cluster name
- `namespace` (required): Kubernetes namespace

**Example:**
```
/pod list cluster:production namespace:default
```

**Output:** Embed showing:
- Pod name
- Status (Running, Pending, Failed)
- Restart count

**Pagination:** Shows 10 pods per page

---

### `/pod logs`

Retrieve logs from a pod.

**Parameters:**
- `cluster` (required): Cluster name
- `namespace` (required): Kubernetes namespace
- `pod` (required): Pod name
- `tail` (optional): Number of lines to show (default: 100)
- `container` (optional): Container name (if multiple)

**Example:**
```
/pod logs cluster:production namespace:default pod:nginx-123 tail:50
```

**Output:** Code block with log lines

**Notes:**
- Large logs are paginated
- Maximum 1000 lines returned
- Use `tail` to limit output

---

### `/pod describe`

Get detailed information about a pod.

**Parameters:**
- `cluster` (required): Cluster name
- `namespace` (required): Kubernetes namespace
- `pod` (required): Pod name

**Example:**
```
/pod describe cluster:production namespace:default pod:nginx-123
```

**Output:** Embed showing:
- Status
- Node assignment
- IP address
- Container states
- Events

---

## Terminal Sessions

### `/terminal exec`

Start an interactive terminal session in a pod.

**Parameters:**
- `cluster` (required): Cluster name
- `namespace` (required): Kubernetes namespace
- `pod` (required): Pod name
- `container` (optional): Container name (if multiple)
- `shell` (optional): Shell to use (default: `/bin/sh`)
  - Choices: `/bin/sh`, `/bin/bash`, `/bin/zsh`

**Example:**
```
/terminal exec cluster:production namespace:default pod:nginx-123 shell:/bin/bash
```

**Flow:**

1. **New IP Detection:**
   - If accessing from new location, OTP is sent to email
   - Verify with `/terminal verify code:<code>`

2. **Session Start:**
   - DM is opened with terminal interface
   - Session ID provided
   - Expires in 10 minutes (configurable)

3. **Using Terminal:**
   - Type commands in DM
   - Output streamed back
   - All commands logged

**Security:**
- Ephemeral token (10 min TTL)
- Command blacklist enforced
- Rate limiting: 30 commands/min
- Full audit trail

**Example session:**
```
🖥️ Terminal Session Active

Pod: nginx-123
Namespace: default
Container: nginx
Expires In: 9m 45s

⚠️ Security Notice: All commands are logged and validated.

$ ls -la
total 12
drwxr-xr-x 1 root root 4096 Jan  1 00:00 .
drwxr-xr-x 1 root root 4096 Jan  1 00:00 ..
-rw-r--r-- 1 root root  612 Jan  1 00:00 index.html

$ pwd
/usr/share/nginx/html

$ exit
Session ended.
```

---

### `/terminal verify`

Verify OTP code for new location.

**Parameters:**
- `code` (required): 6-digit verification code from email

**Example:**
```
/terminal verify code:123456
```

**When needed:**
- First access from new IP address
- After IP trust list is cleared
- After long period of inactivity

**Notes:**
- Code expires in 5 minutes
- Check spam folder if not received
- Each code is single-use

---

### `/terminal kill`

Terminate an active terminal session.

**Parameters:**
- `session` (required): Session ID

**Example:**
```
/terminal kill session:abc123-def456
```

**When to use:**
- Session no longer needed
- Suspicious activity detected
- Emergency revocation

**Notes:**
- Immediately terminates connection
- Audit log entry created
- Cannot be reversed

---

## Audit & Administration

### `/audit export`

Export audit logs for your activity.

**Parameters:**
- `timerange` (optional): Time range to export
  - Choices: `24h`, `7d`, `30d`, `all`
  - Default: `24h`

**Example:**
```
/audit export timerange:7d
```

**Output:** JSON file with:
- Action performed
- Timestamp
- Cluster/namespace/pod
- Command executed (if applicable)
- IP hash
- Result/status

**Use cases:**
- Compliance reporting
- Security investigation
- Activity review

---

## Command Shortcuts

### Quick Reference Table

| Task | Command |
|------|---------|
| Add cluster | `/cluster add` |
| Check cluster status | `/cluster status` |
| View pods | `/pod list` |
| Check pod logs | `/pod logs` |
| Get pod details | `/pod describe` |
| Start terminal | `/terminal exec` |
| Verify OTP | `/terminal verify` |
| End session | `/terminal kill` |
| Export logs | `/audit export` |

---

## Tips & Best Practices

### Efficient Workflow

1. **Add cluster once:**
   ```
   /cluster add name:prod kubeconfig:<file>
   ```

2. **Explore pods:**
   ```
   /pod list cluster:prod namespace:default
   /pod describe cluster:prod namespace:default pod:app-123
   ```

3. **Debug with logs:**
   ```
   /pod logs cluster:prod namespace:default pod:app-123 tail:100
   ```

4. **Interactive debugging:**
   ```
   /terminal exec cluster:prod namespace:default pod:app-123
   ```

5. **Clean up:**
   ```
   /terminal kill session:xyz
   ```

### Security Tips

- ✅ Use specific namespaces (not `default`)
- ✅ Enable Discord 2FA
- ✅ Verify OTP emails are legitimate
- ✅ Kill sessions when done
- ✅ Review audit logs regularly
- ❌ Don't share session IDs
- ❌ Don't execute unknown commands
- ❌ Don't ignore OTP prompts

### Troubleshooting

**"Cluster not found"**
- Check cluster name with `/cluster list`
- Verify you added the cluster

**"Pod not found"**
- Check pod name with `/pod list`
- Verify namespace is correct
- Pod may have been deleted

**"Session expired"**
- Sessions last 10 minutes
- Start new session with `/terminal exec`

**"OTP verification failed"**
- Check code carefully (6 digits)
- Code expires after 5 minutes
- Request new code if needed

**"Command blocked"**
- Command matched security blacklist
- See [SECURITY.md](SECURITY.md) for details
- Contact admin if legitimate use case

---

## Advanced Usage

### Working with Multiple Containers

If a pod has multiple containers:

```
/terminal exec cluster:prod namespace:default pod:app-123 container:sidecar
```

### Namespace Patterns

Common namespaces:
- `default` - Default namespace
- `kube-system` - Kubernetes system components
- `production` - Production apps
- `staging` - Staging environment

### Shell Selection

Choose appropriate shell:
- `/bin/sh` - Universal, always available
- `/bin/bash` - Feature-rich, common
- `/bin/zsh` - Advanced features

---

## Limitations

**Current limitations:**
- Max 10 minute session duration
- 30 commands per minute rate limit
- 1MB output per minute
- Single user per session
- No file upload/download (coming soon)
- No port forwarding (coming soon)

**Planned features:**
- Session extension
- File transfer
- Helm management
- Resource creation
- GitOps triggers

---

## Getting Help

- 📖 [Full Documentation](../README.md)
- 🔒 [Security Guide](SECURITY.md)
- 💬 [Discord Server](https://discord.gg/clustercord)
- 🐛 [Report Issues](https://github.com/your-org/clustercord/issues)

---

**Last updated:** 2024-01-01
**Version:** 1.0
