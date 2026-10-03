import { ProjectRedirect } from '@/shared/components/layout/context-redirect';

/** Webhooks now live under a project: `/dashboard/projects/[id]/webhooks`. */
export default function WebhooksRedirectPage() {
  return <ProjectRedirect path="webhooks" />;
}
