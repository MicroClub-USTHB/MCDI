# Tailwind CSS Development Patterns

## Overview

Expert guide for building modern, responsive user interfaces with Tailwind CSS utility-first framework. Covers v4.1+ features including CSS-first configuration, custom utilities, and enhanced developer experience.

## MCID-Front Adaptation

This project uses **Tailwind CSS v4** with CSS-based configuration in `src/shared/styles/globals.css` and the mcoli-ui `primary` theme (light `:root` and dark `.dark` palettes). There is no `tailwind.config.ts` file. Prefer the `Mc*` components in `src/shared/components/ui` over hand-written markup; see the `tailwind-design-system` skill.

**Critical**: Use the mcoli-ui tokens (`bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`…). Both light and dark mode apply; tokens switch with the `dark` class, so do not add `dark:` classes just to change colours.

## When to Use

- Styling React/Next.js components with utility classes
- Building responsive layouts with breakpoints
- Implementing flexbox and grid layouts
- Managing spacing, colors, and typography
- Using the mcoli-ui theme tokens

## Core Concepts

### Utility-First with Design Tokens

Always use project design tokens, not Tailwind defaults:

```tsx
// CORRECT — uses MCID design tokens
<button className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium py-2 px-4 rounded-lg">
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

### MCID Component Patterns

Card:
```tsx
<div className="bg-card text-card-foreground border border-border rounded-lg p-4 shadow-sm">
  <h3 className="header-xs font-bold text-foreground">Title</h3>
  <p className="paragraph-sm text-muted-foreground mt-2">Description</p>
</div>
```

Button:
```tsx
<button className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium py-2 px-4 rounded-lg transition">
  Action
</button>
```

Input:
```tsx
<input className="w-full bg-input border border-border rounded-lg px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring outline-none" />
```

Nav link:
```tsx
<a className="text-foreground hover:text-primary transition">Link</a>
```

### Interactive States

```tsx
<button className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition">
  Button
</button>
```

### Focus Management

```tsx
<button className="focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring">
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
    <div className={cn('bg-card rounded-lg p-4 border border-border', className)} {...props} />
  );
}
```

## Best Practices for MCID

1. **Always use design tokens** — `bg-background` not `bg-[#0A0A0A]`
2. **Mobile-first** — base styles for mobile, add responsive prefixes
3. **4px grid** — use Tailwind spacing scale consistently
4. **`cn()` for merging** — never concatenate class strings manually
5. **No `dark:` classes for colour** — the tokens switch between light and dark on their own
6. **Semantic HTML** — proper elements with Tailwind classes
7. **`lucide-react` for icons** — not inline SVGs or other icon libraries
