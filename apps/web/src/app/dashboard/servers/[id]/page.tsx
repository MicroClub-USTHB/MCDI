import type { Metadata } from 'next';

import { ServerDetailView } from './server-detail-view';

export const metadata: Metadata = {
  title: 'Server Details',
};

export default async function ServerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <ServerDetailView id={id} />;
}
