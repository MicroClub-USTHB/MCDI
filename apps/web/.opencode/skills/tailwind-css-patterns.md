# Tailwind CSS Development Patterns

## Overview

Expert guide for building modern, responsive user interfaces with Tailwind CSS utility-first framework. Covers v4.1+ features including CSS-first configuration, custom utilities, and enhanced developer experience.

## MCDI-Front Adaptation

This project uses **Tailwind CSS v4** with CSS-based `@theme` configuration in `src/shared/styles/globals.css`. There is no `tailwind.config.ts` file. All design tokens are defined as CSS custom properties in the `@theme` block.

**Critical**: This project is **dark-only**. Never use `dark:` prefixed classes. Never use light-mode color tokens. All colors come from the V2 Discord-inspired design system tokens.

## When to Use

- Styling React/Next.js components with utility classes
- Building responsive layouts with breakpoints
- Implementing flexbox and grid layouts
- Managing spacing, colors, and typography
- Using the MCDI V2 design system tokens

## Core Concepts

### Utility-First with Design Tokens

Always use project design tokens, not Tailwind defaults:

```tsx
// CORRECT — uses MCDI design tokens
<button className="bg-brand hover:bg-brand-hover text-white font-medium py-2 px-4 rounded">
  Click me
</button>

// WRONG — uses Tailwind default colors
<button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
  Click me
</button>
```

### Responsive Design (Mobile-First)

Breakpoint prefixes: `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px), `2xl:` (1536px)

```tsx
<div className="w-full md:w-1/2 lg:w-1/3">
  Responsive width
</div>
```

### Layout Utilities

Flexbox:
```tsx
<div className="flex items-center justify-between gap-4">
  <div>Left</div>
  <div>Right</div>
</div>
```

Grid:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
  <div>Item</div>
</div>
```

### Spacing (4px Grid)

Use Tailwind's spacing scale aligned with the 4px grid:
- `p-1` = 4px, `p-2` = 8px, `p-3` = 12px, `p-4` = 16px
- `gap-1` = 4px, `gap-2` = 8px, etc.

### MCDI Component Patterns

Card:
```tsx
<div className="bg-surface-raised border border-border rounded-lg p-4 shadow-sm">
  <h3 className="text-lg font-semibold text-text-primary">Title</h3>
  <p className="text-text-muted mt-2">Description</p>
</div>
```

Button:
```tsx
<button className="bg-brand hover:bg-brand-hover active:bg-brand-active text-white font-medium py-2 px-4 rounded transition">
  Action
</button>
```

Input:
```tsx
<input className="w-full bg-surface-main border border-border rounded px-3 py-2 text-text-normal placeholder:text-text-faint focus:border-border-focus focus:ring-2 focus:ring-brand/20 outline-none" />
```

Nav link:
```tsx
<a className="text-text-normal hover:text-brand transition">Link</a>
```

### Interactive States

```tsx
<button className="bg-brand hover:bg-brand-hover active:bg-brand-active disabled:opacity-50 disabled:cursor-not-allowed transition">
  Button
</button>
```

### Focus Management

```tsx
<button className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base">
  Accessible Button
</button>
```

### Animations

```tsx
<div className="animate-pulse">Loading...</div>
<div className="animate-shimmer">Skeleton</div>
<div className="transform hover:scale-105 transition duration-300">Hover me</div>
```

### Class Merging

Always use `cn()` from `@/shared/lib/utils`:
```tsx
import { cn } from '@/shared/lib/utils';

function Card({ className, ...props }) {
  return (
    <div className={cn('bg-surface-raised rounded-lg p-4 border border-border', className)} {...props} />
  );
}
```

## Best Practices for MCDI

1. **Always use design tokens** — `bg-surface-base` not `bg-[#1E1F22]`
2. **Mobile-first** — base styles for mobile, add responsive prefixes
3. **4px grid** — use Tailwind spacing scale consistently
4. **`cn()` for merging** — never concatenate class strings manually
5. **No `dark:` classes** — the app is dark-only
6. **Semantic HTML** — proper elements with Tailwind classes
7. **`lucide-react` for icons** — not inline SVGs or other icon libraries
