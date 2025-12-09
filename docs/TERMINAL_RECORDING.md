# Terminal Recording & Playback

ClusterCord automatically records all terminal sessions for compliance, auditing, and debugging purposes. This comprehensive guide covers everything about the terminal recording system.

## Overview

Every terminal session executed through ClusterCord is automatically recorded with:
- **Full command history** - All commands typed by users
- **Complete output** - All stdout and stderr output
- **Timestamps** - Precise timing for playback
- **Metadata** - Pod, namespace, cluster, user information
- **Auto-redaction** - Sensitive information automatically masked
- **Multiple export formats** - JSON, HTML, TTY, Asciinema

## Features

### 1. Automatic Recording

Recording happens transparently without user intervention:

```typescript
// Recording starts automatically when terminal session begins
/terminal exec cluster:prod namespace:default pod:web-pod

// All commands are captured
ls -la
cat /app/config.json
kubectl get pods

// Recording stops when session ends
/terminal kill session:abc123
```

### 2. Secret Redaction

Sensitive information is automatically redacted using pattern matching:

**Redacted patterns:**
- Passwords: `password: ******`
- Tokens: `token: ******`
- API Keys: `api-key: ******`
- Private Keys: RSA/SSH keys automatically masked
- Bearer tokens: `Bearer ******`

**Example:**
```bash
# Input
echo "password: mysecret123"

# Recorded as
echo "password: ***********"
```

### 3. Playback

Replay terminal sessions with timing intact:

```bash
/recording playback id:abc123 speed:1.0
```

**Playback options:**
- `speed`: 0.5x, 1x, 2x, 4x playback speed
- Frames displayed in Discord with timing delays
- Full output replayed as it happened

### 4. Export Formats

Export recordings in multiple formats for different use cases:

#### JSON Format
```bash
/recording export id:abc123 format:json
```

**Use cases:**
- Programmatic analysis
- Integration with SIEM systems
- Custom tooling

**Structure:**
```json
{
  "version": "1.0.0",
  "metadata": {
    "startTime": 1704067200000,
    "endTime": 1704067800000,
    "width": 80,
    "height": 24,
    "env": { "TERM": "xterm-256color", "SHELL": "/bin/bash" }
  },
  "frames": [
    { "timestamp": 0, "type": "input", "data": "ls -la\n" },
    { "timestamp": 100, "type": "output", "data": "total 48\n..." },
    { "timestamp": 5000, "type": "input", "data": "exit\n" }
  ]
}
```

#### HTML Format (Interactive)
```bash
/recording export id:abc123 format:html
```

**Features:**
- Browser-based playback
- Play/pause/reset controls
- Adjustable speed (0.5x - 4x)
- Progress bar
- Color-coded output (input, output, error, system)
- No dependencies required

**Use cases:**
- Share with team members
- Compliance documentation
- Training materials
- Issue reproduction

#### TTY Format (Plain Text)
```bash
/recording export id:abc123 format:tty
```

**Features:**
- Raw terminal output
- No metadata or timing
- Plain text format
- Ideal for grep/search

**Use cases:**
- Quick log review
- Text search
- Piping to other tools

#### Asciinema Format
```bash
/recording export id:abc123 format:asciicast
```

**Features:**
- Industry-standard format
- Play with asciinema player
- Upload to asciinema.org
- Embed in websites

**Use cases:**
- Blog posts / documentation
- Public sharing
- Professional presentations

## Discord Commands

### List Recordings

```bash
/recording list
/recording list cluster:prod
/recording list namespace:default
/recording list cluster:prod namespace:default limit:20
```

**Response:**
```
📹 Terminal Recordings

1. prod-cluster / web-pod-123
   ID: abc123-def456
   Namespace: default
   Duration: 5m 30s
   Commands: 12
   Date: 2024-01-01 12:00:00
   Size: 45.2 KB

2. staging-cluster / api-pod-456
   ...
```

### Playback Recording

```bash
/recording playback id:abc123
/recording playback id:abc123 speed:2.0
```

**Features:**
- Real-time replay in Discord
- Adjustable speed
- Automatic chunking for long sessions
- Color-coded output

### Export Recording

```bash
/recording export id:abc123
/recording export id:abc123 format:html
/recording export id:abc123 format:asciicast
```

**Response:**
- File attachment with recording
- Formatted appropriately for type
- Immediate download

### Delete Recording

```bash
/recording delete id:abc123
```

**Confirmation:**
```
🗑️ Recording Deleted
Successfully deleted recording abc123-def456
```

### View Statistics

```bash
/recording stats
```

**Response:**
```
📊 Recording Statistics

Total Recordings: 45
Total Duration: 2h 15m
Average Duration: 3m 0s
Total Storage: 12.4 MB
```

## API Endpoints

### Get Recording

```http
GET /api/recordings/:id
```

