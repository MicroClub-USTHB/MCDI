# MCDI V2 Design System — Tailwind Token Guide

## Overview

This skill documents the MCDI V2 design system built on Tailwind CSS v4 with CSS-first `@theme` configuration. The design system is Discord-inspired, dark-only, and uses a layered surface hierarchy.

**Source of truth**: `src/shared/styles/globals.css`

## Design Tokens

### Brand Colors (Discord Blurple)

| Token | Tailwind Class | Hex | Usage |
|---|---|---|---|
| `--color-brand` | `bg-brand`, `text-brand` | `#5865F2` | Primary actions, links, focus |
| `--color-brand-hover` | `bg-brand-hover` | `#4752C4` | Hover states |
| `--color-brand-active` | `bg-brand-active` | `#3C45A5` | Active/pressed |
| `--color-brand-light` | `bg-brand-light`, `text-brand-light` | `#8B9CFC` | Badges, accents |
| `--color-brand-tint` | `bg-brand-tint` | `rgba(88,101,242,0.15)` | Subtle backgrounds |

### Surface Colors (Layered Dark)

Use in order of elevation (lowest to highest):

| Token | Tailwind Class | Hex | Usage |
|---|---|---|---|
| `--color-surface-base` | `bg-surface-base` | `#1E1F22` | Page background |
| `--color-surface-raised` | `bg-surface-raised` | `#2B2D31` | Sidebar, cards |
| `--color-surface-main` | `bg-surface-main` | `#313338` | Main content, inputs |
| `--color-surface-hover` | `bg-surface-hover` | `#35363C` | Hover backgrounds |
| `--color-surface-active` | `bg-surface-active` | `#404249` | Selected items |
| `--color-surface-elevated` | `bg-surface-elevated` | `#4E5058` | Tooltips, dropdowns |

### Text Hierarchy

| Token | Tailwind Class | Hex | Usage |
|---|---|---|---|
| `--color-text-primary` | `text-text-primary` | `#F2F3F5` | Headings, important |
| `--color-text-normal` | `text-text-normal` | `#DBDEE1` | Body text |
| `--color-text-muted` | `text-text-muted` | `#B5BAC1` | Secondary |
| `--color-text-subtle` | `text-text-subtle` | `#949BA4` | Timestamps, labels |
| `--color-text-faint` | `text-text-faint` | `#6D6F78` | Disabled, placeholder |

### Semantic Colors

| Token | Tailwind Class | Hex | Usage |
|---|---|---|---|
| `--color-success` | `bg-success`, `text-success` | `#23A559` | Success states |
| `--color-error` | `bg-error`, `text-error` | `#DA373C` | Error states |
| `--color-warning` | `bg-warning`, `text-warning` | `#F0B232` | Warnings |
| `--color-info` | `bg-info`, `text-info` | `#5865F2` | Info (same as brand) |
| `--color-accent` | `bg-accent`, `text-accent` | `#EB459E` | Accent/pink |

### Border Colors

| Token | Tailwind Class | Hex | Usage |
|---|---|---|---|
| `--color-border` | `border-border` | `#3F4147` | Default borders |
| `--color-border-hover` | `border-border-hover` | `#4E5058` | Hover borders |
| `--color-border-focus` | `border-border-focus` | `#5865F2` | Focus rings |

### Shadows (Elevation Scale)

| Token | Tailwind Class | Usage |
|---|---|---|
| `--shadow-xs` | `shadow-xs` | Subtle depth |
| `--shadow-sm` | `shadow-sm` | Cards |
| `--shadow-md` | `shadow-md` | Dropdowns |
| `--shadow-lg` | `shadow-lg` | Modals |
| `--shadow-xl` | `shadow-xl` | Overlays |

### Border Radius

| Token | Tailwind Class | Value |
|---|---|---|
| `--radius-sm` | `rounded-sm` | 4px |
| `--radius-md` | `rounded-md` | 6px |
| `--radius` | `rounded` | 8px (default) |
| `--radius-lg` | `rounded-lg` | 12px |

### Typography

- **Body/Headings**: DM Sans (`font-sans` / `--font-dm-sans`)
- **Code/Data**: JetBrains Mono (`font-mono` / `--font-jetbrains-mono`)

## Component Recipes

### Card

```tsx
<div className="bg-surface-raised border border-border rounded-lg p-4 shadow-sm">
  <h3 className="text-text-primary font-semibold">Title</h3>
  <p className="text-text-muted text-sm mt-1">Description</p>
</div>
```

### Primary Button

```tsx
<button className="bg-brand hover:bg-brand-hover active:bg-brand-active text-white font-medium rounded px-4 py-2 transition focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base">
  Action
</button>
```

### Ghost Button

```tsx
<button className="bg-transparent hover:bg-surface-hover text-text-normal font-medium rounded px-4 py-2 transition">
  Cancel
</button>
```

### Text Input

```tsx
<input className="w-full bg-surface-main border border-border rounded px-3 py-2 text-text-normal placeholder:text-text-faint focus:border-border-focus focus:ring-2 focus:ring-brand/20 outline-none transition" />
```

### Sidebar Item

```tsx
<a className={cn(
  'flex items-center gap-3 px-3 py-2 rounded text-sm transition',
  isActive
    ? 'bg-surface-active text-text-primary'
    : 'text-text-muted hover:bg-surface-hover hover:text-text-normal'
)}>
  <Icon className="h-5 w-5" />
  <span>Label</span>
</a>
```

### Badge

```tsx
<span className="inline-flex items-center rounded-full bg-brand-tint text-brand-light text-xs font-medium px-2 py-0.5">
  Active
</span>
```

### Status Indicator

```tsx
<span className="inline-flex items-center gap-1.5 text-sm">
  <span className="h-2 w-2 rounded-full bg-success" />
  <span className="text-text-muted">Online</span>
</span>
```

### Table Row

```tsx
<tr className="border-b border-border hover:bg-surface-hover transition">
  <td className="px-4 py-3 text-text-normal">Data</td>
  <td className="px-4 py-3 text-text-muted">Secondary</td>
</tr>
```

## Rules

1. **Never hardcode colors** — always use token-based Tailwind classes
2. **Never use `dark:` prefixes** — the app is permanently dark
3. **Surface hierarchy matters** — lower layers are darker, higher layers are lighter
4. **Every background needs appropriate text** — match text hierarchy to surface
5. **Use `cn()` for all conditional classes** — from `@/shared/lib/utils`
6. **Icons from `lucide-react` only** — consistent icon language
7. **4px spacing grid** — stick to Tailwind's default spacing scale
8. **Transitions on interactive elements** — `transition` class on hover/focus targets
