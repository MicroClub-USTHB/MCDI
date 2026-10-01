# /preview-route — Simulate Route Navigation

Simulate a mock router navigation sequence to verify data fetching hooks handle loading and error states correctly.

## Usage

```
/preview-route <route-path>
```

Example: `/preview-route /dashboard/members`

## What It Checks

### 1. Route File Exists

Verify the page component exists at the expected path:
```
src/app/(dashboard)/<route>/page.tsx
```

### 2. Data Fetching Hooks

Trace all `useQuery` / `useMutation` calls in the page and its child components:
- Query keys are well-structured
- Loading states render a skeleton or spinner
- Error states show an error message (not a blank screen)
- Empty states are handled (no data yet)

### 3. Loading State Flow

Simulate the sequence:
1. **Initial load**: Component mounts → loading skeleton visible → data arrives → content renders
2. **Background refetch**: Data is stale → refetch in background → UI doesn't flash
3. **Error recovery**: API returns error → error message shown → retry button works

### 4. Navigation Guards

- Is the route protected by middleware? (check `middleware.ts` matcher)
- Does the page handle unauthenticated state gracefully?
- Does the page preserve state on back/forward navigation?

### 5. Suspense Boundaries

- Does the route use React Suspense for streaming?
- Is there a `loading.tsx` file for the route?
- Is there an `error.tsx` file for the route?

## Output Format

```
## Route Preview: /dashboard/members

### File: src/app/(dashboard)/members/page.tsx
Status: ✅ Exists

### Data Fetching
- useQuery(['members']) — src/features/members/api/useMembers.ts
  - Loading: ✅ LoadingSkeleton rendered
  - Error: ⚠️ No error boundary, raw error shown
  - Empty: ❌ No empty state handling

### Route Guards
- Middleware: ✅ Protected (cookie check)
- Auth redirect: ✅ /login?redirect=/dashboard/members

### Suspense
- loading.tsx: ❌ Missing — Add loading skeleton
- error.tsx: ❌ Missing — Add error boundary

### Recommendations
1. Add `error.tsx` for graceful error handling
2. Add empty state UI when member list is empty
3. Consider adding `loading.tsx` for instant loading feedback
```
