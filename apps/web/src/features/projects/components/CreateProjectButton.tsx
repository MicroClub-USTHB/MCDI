'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import {
  ApiKeyRevealPanel,
  type InboundWebhookRevealInfo,
} from '@/features/projects/components/ApiKeyRevealModal';
import { ProjectForm } from '@/features/projects/components/ProjectForm';
import { RedirectUriStep } from '@/features/projects/components/RedirectUriStep';
import { toCreateProjectDto } from '@/features/projects/api/mappers';
import {
  useCreateProjectMutation,
  useUpdateRedirectUriMutation,
} from '@/features/projects/api/mutations';
import type { ProjectFormValues } from '@/features/projects/types';
import { McAlert } from '@/shared/components/ui/mc-alert';
import { McButton } from '@/shared/components/ui/mc-button';
import {
  McDialog,
  McDialogContent,
  McDialogDescription,
  McDialogHeader,
  McDialogTitle,
} from '@/shared/components/ui/mc-dialog';

type WizardStep = 'form' | 'key' | 'redirect-uri';

function getMutationError(mutation: { error: unknown }): string | undefined {
  const error = mutation.error;
  if (!error) return undefined;
  return typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message: string }).message)
    : 'Something went wrong. Please try again.';
}

function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const createMutation = useCreateProjectMutation();
  const redirectMutation = useUpdateRedirectUriMutation();

  const [step, setStep] = useState<WizardStep>('form');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [createdWebhook, setCreatedWebhook] = useState<InboundWebhookRevealInfo | null>(null);

  // The dialog unmounts the dialog's *content* on close, but this component stays
  // mounted, so reset the flow from a render-phase prop diff (no effect) to
  // keep each open a fresh wizard.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep('form');
      setProjectId(null);
      setApiKey(null);
      setCreatedWebhook(null);
    }
  }

  function handleCreate(values: ProjectFormValues) {
    createMutation.mutate(toCreateProjectDto(values), {
      onSuccess: (response) => {
        setApiKey(response.data.apiKey);
        setProjectId(response.data.project.id);
        if (response.data.inboundWebhook) {
          setCreatedWebhook({
            signingSecret: response.data.inboundWebhook.signingSecret,
            submitUrl: response.data.inboundWebhook.submitUrl,
            webhookName: response.data.inboundWebhook.webhook.name,
          });
        } else {
          setCreatedWebhook(null);
        }
        setStep('key');
      },
    });
  }

  function handleFinishRedirect(redirectUri: string) {
    if (!projectId) return;
    redirectMutation.mutate(
      { id: projectId, redirectUri },
      {
        onSuccess: () => {
          onOpenChange(false);
          router.push(`/dashboard/projects/${projectId}`);
        },
      }
    );
  }

  const createError = getMutationError(createMutation);
  const redirectError = getMutationError(redirectMutation);

  return (
    <McDialog open={open} onOpenChange={onOpenChange}>
      <McDialogContent className="max-h-[90vh] overflow-y-auto sm:w-[min(32rem,calc(100%-2rem))]">
        <McDialogHeader>
          {step === 'form' && (
            <>
              <McDialogTitle>Create project</McDialogTitle>
              <McDialogDescription>
                Step 1 of 2 — create the project first, then set its redirect URI.
              </McDialogDescription>
            </>
          )}
          {step === 'key' && (
            <>
              <McDialogTitle>
                {createdWebhook ? 'Credentials generated' : 'API key created'}
              </McDialogTitle>
              <McDialogDescription>You&apos;ll set the redirect URI next.</McDialogDescription>
            </>
          )}
          {step === 'redirect-uri' && (
            <>
              <McDialogTitle>Set redirect URI</McDialogTitle>
              <McDialogDescription>Step 2 of 2 — done after this.</McDialogDescription>
            </>
          )}
        </McDialogHeader>

        {createError && step === 'form' && (
          <McAlert variant="destructive" title={createError} className="w-full max-w-none" />
        )}

        {step === 'form' && (
          <ProjectForm
            mode="create"
            onSubmit={handleCreate}
            isSubmitting={createMutation.isPending}
          />
        )}

        {step === 'key' && apiKey && (
          <ApiKeyRevealPanel
            apiKey={apiKey}
            projectName="the project"
            inboundWebhook={createdWebhook}
            onContinue={() => setStep('redirect-uri')}
          />
        )}

        {step === 'redirect-uri' && projectId && (
          <>
            {redirectError && (
              <McAlert variant="destructive" title={redirectError} className="w-full max-w-none" />
            )}
            <RedirectUriStep
              projectId={projectId}
              onSubmit={handleFinishRedirect}
              isSubmitting={redirectMutation.isPending}
            />
          </>
        )}
      </McDialogContent>
    </McDialog>
  );
}

function CreateProjectButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <McButton
        type="button"
        icon="leading"
        iconDefinition={<Plus aria-hidden="true" />}
        onClick={() => setOpen(true)}
        className={className}
      >
        Create project
      </McButton>
      <CreateProjectDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export { CreateProjectButton, CreateProjectDialog };
