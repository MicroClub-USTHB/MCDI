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
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';

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

  // Radix unmounts the dialog's *content* on close, but this component stays
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          {step === 'form' && (
            <>
              <DialogTitle>Create project</DialogTitle>
              <DialogDescription>
                Step 1 of 2 — create the project first, then set its redirect URI.
              </DialogDescription>
            </>
          )}
          {step === 'key' && (
            <>
              <DialogTitle>
                {createdWebhook ? 'Credentials generated' : 'API key created'}
              </DialogTitle>
              <DialogDescription>You&apos;ll set the redirect URI next.</DialogDescription>
            </>
          )}
          {step === 'redirect-uri' && (
            <>
              <DialogTitle>Set redirect URI</DialogTitle>
              <DialogDescription>Step 2 of 2 — done after this.</DialogDescription>
            </>
          )}
        </DialogHeader>

        {createError && step === 'form' && (
          <p className="rounded-md bg-error/12 p-3 text-body text-error">{createError}</p>
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
              <p className="rounded-md bg-error/12 p-3 text-body text-error">{redirectError}</p>
            )}
            <RedirectUriStep
              projectId={projectId}
              onSubmit={handleFinishRedirect}
              isSubmitting={redirectMutation.isPending}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateProjectButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className={className}>
        <Plus aria-hidden="true" />
        Create project
      </Button>
      <CreateProjectDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export { CreateProjectButton, CreateProjectDialog };
