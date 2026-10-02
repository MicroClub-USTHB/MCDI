# /work-issue — End-to-End Issue Implementation

Fetch a GitHub issue by ID, plan the implementation, and build it using the full MCDI ecosystem (agents, skills, commands).

## Usage

```
/work-issue <issue-number>
```

Example: `/work-issue 15`

## Workflow

### Phase 0: Fetch & understand

1. **Fetch the issue**:
   ```bash
   gh issue view <issue-number> --repo MicroClub-USTHB/MCDI-Front
   ```

2. **Read the full issue body** — extract:
   - Title and description
   - Acceptance criteria / checklist items
   - Files to modify / create
   - Dependencies and blockers
   - Referenced specs or design tokens

3. **Read project context**:
   - Scan `AGENTS.md` for architecture and conventions
   - Check `../MCDI-V2-SPECIFICATION.md` if the issue references the V2 spec
   - Use the **Explore agent** to understand any existing files mentioned in the issue

### Phase 1: Branch & plan

1. **Create a branch from main**:
   ```bash
   git checkout main && git pull origin main
   git checkout -b benabdou1001/<issue-slug>
   ```
   The branch name should be `benabdou1001/` followed by a kebab-case slug derived from the issue title (e.g., `benabdou1001/add-member-directory-page`).

2. **Create a structured implementation plan** using tasks. Break the issue into discrete steps:
   - Group related changes (e.g., "types + API hooks" → "components" → "page + routing" → "tests")
   - Order by dependency (shared types first, then hooks, then components, then pages)
   - Identify which **skills** apply to each step:
     - Building API hooks → `tanstack-query-best-practices` (query keys, caching, mutations)
     - Building UI → `tailwind-design-system` (token recipes), `tailwind-css-patterns` (layout)
     - Performance decisions → `vercel-react-best-practices` (bundle, waterfalls, re-renders)
   - Identify which **agents** to consult:
     - Choosing state approach → **state-architect** agent
     - Data flow decisions → `tanstack-query-best-practices` skill

3. **Present the plan to the user** — show the task breakdown and ask for confirmation before proceeding.

### Phase 2: Build (iterative)

For each task in the plan:

1. **Reference the relevant skill** before coding:
   - For new components: read `tailwind-design-system` skill for token recipes
   - For data fetching: read `tanstack-query-best-practices` skill for the right pattern
   - For layout/responsive: read `tailwind-css-patterns` skill
   - For performance: read `vercel-react-best-practices` skill

2. **Scaffold when appropriate**:
   - New component needed → use the `/new-ui` command pattern (create `.tsx` + `.spec.tsx` + `index.ts`)
   - New feature module → create `src/features/<name>/` with `types/`, `api/`, `stores/`, `components/`, `index.ts`

3. **Implement** following project conventions:
   - Use design system tokens exclusively (no hardcoded colors, no `dark:` classes)
   - Use `cn()` for all class merging
   - Use `import type` for type-only imports
   - Use `apiClient` for all API calls (never raw `fetch`)
   - Use React Query for server state, Zustand for client state, `useState` for local
   - Named exports only (except Next.js pages/layouts)
   - No `any` — use `unknown` and narrow

4. **Commit after each logical group** using the `/commit` pattern:
   ```
   <type>(<scope>): <description>

   Refs #<issue-number>
   ```
   Run `npm run typecheck && npm run lint && npm run format:check` before each commit.

5. **Mark the task complete** and move to the next one.

### Phase 3: Quality audit

After all tasks are done, run the auditor agents:

1. **UI/UX guardian agent** — check all new/modified components for:
   - Design token compliance (no hardcoded colors)
   - Correct surface layering hierarchy
   - Proper hover/focus/active states
   - 4px grid spacing alignment
   - CLS prevention

2. **Accessibility auditor agent** — check for:
   - Semantic HTML (no `div` as button)
   - ARIA labels on interactive elements
   - Keyboard navigation flow
   - Focus management
   - Color contrast compliance

3. **Security auditor agent** — check for:
   - XSS vectors (dangerouslySetInnerHTML, eval)
   - Auth token handling
   - Input validation with Zod
   - No raw fetch bypassing apiClient

4. **Bundle audit** — run the `/audit-bundle` pattern to check for heavy imports and code-splitting opportunities.

5. **Fix all findings**, commit the fixes:
   ```
   fix(<scope>): address audit findings from quality gates

   Refs #<issue-number>
   ```

### Phase 4: Verify

1. **Route preview** — use the `/preview-route` pattern on any new routes to verify:
   - Loading states render skeletons
   - Error states show user-friendly messages
   - Empty states are handled
   - Route guards work correctly

2. **Run the full quality suite**:
   ```bash
   npm run typecheck && npm run lint && npm run format:check && npm run build
   ```
   All four must pass.

3. **Visual verification** — start the dev server and check in the browser:
   ```bash
   npm run dev
   ```
   - Dark surfaces render correctly with proper layering
   - Brand colors are Blurple (#5865F2), not purple
   - DM Sans font loads
   - All interactive states work (hover, focus, active, disabled)
   - Responsive breakpoints work

### Phase 5: Ship

1. **Push and create PR** using the `/draft-pr` pattern:
   ```bash
   git push -u origin <branch-name>
   gh pr create --title "<type>: <description>" --body "..."
   ```
   The PR body must include:
   - Summary of changes
   - Files changed table
   - Design system compliance checklist
   - Testing checklist
   - `Closes #<issue-number>`

2. **Report completion** — summarize what was built, how many commits, and link the PR.

## Rules

- **Never skip the planning phase** — always present the plan and get confirmation
- **Never skip quality gates** — always run the auditor agents after building
- **Never skip verification** — always run typecheck + lint + format + build
- **Commit atomically** — one logical change per commit, always reference the issue
- **Use the skills** — don't rely on training data for TanStack Query, Tailwind, or React patterns
- **Ask when uncertain** — if the issue is ambiguous or has multiple valid approaches, ask the user
