# Vercel React Best Practices

Comprehensive performance optimization guide for React and Next.js applications. Contains 64 rules across 8 categories, prioritized by impact.

## When to Apply

Reference these guidelines when:
- Writing new React components or Next.js pages
- Implementing data fetching (client or server-side)
- Reviewing code for performance issues
- Refactoring existing React/Next.js code
- Optimizing bundle size or load times

## Rules by Priority

### 1. Eliminating Waterfalls (CRITICAL)

- **async-defer-await**: Move `await` into branches where actually used
- **async-parallel**: Use `Promise.all()` for independent operations
- **async-suspense-boundaries**: Use Suspense to stream content

```tsx
// BAD — sequential
const users = await getUsers();
const posts = await getPosts();

// GOOD — parallel
const [users, posts] = await Promise.all([getUsers(), getPosts()]);
```

### 2. Bundle Size Optimization (CRITICAL)

- **bundle-barrel-imports**: Import directly, avoid barrel files for large libraries
- **bundle-dynamic-imports**: Use `next/dynamic` for heavy components
- **bundle-defer-third-party**: Load analytics/logging after hydration
- **bundle-conditional**: Load modules only when feature is activated

```tsx
// BAD
import { Chart } from '@/components';

// GOOD — dynamic import
import dynamic from 'next/dynamic';
const Chart = dynamic(() => import('@/components/Chart'), {
  loading: () => <LoadingSkeleton variant="rectangular" height={400} />,
});
```

### 3. Server-Side Performance (HIGH)

- **server-cache-react**: Use `React.cache()` for per-request deduplication
- **server-dedup-props**: Avoid duplicate serialization in RSC props
- **server-parallel-fetching**: Restructure components to parallelize fetches
- **server-serialization**: Minimize data passed to client components
- **server-after-nonblocking**: Use `after()` for non-blocking operations

### 4. Client-Side Data Fetching (MEDIUM-HIGH)

- **client-swr-dedup**: Use React Query / SWR for automatic request deduplication
- **client-passive-event-listeners**: Use passive listeners for scroll/touch
- **client-localstorage-schema**: Version and minimize localStorage data

This project uses **TanStack React Query** for server state:
```tsx
export function useServers() {
  return useQuery({
    queryKey: ['servers'],
    queryFn: () => apiClient.get<Server[]>('/servers'),
  });
}
```

### 5. Re-render Optimization (MEDIUM)

- **rerender-defer-reads**: Don't subscribe to state only used in callbacks
- **rerender-memo**: Extract expensive work into memoized components
- **rerender-derived-state**: Subscribe to derived booleans, not raw values
- **rerender-derived-state-no-effect**: Derive state during render, not effects
- **rerender-functional-setstate**: Use functional setState for stable callbacks
- **rerender-lazy-state-init**: Pass function to useState for expensive values
- **rerender-no-inline-components**: Don't define components inside components
- **rerender-transitions**: Use `startTransition` for non-urgent updates

```tsx
// BAD — inline component
function Parent() {
  const InlineChild = () => <div>re-created every render</div>;
  return <InlineChild />;
}

// GOOD — separate component
function Child() {
  return <div>stable identity</div>;
}
function Parent() {
  return <Child />;
}
```

### 6. Rendering Performance (MEDIUM)

- **rendering-content-visibility**: Use `content-visibility: auto` for long lists
- **rendering-hoist-jsx**: Extract static JSX outside components
- **rendering-conditional-render**: Use ternary, not `&&` for conditionals
- **rendering-hydration-no-flicker**: Use inline script for client-only data

```tsx
// BAD — can render 0 or false
{count && <Badge count={count} />}

// GOOD — explicit boolean
{count > 0 ? <Badge count={count} /> : null}
```

### 7. JavaScript Performance (LOW-MEDIUM)

- **js-batch-dom-css**: Group CSS changes via classes or cssText
- **js-index-maps**: Build Map for repeated lookups
- **js-set-map-lookups**: Use Set/Map for O(1) lookups
- **js-combine-iterations**: Combine multiple filter/map into one loop
- **js-early-exit**: Return early from functions

### 8. Advanced Patterns (LOW)

- **advanced-init-once**: Initialize app once per app load
- **advanced-use-latest**: `useLatest` for stable callback refs

## MCDI-Specific Guidance

1. **Server Components by default** — only add `'use client'` when needed (hooks, event handlers, browser APIs)
2. **React Query for all API data** — never use raw `fetch` in client components; use the `apiClient` singleton
3. **Zustand for client-only state** — auth, sidebar, UI preferences
4. **Dynamic imports for feature pages** — lazy load heavy dashboard features
5. **No barrel imports from large packages** — import specific Radix components directly
