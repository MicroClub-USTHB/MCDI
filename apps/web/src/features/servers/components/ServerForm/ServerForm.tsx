'use client';

import { useState } from 'react';

import { McBadge } from '@/shared/components/ui/mc-badge';
import { McButton } from '@/shared/components/ui/mc-button';
import { McInput } from '@/shared/components/ui/mc-input';
import {
  McSelect,
  McSelectContent,
  McSelectItem,
  McSelectTrigger,
  McSelectValue,
} from '@/shared/components/ui/mc-select';
import { McSwitch } from '@/shared/components/ui/mc-switch';
import { useCan } from '@/shared/lib/use-access';
import type { CreateServerPayload, ServerDto, UpdateServerPayload } from '@/features/servers/types';
import {
  createServerSchema,
  type CreateServerFormErrors,
  type CreateServerFormValues,
} from './ServerForm.schema';

type ServerFormProps =
  | {
      mode: 'create';
      server?: undefined;
      onSubmit: (payload: CreateServerPayload) => void | Promise<void>;
      isSubmitting?: boolean;
    }
  | {
      mode: 'edit';
      server: ServerDto;
      onSubmit: (payload: UpdateServerPayload) => void | Promise<void>;
      isSubmitting?: boolean;
    };

const TYPE_ITEMS: { value: CreateServerFormValues['type']; label: string }[] = [
  { value: 'main', label: 'Main' },
  { value: 'competition', label: 'Competition' },
  { value: 'event', label: 'Event' },
  { value: 'other', label: 'Other' },
];

const POLICY_ITEMS: { value: CreateServerFormValues['defaultPermissionPolicy']; label: string }[] =
  [
    { value: 'deny_all', label: 'Deny all' },
    { value: 'allow_all', label: 'Allow all' },
    { value: 'custom', label: 'Custom' },
  ];

const LABEL_CLASS = 'text-sm font-medium text-muted-foreground';
const SELECT_CONTENT_CLASS = 'h-auto max-h-80 w-(--anchor-width)';

const DEFAULT_VALUES: CreateServerFormValues = {
  guildId: '',
  name: '',
  type: 'other',
  isMain: false,
  syncFrequencyHours: 1,
  defaultPermissionPolicy: 'deny_all',
};

function valuesFromServer(server: ServerDto): CreateServerFormValues {
  return {
    guildId: server.id,
    name: server.name,
    type: server.type,
    isMain: server.isMain,
    syncFrequencyHours: server.syncFrequencyHours,
    defaultPermissionPolicy: server.defaultPermissionPolicy,
  };
}

/**
 * The backend 409s if `isMain: false` is sent for the current main server —
 * you can only unset it by setting a *different* server as main instead. The
 * "Is Main" switch is locked (disabled, checked) in that case rather than
 * letting the user submit a request the backend will always reject.
 */
function ServerForm(props: ServerFormProps) {
  const { isSubmitting = false } = props;
  const canWrite = useCan('servers', 'write');
  // Editing needs write; the create form is only reachable through the (gated) Add button.
  const readOnly = props.mode === 'edit' && !canWrite;
  const [values, setValues] = useState<CreateServerFormValues>(() =>
    props.mode === 'edit' ? valuesFromServer(props.server) : DEFAULT_VALUES
  );
  const [errors, setErrors] = useState<CreateServerFormErrors>({});
  const isMainLocked = props.mode === 'edit' && props.server.isMain === true;

  function setField<K extends keyof CreateServerFormValues>(
    key: K,
    value: CreateServerFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const result = createServerSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: CreateServerFormErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof CreateServerFormValues | undefined;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});

    if (props.mode === 'edit') {
      const payload: UpdateServerPayload = {
        name: result.data.name || undefined,
        type: result.data.type,
        isMain: isMainLocked ? true : result.data.isMain,
        syncFrequencyHours: result.data.syncFrequencyHours,
        defaultPermissionPolicy: result.data.defaultPermissionPolicy,
      };
      void props.onSubmit(payload);
      return;
    }

    const payload: CreateServerPayload = {
      guildId: result.data.guildId,
      name: result.data.name || undefined,
      type: result.data.type,
      isMain: result.data.isMain,
      syncFrequencyHours: result.data.syncFrequencyHours,
      defaultPermissionPolicy: result.data.defaultPermissionPolicy,
    };
    void props.onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4 border-0 p-0">
        <McInput
          id="guildId"
          label="Discord Guild ID"
          value={values.guildId}
          onChange={(event) => setField('guildId', event.target.value)}
          placeholder="123456789012345678"
          disabled={props.mode === 'edit'}
          error={errors.guildId}
        />

        <McInput
          id="name"
          label="Server Name"
          value={values.name}
          onChange={(event) => setField('name', event.target.value)}
          placeholder="Auto-filled from Discord"
          error={errors.name}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="type" className={LABEL_CLASS}>
            Server Type
          </label>
          <McSelect
            items={TYPE_ITEMS}
            value={values.type}
            onValueChange={(value) => {
              if (value) setField('type', value);
            }}
            disabled={readOnly}
          >
            <McSelectTrigger id="type" className="w-full">
              <McSelectValue />
            </McSelectTrigger>
            <McSelectContent className={SELECT_CONTENT_CLASS}>
              {TYPE_ITEMS.map((item) => (
                <McSelectItem key={item.value} value={item.value}>
                  {item.label}
                </McSelectItem>
              ))}
            </McSelectContent>
          </McSelect>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="isMain" className={LABEL_CLASS}>
              Is Main Server
            </label>
            <McSwitch
              id="isMain"
              checked={isMainLocked ? true : values.isMain}
              disabled={isMainLocked || readOnly}
              onCheckedChange={(checked) => setField('isMain', checked)}
            />
          </div>
          {isMainLocked && (
            <p className="paragraph-sm text-muted-foreground">
              To change the main server, set a different server as main from its own edit page.
            </p>
          )}
        </div>

        <McInput
          id="syncFrequencyHours"
          label="Sync Frequency (hours)"
          type="number"
          min={1}
          max={24}
          value={values.syncFrequencyHours}
          onChange={(event) => setField('syncFrequencyHours', Number(event.target.value))}
          error={errors.syncFrequencyHours}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="defaultPermissionPolicy" className={LABEL_CLASS}>
            Default Permission Policy
          </label>
          <McSelect
            items={POLICY_ITEMS}
            value={values.defaultPermissionPolicy}
            onValueChange={(value) => {
              if (value) setField('defaultPermissionPolicy', value);
            }}
            disabled={readOnly}
          >
            <McSelectTrigger id="defaultPermissionPolicy" className="w-full">
              <McSelectValue />
            </McSelectTrigger>
            <McSelectContent className={SELECT_CONTENT_CLASS}>
              {POLICY_ITEMS.map((item) => (
                <McSelectItem key={item.value} value={item.value}>
                  {item.label}
                </McSelectItem>
              ))}
            </McSelectContent>
          </McSelect>
        </div>
      </fieldset>

      {readOnly ? (
        <McBadge variant="outline" className="self-start">
          Read only
        </McBadge>
      ) : (
        <McButton type="submit" variant="primary" disabled={isSubmitting} className="mt-2">
          {props.mode === 'create' ? 'Add Server' : 'Save Changes'}
        </McButton>
      )}
    </form>
  );
}

export { ServerForm, type ServerFormProps };
