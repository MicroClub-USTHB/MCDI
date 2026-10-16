import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { McCard, McCardContent } from '@/shared/components/ui/mc-card';

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
}

function SettingsSection({
  title,
  description,
  icon: Icon,
  action,
  children,
}: SettingsSectionProps) {
  return (
    <McCard>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="flex items-center gap-2 paragraph-md font-semibold text-foreground">
            {Icon ? <Icon className="size-4 text-primary" aria-hidden="true" /> : null}
            {title}
          </h3>
          {description ? <p className="paragraph-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <McCardContent className="flex flex-col gap-4">{children}</McCardContent>
    </McCard>
  );
}

export { SettingsSection, type SettingsSectionProps };
