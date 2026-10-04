import { ProjectAccessView } from './access-view';

export default async function ProjectAccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectAccessView projectId={id} />;
}