**Response:**
```json
{
  "id": "abc123",
  "sessionId": "session-123",
  "userId": "user-123",
  "clusterId": "cluster-123",
  "podName": "web-pod",
  "namespace": "default",
  "duration": 330,
  "commandCount": 12,
  "size": 45200,
  "createdAt": "2024-01-01T12:00:00Z",
  "expiresAt": "2024-02-01T12:00:00Z",
  "user": { "discordId": "123456" },
  "cluster": { "name": "prod-cluster" }
}
```

### Search Recordings

```http
GET /api/recordings/search?userId=user123&clusterId=cluster123&limit=10
```

**Query params:**
- `userId` - Filter by user
- `clusterId` - Filter by cluster
- `namespace` - Filter by namespace
- `podName` - Filter by pod
- `fromDate` - Start date (ISO 8601)
- `toDate` - End date (ISO 8601)
- `minDuration` - Minimum duration (seconds)
- `maxDuration` - Maximum duration (seconds)
- `limit` - Maximum results (default: 50, max: 50)

### Playback Recording

```http
GET /api/recordings/:id/playback?speed=1.0&maxFrames=1000
```

**Query params:**
- `speed` - Playback speed multiplier
- `maxFrames` - Limit number of frames
- `startTime` - Start timestamp (ms)
- `endTime` - End timestamp (ms)

**Response:**
```json
{
  "metadata": { "startTime": 1704067200000, ... },
  "frames": [
    { "timestamp": 0, "type": "input", "data": "ls\n" },
    ...
  ]
}
```

### Export Recording

```http
GET /api/recordings/:id/export?format=html&compress=false
```

**Query params:**
- `format` - Export format (json, tty, html, asciicast)
- `includeMetadata` - Include metadata (default: true)
- `compress` - Gzip compression (default: false)

**Response:**
- Content-Type set appropriately
- Content-Disposition for download
- Compressed if requested

### Delete Recording

```http
DELETE /api/recordings/:id?userId=user123
```

**Query params:**
- `userId` - User ID for authorization

### Get Statistics

```http
GET /api/recordings/stats?userId=user123
```

**Response:**
```json
{
  "totalRecordings": 45,
  "totalDuration": 8100,
  "totalSize": 13000000,
  "avgDuration": 180
}
```

### Cleanup Expired

```http
POST /api/recordings/cleanup
```

**Response:**
```json
{
  "deletedCount": 5
}
```

## Configuration

### Environment Variables

```bash
# Enable/disable recording
TERMINAL_RECORDING_ENABLED=true

# Retention period (days)
RECORDING_RETENTION_DAYS=30

# Maximum recording size (MB)
RECORDING_MAX_SIZE_MB=50
```

### Retention Policy

Recordings are automatically deleted after the retention period:

- Default: **30 days**
- Configurable via `RECORDING_RETENTION_DAYS`
- Cleanup runs automatically (recommended: daily cron job)
- Manual cleanup: `POST /api/recordings/cleanup`

### Storage Limits

**Per-frame limits:**
- Maximum frame size: **1 MB**
- Frames exceeding limit are rejected

**Per-recording limits:**
- Maximum size: **50 MB** (configurable)
- Exceeding recordings trigger warnings

## Use Cases

### 1. Compliance & Auditing

**Scenario:** SOC 2 compliance requires complete audit trail of all production access.

**Solution:**
- All terminal sessions automatically recorded
- Recordings retained for 90 days
- Export to SIEM system for long-term storage
- Searchable by user, pod, cluster, date

**Example:**
```bash
# Export all production recordings for Q4 2024
curl "https://api.clustercord.com/api/recordings/search?clusterId=prod&fromDate=2024-10-01&toDate=2024-12-31&limit=1000"
```

### 2. Debugging & Root Cause Analysis

**Scenario:** Production incident occurred, need to see exactly what commands were run.

**Solution:**
- Search recordings by pod name
- Play back session to see sequence of events
- Export HTML for sharing with team
- Identify problematic command

**Example:**
```bash
# Find sessions on crashed pod
/recording list pod:web-pod-crashed

# Playback to see what happened
/recording playback id:abc123 speed:2.0

# Export for incident report
/recording export id:abc123 format:html
```

### 3. Training & Knowledge Sharing

**Scenario:** Onboard new engineers on production debugging techniques.

**Solution:**
- Record expert debugging session
- Export as HTML for documentation
- Share asciinema recording in docs
- New engineers can replay sessions

**Example:**
```bash
# Record yourself debugging an issue
/terminal exec cluster:prod namespace:default pod:api-pod

# Export for training materials
/recording export id:abc123 format:html
/recording export id:abc123 format:asciicast
```

### 4. Security Incident Response

**Scenario:** Suspicious activity detected, need to review all commands by specific user.

**Solution:**
- Search recordings by user ID
- Review all commands chronologically
- Identify unauthorized access
- Export for security team

**Example:**
```bash
# Find all recordings by user
curl "https://api.clustercord.com/api/recordings/search?userId=user123"

# Review each session
/recording playback id:session1
/recording playback id:session2

# Export for forensics
/recording export id:session1 format:json
```

## Best Practices

### 1. Regular Cleanup

Schedule automatic cleanup to prevent storage bloat:

