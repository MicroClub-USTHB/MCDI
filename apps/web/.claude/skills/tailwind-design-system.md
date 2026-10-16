# MCID Design System: mcoli-ui on Tailwind v4

## Overview

MCID uses [mcoli-ui](https://mcoli-ui.microclub.info/docs/introduction), the Micro Club design system, with its `primary` theme: a deep blue primary with purple accents, DM Sans for text and Plus Jakarta Sans for headings. mcoli-ui is a shadcn registry built on Base UI. Its components are copied into `src/shared/components/ui/mc-*.tsx`; the theme lives in `src/shared/styles/globals.css` (Tailwind v4, CSS-first, no `tailwind.config.ts`).

## Theme

`npx mcoli-ui@latest init primary` writes:
- a light palette under `:root` and a dark palette under `.dark`,
- the Tailwind colour mapping in an `@theme inline` block,
- the type utilities `header-xl`…`header-xs` and `paragraph-xl`…`paragraph-xs`.

Re-run the command to update the theme rather than editing those blocks. `next-themes` sets the `dark` class on `<html>` from the system setting or the ThemeToggle, and every token switches with it.

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` / `foreground` | `#FFFFFF` / `#000350` | `#0A0A0A` / `#FAFAFA` | Page and body text |
| `primary` / `primary-foreground` | `#0006B1` / `#FFFFFF` | `#D9DDFF` / `#000350` | Main actions, active nav, focus |
| `secondary` / `secondary-foreground` | `#E6E9FF` / `#000585` | `#262626` / `#FAFAFA` | Secondary actions, tinted chips |
| `card`, `popover` | `#FFFFFF` | `#171717` | Cards, menus, dialogs |
| `muted` / `muted-foreground` | `#F9FAFF` / `#54588B` | `#262626` / `#A1A1A1` | Quiet surfaces, secondary text |
| `border`, `input`, `ring` | `#E6E9FF`, `#F9FAFF`, `#D9DDFF` | `#262626`, `#343434`, `#D9DDFF` | Lines, fields, focus rings |
| `success`, `warning`, `error`/`destructive`, `info` | green, orange, red, blue | same | States |
| `sidebar-*` | | | The navigation sidebar |
| `chart-1`…`chart-5` | blue ramp | blue ramp | Data series |

## Components

| Need | Component |
|---|---|
| Buttons | `McButton` (`primary`, `secondary`, `tertiary`, `link`, `destructive`), `buttonVariants` for a `<Link>` that looks like a button |
| Forms | `McInput`, `McTextarea`, `McSelect`, `McCombobox`, `McCheckbox`, `McRadioGroup`, `McSwitch` |
| Layout | `McCard`, `McTabs`, `McSeparator`, `McSidebar`, `McBreadcrumb`, `McScrollArea` |
| Overlays | `McDialog`, `McAlertDialog`, `McDrawer`, `McPopover`, `McTooltip`, `McDropdownMenu` |
| Feedback | `McBadge`, `McAlert`, `McProgress`, `McSkeleton`, toasts via `showToast()` |
| Data | `DataTable` (TanStack Table v9 on `mc-data-table`), `Pagination`, `StatCard`, `EmptyState` |

Add one with `npx mcoli-ui@latest add <name>`; `npx mcoli-ui@latest list` prints the catalogue.

## Rules

1. **Never hardcode colours**: use token classes.
2. **Build from `Mc*` components** before writing markup by hand.
3. **Check light and dark**: tokens switch on their own; do not add `dark:` classes just for colour.
4. **Base UI composes with `render`, not `asChild`**. A link that looks like a button is `<Link className={buttonVariants({ variant, size })}>`.
5. **`McSelect` needs `items`** (`{ value, label }`) so the trigger shows the label.
6. **Headings use `header-*` with `font-bold`, text uses `paragraph-*`**, ids and code use `font-mono`.
7. **Use `cn()`** for conditional classes; **icons come from `lucide-react`**.
