'use client';

import { useState } from 'react';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="guildId">Discord Guild ID</Label>
        <Input
          id="guildId"
          value={values.guildId}
          onChange={(event) => setField('guildId', event.target.value)}
          placeholder="123456789012345678"
          disabled={props.mode === 'edit'}
          aria-invalid={!!errors.guildId}
        />
        {errors.guildId && <p className="text-body text-error">{errors.guildId}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Server Name</Label>
        <Input
          id="name"
          value={values.name}
          onChange={(event) => setField('name', event.target.value)}
          placeholder="Auto-filled from Discord"
          aria-invalid={!!errors.name}
        />
        {errors.name && <p className="text-body text-error">{errors.name}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="type">Server Type</Label>
        <Select
          value={values.type}
          onValueChange={(value) => setField('type', value as CreateServerFormValues['type'])}
        >
          <SelectTrigger id="type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="main">Main</SelectItem>
            <SelectItem value="competition">Competition</SelectItem>
            <SelectItem value="event">Event</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="isMain">Is Main Server</Label>
          <Switch
            id="isMain"
            checked={isMainLocked ? true : values.isMain}
            disabled={isMainLocked}
            onCheckedChange={(checked) => setField('isMain', checked)}
          />
        </div>
        {isMainLocked && (
          <p className="text-body text-text-muted">
            To change the main server, set a different server as main from its own edit page.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="syncFrequencyHours">Sync Frequency (hours)</Label>
        <Input
          id="syncFrequencyHours"
          type="number"
          min={1}
          max={24}
          value={values.syncFrequencyHours}
          onChange={(event) => setField('syncFrequencyHours', Number(event.target.value))}
          aria-invalid={!!errors.syncFrequencyHours}
        />
        {errors.syncFrequencyHours && (
          <p className="text-body text-error">{errors.syncFrequencyHours}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="defaultPermissionPolicy">Default Permission Policy</Label>
        <Select
          value={values.defaultPermissionPolicy}
          onValueChange={(value) =>
            setField(
              'defaultPermissionPolicy',
              value as CreateServerFormValues['defaultPermissionPolicy']
            )
          }
        >
          <SelectTrigger id="defaultPermissionPolicy">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="deny_all">Deny all</SelectItem>
            <SelectItem value="allow_all">Allow all</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-2">
        {props.mode === 'create' ? 'Add Server' : 'Save Changes'}
      </Button>
    </form>
  );
}

export { ServerForm, type ServerFormProps };
