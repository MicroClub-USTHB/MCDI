'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { MemberAccessEditor } from '@/features/access/components/MemberAccessEditor';
import { Button } from '@/shared/components/ui/button';

/** One member's access levels and overrides. Root only, and independent of the member detail page. */
export function MemberAccessView({ memberId }: { memberId: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
          <Link href="/dashboard/access">
            <ArrowLeft aria-hidden="true" />
            Access
          </Link>
        </Button>
        <h1 className="mt-2 text-hero text-text-primary">Member access</h1>
        <p className="mt-1 max-w-2xl text-body text-text-muted">
          What this person can do, and where it comes from. An override replaces what their roles
          grant for that area, for this person only.
        </p>
      </div>
      <MemberAccessEditor memberId={memberId} />
    </div>
  );
}
