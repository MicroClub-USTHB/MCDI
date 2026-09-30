'use client';

import { useState } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';

import {
  CacheSettings,
  DiscordConfigForm,
  PreferencesSettings,
  ProfileSettings,
  RateLimitSettings,
  useProfileQuery,
  useResetSettingsMutation,
  useSettingsQuery,
  useUpdateProfileMutation,
  useUpdateSettingsMutation,
} from '@/features/settings';
import { formatAbsoluteTime, formatRelativeTime } from '@/features/sync';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { SkeletonCard } from '@/shared/components/common';
import { useToastStore } from '@/shared/stores/toast';

function SettingsPage() {
  const showToast = useToastStore((state) => state.show);
  const [resetOpen, setResetOpen] = useState(false);

  const settingsQuery = useSettingsQuery();
  const profileQuery = useProfileQuery();

  const updateSettingsMutation = useUpdateSettingsMutation();
  const resetSettingsMutation = useResetSettingsMutation();
  const updateProfileMutation = useUpdateProfileMutation();

  function handleSaveSettings(payload: Parameters<typeof updateSettingsMutation.mutate>[0]) {
    updateSettingsMutation.mutate(payload, {
      onSuccess: () => showToast('Settings saved', 'success'),
      onError: (error) => showToast(error.message || 'Failed to save settings', 'error'),
    });
  }

  function handleReset() {
    resetSettingsMutation.mutate(undefined, {
      onSuccess: () => {
        showToast('Settings reset to defaults', 'success');
        setResetOpen(false);
      },
      onError: (error) => showToast(error.message || 'Failed to reset settings', 'error'),
    });
  }

  const settings = settingsQuery.data;
  const isError = settingsQuery.isError || profileQuery.isError;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-overline text-brand-light uppercase">Operations</p>
          <h1 className="mt-1 text-hero text-text-primary">Settings</h1>
          <p className="mt-1 max-w-2xl text-body text-text-muted">
            Configure MCDI behavior and manage your admin profile.
          </p>
          {settings?.meta.updatedAt ? (
            <p
              className="mt-1 text-overline text-text-faint"
              title={formatAbsoluteTime(settings.meta.updatedAt) ?? undefined}
            >
              Last changed {formatRelativeTime(settings.meta.updatedAt)}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setResetOpen(true)}
          disabled={settingsQuery.isPending}
        >
          <RotateCcw aria-hidden="true" /> Reset to defaults
        </Button>
      </header>

      {isError ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-6 text-body text-error">
            <p>Settings could not be loaded.</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void settingsQuery.refetch();
                void profileQuery.refetch();
              }}
            >
              <RefreshCw aria-hidden="true" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : settingsQuery.isPending || profileQuery.isPending || !settings ? (
        <div className="columns-1 gap-4 lg:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonCard key={index} showAvatar={false} lines={3} />
          ))}
        </div>
      ) : (
        <div className="columns-1 gap-4 lg:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
          {profileQuery.data ? (
            <ProfileSettings
              profile={profileQuery.data}
              isSaving={updateProfileMutation.isPending}
              onSave={(payload) =>
                updateProfileMutation.mutate(payload, {
                  onSuccess: () => showToast('Profile saved', 'success'),
                  onError: (error) => showToast(error.message || 'Failed to save profile', 'error'),
                })
              }
            />
          ) : null}

          <DiscordConfigForm config={settings.discord} />

          <CacheSettings
            settings={settings.cache}
            isSaving={updateSettingsMutation.isPending}
            onSave={handleSaveSettings}
          />

          <RateLimitSettings
            limits={settings.rateLimit}
            isSaving={updateSettingsMutation.isPending}
            onSave={handleSaveSettings}
          />

          <PreferencesSettings
            preferences={settings.preferences}
            isSaving={updateSettingsMutation.isPending}
            onSave={handleSaveSettings}
          />
        </div>
      )}

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset settings to defaults?"
        description="Clears every stored override — cache TTLs, rate limits, and preferences — back to their environment defaults. Discord configuration is untouched."
        confirmLabel="Reset"
        variant="destructive"
        isConfirming={resetSettingsMutation.isPending}
        onConfirm={handleReset}
      />
    </div>
  );
}

export default SettingsPage;
