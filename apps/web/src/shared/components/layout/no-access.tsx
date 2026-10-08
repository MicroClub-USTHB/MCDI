'use client';

import Link from 'next/link';
import { ShieldOff } from 'lucide-react';

import { useAuthStore } from '@/features/auth/stores/auth';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import type { Requirement } from '@/shared/lib/access';
import { describeRequirement } from '@/shared/lib/access-labels';

/** The dashboard for a member who holds no access at all. */
export function NoAccessYet() {
  const name = useAuthStore((state) => state.user?.name);

  return (
    <EmptyState
      icon={ShieldOff}
      title="No access yet"
      description={`${name ? `You are signed in as ${name}, but you` : 'You'} have not been given access to any part of MCDI. Ask an admin to grant your role access to what you need.`}
      action={
        <Button variant="secondary" size="sm" asChild>
          <Link href="/dashboard/settings">Open Settings</Link>
        </Button>
      }
    />
  );
}

interface AccessDeniedProps {
  /** What the page needs, or null for a page that is not in the route table. */
  requirement: Requirement | null;
  /** The first page the member can open. */
  href: string;
}

/** A page the member may not open: says what it needs and where they can go instead. */
export function AccessDenied({ requirement, href }: AccessDeniedProps) {
  return (
    <EmptyState
      icon={ShieldOff}
      title="You don’t have access to this page"
      description={
        requirement
          ? `It needs ${describeRequirement(requirement)}. Ask an admin if you should have it.`
          : 'This page is not available.'
      }
      action={
        <Button variant="secondary" size="sm" asChild>
          <Link href={href}>
            {href === '/dashboard' ? 'Go to the dashboard' : 'Go to a page you can use'}
          </Link>
        </Button>
      }
    />
  );
}
