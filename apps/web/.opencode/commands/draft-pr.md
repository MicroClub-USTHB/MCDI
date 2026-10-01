# /draft-pr — Draft a Pull Request

Create a well-structured GitHub pull request for the current branch.

## Steps

1. **Verify branch state**:
   ```bash
   git status
   git log main..HEAD --oneline
   git diff main...HEAD --stat
   ```

2. **Run all quality checks**:
   ```bash
   npm run typecheck && npm run lint && npm run format:check && npm run build
   ```

3. **Push to remote**:
   ```bash
   git push -u origin <branch-name>
   ```

4. **Create PR** with structured description:

   ```bash
   gh pr create --title "<type>: <description>" --body "$(cat <<'EOF'
   ## Summary
   <1-3 bullet points describing what changed and why>

   ## Changes
   | File | Change |
   |---|---|
   | `src/path/file.tsx` | Description |

   ## Design System Compliance
   - [ ] All colors use V2 design tokens
   - [ ] No hardcoded hex values
   - [ ] No `dark:` prefixed classes
   - [ ] Typography uses DM Sans / JetBrains Mono

   ## Testing
   - [ ] `npm run build` passes
   - [ ] `npm run typecheck` passes
   - [ ] `npm run lint` passes
   - [ ] New tests written (if applicable)
   - [ ] Visual verification done

   ## Screenshots
   <If UI changes, add before/after screenshots>

   Closes #<issue-number>
   EOF
   )"
   ```

## PR Title Convention

```
feat: add member directory page
fix: correct auth redirect on token expiry
refactor: extract sidebar into shared component
```

## Rules

- Always run quality checks before creating PR
- Reference the GitHub issue being addressed
- Include the design system compliance checklist for UI changes
- Add screenshots for any visual changes
