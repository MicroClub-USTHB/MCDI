# MCDI - Discord Integration Backend

A NestJS-based backend service for Discord integration, managed using Linear for issue tracking and GitHub for version control.

## Quick Start

**For local development, see [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed instructions.**

### Using Docker (Recommended)

```bash
# 1. Copy environment variables
cp .env.example .env

# 2. Start all services
docker-compose up -d

# 3. Access the app at http://localhost:3000
```

**All services:**
- Application: http://localhost:3000
- phpMyAdmin: http://localhost:8080 (root/root_password)
- Redis Commander: http://localhost:8081
- Mailhog: http://localhost:8025

### Using npm directly

```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run start:dev

# Production mode
npm run start:prod

# Run tests
npm run test
```

## Development Workflow

### 1. Working with Linear Issues

**Issue States:**
```
Backlog → Todo → In Progress → In Review → Done
```

**Quick Actions:**
- `C` - Create new issue
- `K` - Command palette
- `G → I` - Go to My Issues
- `S → I` - Set to In Progress

### 2. Branch Naming Convention

Always include the Linear issue ID:

```bash
# Format: dis-[issue-number]-[short-description]
dis-23-jwt-token-validation
dis-45-fix-oauth-callback
dis-67-member-sync-cron
```

**Create a branch:**
```bash
git checkout main
git pull origin main
git checkout -b dis-23-jwt-token-validation
```

### 3. Commit Messages

Include the issue number in every commit:

```bash
# Format: [Description] (#DIS-XXX)
git commit -m "Add JWT token validation middleware (#DIS-23)"
git commit -m "Fix OAuth callback 401 error (#DIS-45)"

# To auto-close issues
git commit -m "Fixes #DIS-23 - Complete JWT implementation"
```

### 4. Pull Requests

**PR Title Format:**
```
[DIS-XXX] Short description of changes
```

**PR Description:**
```markdown
## Issue
Closes #DIS-123

## What Changed
- [Brief description of main changes]

## How to Test
1. [Step-by-step testing instructions]

## Checklist
- [ ] Tests added/updated
- [ ] All tests passing
- [ ] Code reviewed by self first
- [ ] Documentation updated (if needed)
```

## Daily Workflow

1. **Morning:** Check your issues (`G → I` in Linear)
2. **Start Work:** Move issue to "In Progress" (`S → I`)
3. **Create Branch:** Use Linear issue number
4. **Code:** Commit with issue numbers
5. **Open PR:** Link to Linear issue
6. **Review:** Move to "In Review" status
7. **Merge:** Issue auto-closes to "Done"

## Git Conventions

**Branch Naming:**
```bash
dis-[#]-[description]
```

**Commit Format:**
```bash
[Description] (#DIS-XXX)
```

**PR Title:**
```bash
[DIS-XXX] Description
```

## Best Practices

✅ **Do:**
- Move issues to "In Progress" when you start
- Include issue number in branches, commits, and PRs
- Keep PRs small (< 400 lines)
- Add comments with progress updates
- Self-review before requesting review

❌ **Don't:**
- Leave stale "In Progress" issues
- Work on unassigned issues (assign yourself first)
- Make huge PRs (> 800 lines)
- Forget to link PRs to issues
- Write vague commit messages

## Linear Quick Reference

| Shortcut | Action |
|----------|--------|
| `C` | Create issue |
| `K` | Command palette |
| `G → I` | Go to My Issues |
| `S → I` | Set to In Progress |
| `A` | Assign |
| `L` | Add label |
| `M` | Add comment |
| `Shift + ?` | Show all shortcuts |

## Scripts

```bash
# Development
npm run start:dev

# Build
npm run build

# Lint
npm run lint

# Format
npm run format

# Tests
npm run test           # unit tests
npm run test:e2e       # e2e tests
npm run test:cov       # test coverage
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
npm install -g @nestjs/mau
mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

UNLICENSED
