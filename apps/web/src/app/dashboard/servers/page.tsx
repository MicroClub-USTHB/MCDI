import type { Metadata } from 'next';

import { ServersView } from './servers-view';

export const metadata: Metadata = {
  title: 'Servers',
};

export default function ServersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="header-xs font-bold">Servers</h1>
        <p className="mt-1 paragraph-sm text-muted-foreground">
          Manage the Discord servers MCID syncs and enforces permissions for.
        </p>
      </div>
      <ServersView />
    </div>
  );
}
