import { ProjectDetailView } from '@/app/dashboard/projects/[id]/project-detail-view';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDetailView id={id} />;
}
