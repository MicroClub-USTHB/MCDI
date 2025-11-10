# MCDI - Discord Integration Backend

A NestJS-based backend service for Discord integration, managed using Linear for issue tracking and GitHub for version control.

## Quick Start

```bash
# Install dependencies
npm install

# Development
npm run start:dev

# Production
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

## Project Structure

This is a NestJS application. For more information about NestJS:
- [NestJS Documentation](https://docs.nestjs.com)
- [NestJS Discord](https://discord.gg/G7Qnnhy)

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
npm run test
npm run test:e2e
npm run test:cov
```

## License

UNLICENSED
