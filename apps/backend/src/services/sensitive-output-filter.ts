/**
 * Sensitive Output Filter - Prevents leaking secrets in terminal output
 */

export interface FilterResult {
  filtered: string;
  redactedCount: number;
  categories: string[];
}

export class SensitiveOutputFilter {
  private patterns: Array<{
    name: string;
    regex: RegExp;
    replacement: string;
    category: string;
  }> = [];

  constructor() {
    this.initializePatterns();
  }

  /**
   * Filter sensitive information from output
   */
  filter(text: string): FilterResult {
    let filtered = text;
    let redactedCount = 0;
    const categories = new Set<string>();

    for (const pattern of this.patterns) {
      const matches = filtered.match(pattern.regex);
      if (matches) {
        filtered = filtered.replace(pattern.regex, pattern.replacement);
        redactedCount += matches.length;
        categories.add(pattern.category);
      }
    }

    return {
      filtered,
      redactedCount,
      categories: Array.from(categories)
    };
  }

  /**
   * Initialize sensitive patterns
   */
  private initializePatterns() {
    // AWS Credentials
    this.patterns.push({
      name: 'AWS Access Key ID',
      regex: /(AKIA[0-9A-Z]{16})/g,
      replacement: '[AWS_ACCESS_KEY_REDACTED]',
      category: 'aws'
    });

    this.patterns.push({
      name: 'AWS Secret Access Key',
      regex: /aws_secret_access_key\s*[:=]\s*([A-Za-z0-9/+=]{40})/gi,
      replacement: 'aws_secret_access_key: [REDACTED]',
      category: 'aws'
    });

    // Generic API Keys
    this.patterns.push({
      name: 'API Key',
      regex: /api[-_]?key\s*[:=]\s*["']?([a-zA-Z0-9_\-]{20,})["']?/gi,
      replacement: 'api-key: [REDACTED]',
      category: 'api-key'
    });

    // Bearer Tokens
    this.patterns.push({
      name: 'Bearer Token',
      regex: /Bearer\s+([a-zA-Z0-9\-._~+/]+=*)/gi,
      replacement: 'Bearer [REDACTED]',
      category: 'token'
    });

    // JWT Tokens
    this.patterns.push({
      name: 'JWT Token',
      regex: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
      replacement: '[JWT_TOKEN_REDACTED]',
      category: 'token'
    });

    // Kubernetes Tokens
    this.patterns.push({
      name: 'Kubernetes Token',
      regex: /token\s*[:=]\s*["']?([a-zA-Z0-9_\-\.]{20,})["']?/gi,
      replacement: 'token: [REDACTED]',
      category: 'k8s'
    });

    // Passwords
    this.patterns.push({
      name: 'Password',
      regex: /password\s*[:=]\s*["']?([^\s"']+)["']?/gi,
      replacement: 'password: [REDACTED]',
      category: 'password'
    });

    this.patterns.push({
      name: 'Password (environment)',
      regex: /[A-Z_]*PASSWORD[A-Z_]*\s*[:=]\s*["']?([^\s"']+)["']?/gi,
      replacement: (match) => match.split(/[:=]/)[0] + ': [REDACTED]',
      category: 'password'
    });

    // Private Keys
    this.patterns.push({
      name: 'RSA Private Key',
      regex: /-----BEGIN RSA PRIVATE KEY-----[\s\S]*?-----END RSA PRIVATE KEY-----/g,
      replacement: '[RSA_PRIVATE_KEY_REDACTED]',
      category: 'private-key'
    });

    this.patterns.push({
      name: 'Private Key',
      regex: /-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g,
      replacement: '[PRIVATE_KEY_REDACTED]',
      category: 'private-key'
    });

    this.patterns.push({
      name: 'EC Private Key',
      regex: /-----BEGIN EC PRIVATE KEY-----[\s\S]*?-----END EC PRIVATE KEY-----/g,
      replacement: '[EC_PRIVATE_KEY_REDACTED]',
      category: 'private-key'
    });

    this.patterns.push({
      name: 'OpenSSH Private Key',
      regex: /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*?-----END OPENSSH PRIVATE KEY-----/g,
      replacement: '[OPENSSH_PRIVATE_KEY_REDACTED]',
      category: 'private-key'
    });

    // SSH Keys
    this.patterns.push({
      name: 'SSH Private Key',
      regex: /-----BEGIN.*PRIVATE KEY-----[\s\S]*?-----END.*PRIVATE KEY-----/g,
      replacement: '[SSH_PRIVATE_KEY_REDACTED]',
      category: 'ssh-key'
    });

    // Certificates
    this.patterns.push({
      name: 'Certificate',
      regex: /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
      replacement: '[CERTIFICATE_REDACTED]',
      category: 'certificate'
    });

    // Kubeconfig
    this.patterns.push({
      name: 'Kubeconfig',
      regex: /apiVersion:\s*v1\s*kind:\s*Config[\s\S]{100,}/g,
      replacement: '[KUBECONFIG_REDACTED]',
      category: 'k8s'
    });

    // Database Connection Strings
    this.patterns.push({
      name: 'Database URL',
      regex: /(postgres|mysql|mongodb):\/\/([^:]+):([^@]+)@([^/\s]+)/gi,
      replacement: (match, protocol) => {
        const parts = match.split('@');
        return `${protocol}://[USER]:[PASSWORD]@${parts[1]}`;
      },
      category: 'database'
    });

    // GitHub Personal Access Token
    this.patterns.push({
      name: 'GitHub PAT',
      regex: /ghp_[a-zA-Z0-9]{36}/g,
      replacement: '[GITHUB_TOKEN_REDACTED]',
      category: 'github'
    });

    // GitLab Personal Access Token
    this.patterns.push({
      name: 'GitLab PAT',
      regex: /glpat-[a-zA-Z0-9_\-]{20}/g,
      replacement: '[GITLAB_TOKEN_REDACTED]',
      category: 'gitlab'
    });

    // Docker Registry Auth
    this.patterns.push({
      name: 'Docker Auth',
      regex: /auth\s*[:=]\s*["']?([A-Za-z0-9+/=]{40,})["']?/gi,
      replacement: 'auth: [REDACTED]',
      category: 'docker'
    });

    // Generic Secrets
    this.patterns.push({
      name: 'Secret',
      regex: /secret\s*[:=]\s*["']?([^\s"']{20,})["']?/gi,
      replacement: 'secret: [REDACTED]',
      category: 'secret'
    });

    // Credit Card Numbers (basic)
    this.patterns.push({
      name: 'Credit Card',
      regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      replacement: '[CREDIT_CARD_REDACTED]',
      category: 'pci'
    });

    // Social Security Numbers (US)
    this.patterns.push({
      name: 'SSN',
      regex: /\b\d{3}-\d{2}-\d{4}\b/g,
      replacement: '[SSN_REDACTED]',
      category: 'pii'
    });

    // Email Addresses (optional - might be too aggressive)
    this.patterns.push({
      name: 'Email',
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      replacement: '[EMAIL_REDACTED]',
      category: 'pii'
    });

    // Slack Webhook
    this.patterns.push({
      name: 'Slack Webhook',
      regex: /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9\/]+/gi,
      replacement: '[SLACK_WEBHOOK_REDACTED]',
      category: 'webhook'
    });

    // Discord Webhook
    this.patterns.push({
      name: 'Discord Webhook',
      regex: /https:\/\/discord\.com\/api\/webhooks\/\d+\/[a-zA-Z0-9_-]+/gi,
      replacement: '[DISCORD_WEBHOOK_REDACTED]',
      category: 'webhook'
    });

    // Stripe API Key
    this.patterns.push({
      name: 'Stripe Key',
      regex: /sk_live_[a-zA-Z0-9]{24,}/g,
      replacement: '[STRIPE_KEY_REDACTED]',
      category: 'stripe'
    });

    // Google API Key
    this.patterns.push({
      name: 'Google API Key',
      regex: /AIza[0-9A-Za-z_-]{35}/g,
      replacement: '[GOOGLE_API_KEY_REDACTED]',
      category: 'google'
    });

    // Azure Storage Connection String
    this.patterns.push({
      name: 'Azure Storage',
      regex: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+/gi,
      replacement: '[AZURE_STORAGE_REDACTED]',
      category: 'azure'
    });
  }

  /**
   * Check if text contains sensitive information
   */
  containsSensitiveInfo(text: string): boolean {
    for (const pattern of this.patterns) {
      if (pattern.regex.test(text)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get statistics about what was filtered
   */
  getFilterStats(text: string): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const pattern of this.patterns) {
      const matches = text.match(pattern.regex);
      if (matches) {
        stats[pattern.name] = matches.length;
      }
    }

    return stats;
  }

  /**
   * Add custom pattern
   */
  addPattern(
    name: string,
    regex: RegExp,
    replacement: string,
    category: string = 'custom'
  ) {
    this.patterns.push({ name, regex, replacement, category });
  }

  /**
   * Get all pattern categories
   */
  getCategories(): string[] {
    return Array.from(new Set(this.patterns.map((p) => p.category)));
  }
}
