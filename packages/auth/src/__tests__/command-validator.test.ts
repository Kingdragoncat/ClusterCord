import { CommandValidator } from '../command-validator';

describe('CommandValidator', () => {
  let validator: CommandValidator;

  beforeEach(() => {
    validator = new CommandValidator();
  });

  describe('validate - destructive commands', () => {
    it('should block rm -rf /', () => {
      const result = validator.validate('rm -rf /');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Blocked');
    });

    it('should block rm -rf *', () => {
      const result = validator.validate('rm -rf *');

      expect(result.allowed).toBe(false);
    });

    it('should block dd commands', () => {
      const result = validator.validate('dd if=/dev/zero of=/dev/sda');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Disk write');
    });

    it('should block mkfs', () => {
      const result = validator.validate('mkfs.ext4 /dev/sda1');

      expect(result.allowed).toBe(false);
    });
  });

  describe('validate - system modifications', () => {
    it('should block systemctl', () => {
      const result = validator.validate('systemctl stop nginx');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Systemd control');
    });

    it('should block mount', () => {
      const result = validator.validate('mount /dev/sda1 /mnt');

      expect(result.allowed).toBe(false);
    });

    it('should block passwd', () => {
      const result = validator.validate('passwd root');

      expect(result.allowed).toBe(false);
    });
  });

  describe('validate - escape attempts', () => {
    it('should block docker commands', () => {
      const result = validator.validate('docker run -it ubuntu /bin/bash');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Docker');
    });

    it('should block kubectl commands', () => {
      const result = validator.validate('kubectl get pods');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Kubectl');
    });
  });

  describe('validate - safe commands', () => {
    it('should allow ls', () => {
      const result = validator.validate('ls -la');

      expect(result.allowed).toBe(true);
    });

    it('should allow pwd', () => {
      const result = validator.validate('pwd');

      expect(result.allowed).toBe(true);
    });

    it('should allow echo', () => {
      const result = validator.validate('echo "Hello World"');

      expect(result.allowed).toBe(true);
    });

    it('should allow cat on normal files', () => {
      const result = validator.validate('cat /app/config.json');

      expect(result.allowed).toBe(true);
    });

    it('should allow grep', () => {
      const result = validator.validate('grep -r "error" /var/log/app');

      expect(result.allowed).toBe(true);
    });
  });

  describe('validate - suspicious patterns', () => {
    it('should block excessive pipes', () => {
      const result = validator.validate('cat file | grep a | sed s/a/b/ | awk {print} | sort | uniq');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('suspicious');
    });

    it('should block excessive semicolons', () => {
      const result = validator.validate('cmd1; cmd2; cmd3; cmd4; cmd5');

      expect(result.allowed).toBe(false);
    });

    it('should block excessive metacharacters', () => {
      const result = validator.validate('`echo $((1+1))` && $(cat file) || <input> >output');

      expect(result.allowed).toBe(false);
    });
  });

  describe('sanitize', () => {
    it('should remove null bytes', () => {
      const sanitized = validator.sanitize('command\x00arg');

      expect(sanitized).toBe('commandarg');
      expect(sanitized).not.toContain('\x00');
    });

    it('should normalize whitespace', () => {
      const sanitized = validator.sanitize('command    arg1     arg2');

      expect(sanitized).toBe('command arg1 arg2');
    });

    it('should trim whitespace', () => {
      const sanitized = validator.sanitize('  command arg  ');

      expect(sanitized).toBe('command arg');
    });
  });

  describe('addPattern', () => {
    it('should add custom pattern', () => {
      validator.addPattern(/dangerous-custom-cmd/, 'Custom dangerous command');

      const result = validator.validate('dangerous-custom-cmd --arg');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Custom dangerous');
    });

    it('should add string pattern', () => {
      validator.addPattern('forbidden-string', 'Forbidden operation');

      const result = validator.validate('some forbidden-string operation');

      expect(result.allowed).toBe(false);
    });
  });

  describe('getBlacklist', () => {
    it('should return all blacklist patterns', () => {
      const blacklist = validator.getBlacklist();

      expect(Array.isArray(blacklist)).toBe(true);
      expect(blacklist.length).toBeGreaterThan(0);
    });

    it('should include pattern and description', () => {
      const blacklist = validator.getBlacklist();

      blacklist.forEach(item => {
        expect(item).toHaveProperty('pattern');
        expect(item).toHaveProperty('description');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty command', () => {
      const result = validator.validate('');

      expect(result.allowed).toBe(true);
    });

    it('should handle whitespace-only command', () => {
      const result = validator.validate('   ');

      expect(result.allowed).toBe(true);
    });

    it('should be case-sensitive', () => {
      const result = validator.validate('SYSTEMCTL stop nginx');

      // Original patterns are lowercase, so uppercase should pass
      // (In production, you might want case-insensitive matching)
      expect(result.allowed).toBe(true);
    });
  });
});
