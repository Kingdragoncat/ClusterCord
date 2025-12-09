export interface CommandValidationResult {
  allowed: boolean;
  reason?: string;
  matchedPattern?: string;
}

export class CommandValidator {
  private blacklistPatterns: Array<{ pattern: string | RegExp; description: string }>;

  constructor() {
    this.blacklistPatterns = this.getDefaultBlacklist();
  }

  /**
   * Get default command blacklist
   */
  private getDefaultBlacklist(): Array<{ pattern: string | RegExp; description: string }> {
    return [
      // Destructive filesystem operations
      { pattern: /rm\s+-rf\s+\//, description: 'Recursive delete from root' },
      { pattern: /rm\s+-rf\s+\*/, description: 'Recursive delete all' },
      { pattern: /dd\s+if=.*of=\/dev\//, description: 'Disk write operations' },
      { pattern: /mkfs/, description: 'Filesystem creation' },
      { pattern: /fdisk/, description: 'Disk partitioning' },

      // System modifications
      { pattern: /chown\s+.*\//, description: 'Change ownership on root paths' },
      { pattern: /chmod\s+.*\//, description: 'Change permissions on root paths' },
      { pattern: /mount/, description: 'Mount operations' },
      { pattern: /umount/, description: 'Unmount operations' },

      // System control
      { pattern: /shutdown/, description: 'System shutdown' },
      { pattern: /reboot/, description: 'System reboot' },
      { pattern: /halt/, description: 'System halt' },
      { pattern: /poweroff/, description: 'System poweroff' },
      { pattern: /systemctl/, description: 'Systemd control' },
      { pattern: /service\s+/, description: 'Service control' },
      { pattern: /init\s+/, description: 'Init control' },

      // User/password management
      { pattern: /passwd/, description: 'Password changes' },
      { pattern: /useradd/, description: 'User creation' },
      { pattern: /userdel/, description: 'User deletion' },
      { pattern: /usermod/, description: 'User modification' },
      { pattern: /groupadd/, description: 'Group creation' },
      { pattern: /groupdel/, description: 'Group deletion' },

      // Package management (potentially dangerous)
      { pattern: /apt-get\s+remove/, description: 'Package removal' },
      { pattern: /yum\s+remove/, description: 'Package removal' },
      { pattern: /dnf\s+remove/, description: 'Package removal' },

      // Network/firewall
      { pattern: /iptables/, description: 'Firewall modification' },
      { pattern: /ip6tables/, description: 'Firewall modification' },
      { pattern: /ufw/, description: 'Firewall modification' },
      { pattern: /firewall-cmd/, description: 'Firewall modification' },

      // Kernel operations
      { pattern: /modprobe/, description: 'Kernel module loading' },
      { pattern: /insmod/, description: 'Kernel module insertion' },
      { pattern: /rmmod/, description: 'Kernel module removal' },

      // Process manipulation (dangerous patterns)
      { pattern: /kill\s+-9\s+1/, description: 'Kill init process' },
      { pattern: /killall\s+-9/, description: 'Kill all processes' },
      { pattern: /pkill\s+-9/, description: 'Pattern kill all' },

      // Forkbombs and resource exhaustion
      { pattern: /:\(\)\{/, description: 'Fork bomb pattern' },
      { pattern: /while\s+true.*do/, description: 'Infinite loop' },

      // Data exfiltration attempts
      { pattern: /curl.*\|.*sh/, description: 'Pipe curl to shell' },
      { pattern: /wget.*\|.*sh/, description: 'Pipe wget to shell' },
      { pattern: /nc\s+-l/, description: 'Netcat listener' },
      { pattern: /ncat\s+-l/, description: 'Ncat listener' },

      // SSH/credential access
      { pattern: /\/etc\/shadow/, description: 'Access to shadow file' },
      { pattern: /\/etc\/passwd/, description: 'Access to passwd file' },
      { pattern: /\.ssh\//, description: 'Access to SSH directory' },

      // Escape attempts
      { pattern: /docker\s+/, description: 'Docker commands' },
      { pattern: /kubectl\s+/, description: 'Kubectl commands (use bot instead)' },
      { pattern: /crictl\s+/, description: 'CRI control' },

      // Encoding/obfuscation attempts
      { pattern: /base64.*decode/, description: 'Base64 decode operations' },
      { pattern: /eval/, description: 'Eval commands' },
      { pattern: /exec/, description: 'Exec commands' }
    ];
  }

  /**
   * Add custom blacklist pattern
   */
  addPattern(pattern: string | RegExp, description: string): void {
    this.blacklistPatterns.push({ pattern, description });
  }

  /**
   * Validate a command against the blacklist
   */
  validate(command: string): CommandValidationResult {
    const trimmedCommand = command.trim();

    // Check against each blacklist pattern
    for (const { pattern, description } of this.blacklistPatterns) {
      let matches = false;

      if (typeof pattern === 'string') {
        matches = trimmedCommand.includes(pattern);
      } else {
        matches = pattern.test(trimmedCommand);
      }

      if (matches) {
        return {
          allowed: false,
          reason: `Blocked: ${description}`,
          matchedPattern: pattern.toString()
        };
      }
    }

    // Additional checks for suspicious patterns
    if (this.containsSuspiciousPattern(trimmedCommand)) {
      return {
        allowed: false,
        reason: 'Command contains suspicious patterns'
      };
    }

    return { allowed: true };
  }

  /**
   * Check for suspicious patterns
   */
  private containsSuspiciousPattern(command: string): boolean {
    // Check for multiple pipes (potential chaining)
    const pipeCount = (command.match(/\|/g) || []).length;
    if (pipeCount > 3) {
      return true;
    }

    // Check for multiple semicolons (potential command chaining)
    const semicolonCount = (command.match(/;/g) || []).length;
    if (semicolonCount > 3) {
      return true;
    }

    // Check for shell metacharacters in suspicious combinations
    const dangerousMetachars = /[;&|`$()<>]/g;
    const metaCharCount = (command.match(dangerousMetachars) || []).length;
    if (metaCharCount > 5) {
      return true;
    }

    return false;
  }

  /**
   * Sanitize command input (basic)
   */
  sanitize(command: string): string {
    // Remove null bytes
    let sanitized = command.replace(/\0/g, '');

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
  }

  /**
   * Get all blacklist patterns
   */
  getBlacklist(): Array<{ pattern: string | RegExp; description: string }> {
    return [...this.blacklistPatterns];
  }
}

/**
 * Default command validator instance
 */
export const defaultCommandValidator = new CommandValidator();
