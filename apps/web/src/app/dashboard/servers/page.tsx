import type { Metadata } from 'next';

import { ServersView } from './servers-view';

export const metadata: Metadata = {
  title: 'Servers',
};

export default function ServersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-hero">Servers</h1>
        <p className="mt-1 text-body text-text-muted">
          Manage the Discord servers MCDI syncs and enforces permissions for.
        </p>
      </div>
      <ServersView />
    </div>
  );
}
