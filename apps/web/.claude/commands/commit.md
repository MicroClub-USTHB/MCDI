# /commit — Create a Quality Commit

Create a well-structured git commit following project conventions.

## Steps

1. **Run quality checks**:
   ```bash
   npm run typecheck && npm run lint && npm run format:check
   ```
   If any fail, fix the issues first.

2. **Review changes**:
   ```bash
   git status
   git diff --staged
   git diff
   ```

3. **Stage relevant files** — stage only related changes, not unrelated work.

4. **Write commit message** following Conventional Commits:

   ```
   <type>(<scope>): <short description>

   <optional body — explain WHY, not WHAT>

   <optional footer — Refs #issue, Closes #issue>
   ```

   Types: `feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`, `perf`
   Scopes: `auth`, `dashboard`, `ui`, `api`, `config`, `deps`

5. **Commit** without `--no-verify` (let husky hooks run).

## Examples

```
feat(auth): add Discord OAuth login flow

Refs #15

fix(ui): correct surface color on skeleton card

The SkeletonCard was using the old muted-foreground token
instead of the V2 surface-hover token.

Closes #15

refactor(api): extract query key factory for server endpoints
```

## Rules

- Never skip pre-commit hooks (`--no-verify`)
- Never commit `.env` files or secrets
- Keep commits atomic — one logical change per commit
- Reference GitHub issues when applicable (`Refs #N` or `Closes #N`)
