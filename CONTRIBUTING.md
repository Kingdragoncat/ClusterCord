# Contributing to ClusterCord

Thank you for your interest in contributing to ClusterCord! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Docker & Docker Compose
- Kind (for local Kubernetes testing)
- Git

### Local Development

1. **Fork and Clone**

```bash
git clone https://github.com/YOUR_USERNAME/clustercord.git
cd clustercord
```

2. **Install Dependencies**

```bash
npm install
```

3. **Set Up Environment**

```bash
cp .env.example .env
```

Edit `.env` with your Discord bot credentials and generate secure keys:

```bash
# Generate encryption key (32 bytes hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

4. **Start Development Environment**

```bash
# Start database and mailhog
docker-compose up -d postgres mailhog

# Run migrations
npm run db:migrate

# Start backend (in one terminal)
npm run dev:backend

# Start bot (in another terminal)
npm run dev:bot
```

5. **Create Test Kubernetes Cluster**

```bash
kind create cluster --name clustercord-dev
kind get kubeconfig --name clustercord-dev > test-kubeconfig.yaml
```

### Project Structure

```
clustercord/
├── apps/
│   ├── bot/                     # Discord bot
│   │   ├── src/
│   │   │   ├── commands/        # Slash commands
│   │   │   ├── events/          # Discord events
│   │   │   └── index.ts         # Entry point
│   │   └── package.json
│   └── backend/                 # API server
│       ├── src/
│       │   ├── routes/          # API routes
│       │   ├── services/        # Business logic
│       │   └── index.ts         # Entry point
│       ├── prisma/              # Database schema
│       └── package.json
├── packages/
│   ├── k8s-sdk/                 # Kubernetes wrapper
│   ├── auth/                    # Security utilities
│   └── ui/                      # Discord UI components
└── infra/                       # Infrastructure code
```

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/your-org/clustercord/issues) to avoid duplicates
2. Create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)
   - Logs (remove sensitive info!)

### Suggesting Features

1. Check existing feature requests
2. Create an issue with:
   - Use case and motivation
   - Proposed solution
   - Alternative approaches considered
   - Impact on security/performance

### Pull Requests

1. **Create a Branch**

```bash
git checkout -b feature/my-feature
# or
git checkout -b fix/bug-description
```

2. **Make Changes**

- Follow the existing code style
- Add tests for new features
- Update documentation
- Keep commits focused and atomic

3. **Test Your Changes**

```bash
# Run linter
npm run lint

# Type check
npm run typecheck

# Run tests
npm test

# Build to check for errors
npm run build
```

4. **Commit**

Use conventional commits:

```bash
git commit -m "feat: add helm install command"
git commit -m "fix: prevent race condition in OTP verification"
git commit -m "docs: update security guidelines"
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

5. **Push and Create PR**

```bash
git push origin feature/my-feature
```

Create a pull request with:
- Clear description of changes
- Link to related issues
- Screenshots (if UI changes)
- Test results

## Code Style

### TypeScript

- Use TypeScript strict mode
- Prefer `interface` over `type` for object shapes
- Use explicit return types for functions
- Avoid `any` - use `unknown` if type is truly unknown

### Naming Conventions

- **Files**: kebab-case (`pod-manager.ts`)
- **Classes**: PascalCase (`ServiceAccountManager`)
- **Functions/Variables**: camelCase (`createToken`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Interfaces**: PascalCase, no `I` prefix (`ClusterConfig`)

### Code Organization

- One component/class per file
- Group related files in directories
- Use barrel exports (`index.ts`)
- Keep functions small and focused

### Security Guidelines

When contributing, always consider:

1. **Never log sensitive data** (tokens, passwords, kubeconfigs)
2. **Validate all inputs** (Discord commands, API requests)
3. **Use parameterized queries** (Prisma handles this)
4. **Sanitize command inputs** before execution
5. **Check permissions** before K8s operations
6. **Rate limit** expensive operations
7. **Encrypt secrets** at rest

## Testing

### Unit Tests

```bash
npm test
```

Located in `*.test.ts` files next to source.

### Integration Tests

Test end-to-end flows:

```bash
npm run test:integration
```

### Manual Testing Checklist

Before submitting PR, test:

- [ ] Cluster add/remove/list
- [ ] Pod list/logs/describe
- [ ] Terminal exec (with and without OTP)
- [ ] OTP verification flow
- [ ] Session kill
- [ ] Command blacklist enforcement
- [ ] Rate limiting
- [ ] Error handling

## Good First Issues

Look for issues tagged `good first issue`:

- Add namespace autocomplete to commands
- Implement additional email providers (Resend, SES)
- Create more comprehensive tests
- Improve error messages
- Add command blacklist patterns
- Write usage examples

## Documentation

When adding features:

1. Update relevant `.md` files
2. Add JSDoc comments to public APIs
3. Include examples in README
4. Update COMMANDS.md if adding commands

## Release Process

Maintainers handle releases:

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create release tag
4. Publish to npm (future)
5. Build and push Docker images

## Getting Help

- 💬 [Discord Server](https://discord.gg/clustercord) - Community chat
- 📖 [Documentation](docs/) - Detailed guides
- 🐛 [Issues](https://github.com/your-org/clustercord/issues) - Bug reports
- 💡 [Discussions](https://github.com/your-org/clustercord/discussions) - Q&A and ideas

## Code of Conduct

Be respectful and inclusive. We follow the [Contributor Covenant](https://www.contributor-covenant.org/).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for making ClusterCord better! 🚀