```bash
# Add to cron (daily at 2 AM)
0 2 * * * curl -X POST http://localhost:3000/api/recordings/cleanup
```

### 2. Long-Term Archival

Export recordings to external storage before retention expiration:

```bash
# Weekly backup script
#!/bin/bash
RECORDINGS=$(curl "http://localhost:3000/api/recordings/search?limit=1000")
for ID in $(echo $RECORDINGS | jq -r '.[].id'); do
  curl "http://localhost:3000/api/recordings/$ID/export?format=json&compress=true" \
    -o "archive/$ID.json.gz"
done
```

### 3. SIEM Integration

Forward recordings to Security Information and Event Management system:

```javascript
// Example: Forward to Splunk
const recordings = await fetch('/api/recordings/search?limit=100');
for (const recording of recordings.json()) {
  await fetch('https://splunk.company.com/services/collector', {
    method: 'POST',
    headers: { 'Authorization': 'Splunk <token>' },
    body: JSON.stringify({
      event: recording,
      sourcetype: 'clustercord:recording'
    })
  });
}
```

### 4. Access Control

Implement user-based access control:

```typescript
// Only allow users to view their own recordings
app.get('/api/recordings/:id', async (req, res) => {
  const recording = await prisma.terminalRecording.findUnique({
    where: { id: req.params.id },
    include: { user: true }
  });

  if (recording.user.discordId !== req.user.discordId && !req.user.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  res.json(recording);
});
```

## Security Considerations

### Secret Redaction

**Automatic patterns:**
- Passwords
- Tokens
- API keys
- Private keys
- Bearer auth

**Custom patterns:**
```typescript
// Add custom redaction pattern
recordingService.addRedactionPattern(
  /CUSTOM_SECRET_[A-Z0-9]+/g,
  'Custom secret pattern'
);
```

### Storage Security

- Recordings stored in PostgreSQL
- Database encrypted at rest
- Access via API requires authentication
- Export requires user ownership verification

### Compliance

Recording system meets requirements for:
- **SOC 2** - Complete audit trail
- **HIPAA** - Access logging (with PHI redaction)
- **PCI DSS** - Command logging for cardholder data access
- **ISO 27001** - Information security management

## Troubleshooting

### Recording Not Starting

**Symptom:** Terminal session works but no recording created.

**Diagnosis:**
```bash
# Check if recording is enabled
echo $TERMINAL_RECORDING_ENABLED

# Check backend logs
docker logs clustercord-backend | grep "Recording started"
```

**Solution:**
- Set `TERMINAL_RECORDING_ENABLED=true`
- Restart backend service
- Verify database connectivity

### Playback Too Slow

**Symptom:** Playback takes too long in Discord.

**Solution:**
```bash
# Increase playback speed
/recording playback id:abc123 speed:4.0

# Export and view in browser instead
/recording export id:abc123 format:html
```

### Storage Growing Too Fast

**Symptom:** Database size increasing rapidly.

**Diagnosis:**
```bash
# Check total storage
curl "http://localhost:3000/api/recordings/stats"
```

**Solution:**
- Reduce retention period: `RECORDING_RETENTION_DAYS=7`
- Run cleanup more frequently
- Implement size limits per recording
- Archive old recordings to object storage

## API Integration Examples

### Python: Export All Recordings

```python
import requests
import json

API_BASE = "http://localhost:3000"

# Get all recordings
response = requests.get(f"{API_BASE}/api/recordings/search", params={
    "limit": 50
})

recordings = response.json()

# Export each as JSON
for recording in recordings:
    export_response = requests.get(
        f"{API_BASE}/api/recordings/{recording['id']}/export",
        params={"format": "json"}
    )

    with open(f"exports/{recording['id']}.json", "w") as f:
        json.dump(export_response.json(), f, indent=2)
```

### Node.js: Search and Playback

```javascript
const axios = require('axios');

const API_BASE = 'http://localhost:3000';

async function findAndPlayback(podName) {
  // Search for recordings
  const { data: recordings } = await axios.get(
    `${API_BASE}/api/recordings/search`,
    { params: { podName, limit: 1 } }
  );

  if (recordings.length === 0) {
    console.log('No recordings found');
    return;
  }

  // Get playback data
  const { data } = await axios.get(
    `${API_BASE}/api/recordings/${recordings[0].id}/playback`
  );

  // Replay frames
  for (const frame of data.frames) {
    if (frame.type === 'output') {
      process.stdout.write(frame.data);
      await new Promise(r => setTimeout(r, 100));
    }
  }
}

findAndPlayback('web-pod-123');
```

## Future Enhancements

Planned improvements:

1. **Real-time streaming** - WebSocket-based live playback
2. **Video export** - Generate MP4 recordings
3. **Collaborative annotations** - Add comments to recordings
4. **AI-powered insights** - Automatically detect issues in recordings
5. **Multi-session correlation** - Link related sessions across pods
6. **Advanced search** - Full-text search across all recordings

---

**Terminal recording is a powerful feature for compliance, debugging, and team collaboration. Use it responsibly and securely!** 🎥
