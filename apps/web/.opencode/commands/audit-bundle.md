# /audit-bundle — Analyze Bundle Size

Analyze the project's bundle for heavy imports and suggest optimizations.

## What It Does

1. **Run production build** with bundle analysis:
   ```bash
   npm run build
   ```

2. **Check for heavy libraries** — grep `node_modules` and `package.json` for known offenders:
   - `lodash` (use native JS or `lodash-es` with tree-shaking)
   - `moment` / `moment-timezone` (use `date-fns` or `dayjs`)
   - `axios` (project uses custom `ApiClient` with `fetch`)
   - Full icon libraries imported (should use individual `lucide-react` icons)
   - `@radix-ui/*` — check if unused primitives are installed

3. **Check import patterns** — find barrel imports that defeat tree-shaking:
   ```bash
   grep -rn "from 'lucide-react'" src/ --include="*.tsx"
   ```
   Flag: `import { Icon1, Icon2, ... } from 'lucide-react'` with many icons should use:
   ```tsx
   import { Icon1 } from 'lucide-react/dist/esm/icons/icon-1';
   ```

4. **Check for code-splitting opportunities**:
   - Feature routes should use `dynamic()` or `React.lazy()`
   - Heavy components (charts, editors) should be lazy-loaded
   - Check if `(dashboard)` route group pages are properly code-split

5. **Check for duplicate dependencies**:
   ```bash
   npm ls --all 2>/dev/null | grep -i "deduped" | wc -l
   ```

## Output Format

```
## Bundle Audit Report

### Heavy Dependencies
- [WARNING] `lodash` (72KB gzipped) — Replace with native Array/Object methods
- [OK] `lucide-react` — Tree-shakeable, individual icon imports

### Code Splitting
- [WARNING] `src/features/stats/` — No lazy loading, consider dynamic import
- [OK] Dashboard routes — Properly code-split by App Router

### Duplicate Dependencies
- [INFO] 3 packages deduped

### Recommendations
1. ...
2. ...
```
