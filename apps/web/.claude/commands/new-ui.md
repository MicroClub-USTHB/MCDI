# /new-ui — Generate a New UI Component

Generate a standard component folder with all required files following the MCDI-Front conventions.

## Usage

```
/new-ui <ComponentName> [--feature <feature-name>]
```

## What It Creates

### If `--feature` is provided (feature component):

```
src/features/<feature>/components/<ComponentName>/
├── <ComponentName>.tsx          # Component implementation
├── <ComponentName>.spec.tsx     # Vitest + RTL test file
└── index.ts                     # Barrel export
```

### If no `--feature` (shared component):

```
src/shared/components/<ComponentName>/
├── <ComponentName>.tsx          # Component implementation
├── <ComponentName>.spec.tsx     # Vitest + RTL test file
└── index.ts                     # Barrel export
```

## Templates

### Component File (`<ComponentName>.tsx`)

```tsx
'use client';

import { cn } from '@/shared/lib/utils';

interface <ComponentName>Props {
  className?: string;
}

export function <ComponentName>({ className }: <ComponentName>Props) {
  return (
    <div className={cn('', className)}>
      {/* TODO: Implement */}
    </div>
  );
}
```

### Test File (`<ComponentName>.spec.tsx`)

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { <ComponentName> } from './<ComponentName>';

describe('<ComponentName>', () => {
  it('renders without crashing', () => {
    render(<<ComponentName> />);
    // TODO: Add meaningful assertions
  });
});
```

### Barrel File (`index.ts`)

```ts
export { <ComponentName> } from './<ComponentName>';
```

## Rules

- Use `cn()` for all class merging
- Use design system tokens only (no hardcoded colors)
- Named export only (no `export default`)
- Add `'use client'` directive if the component uses hooks or browser APIs
- Follow the existing component patterns in `src/shared/components/common/`
