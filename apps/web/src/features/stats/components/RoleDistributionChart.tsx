import type { CSSProperties } from 'react';
import { useState } from 'react';
import type { FocusEvent, MouseEvent } from 'react';

import type { RoleStats } from '@/features/stats/types';

interface RoleDistributionChartProps {
  stats: RoleStats;
}

const roleColors = [
  'var(--color-brand)',
  'var(--color-brand-light)',
  'var(--color-accent)',
  'var(--color-warning)',
  'var(--color-success)',
];

function getDonutPath(startPercentage: number, endPercentage: number, innerRadius: number) {
  const startAngle = (startPercentage / 100) * Math.PI * 2 - Math.PI / 2;
  const endAngle = (endPercentage / 100) * Math.PI * 2 - Math.PI / 2;
  const startOuter = [50 + 50 * Math.cos(startAngle), 50 + 50 * Math.sin(startAngle)];
  const endOuter = [50 + 50 * Math.cos(endAngle), 50 + 50 * Math.sin(endAngle)];
  const startInner = [
    50 + innerRadius * Math.cos(startAngle),
    50 + innerRadius * Math.sin(startAngle),
  ];
  const endInner = [50 + innerRadius * Math.cos(endAngle), 50 + innerRadius * Math.sin(endAngle)];
  const largeArc = endPercentage - startPercentage > 50 ? 1 : 0;

  if (endPercentage - startPercentage >= 100) {
    return `M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 M 50 ${50 - innerRadius} A ${innerRadius} ${innerRadius} 0 1 0 50 ${50 + innerRadius} A ${innerRadius} ${innerRadius} 0 1 0 50 ${50 - innerRadius} Z`;
  }

  return `M ${startOuter[0]} ${startOuter[1]} A 50 50 0 ${largeArc} 1 ${endOuter[0]} ${endOuter[1]} L ${endInner[0]} ${endInner[1]} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${startInner[0]} ${startInner[1]} Z`;
}

function RoleDistributionChart({ stats }: RoleDistributionChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const description =
    stats.scope === 'global'
      ? 'Global role distribution'
      : `Roles in ${stats.serverName ?? 'selected server'}`;
  const roleTotal = stats.roles.reduce((total, role) => total + Math.max(0, role.memberCount), 0);
  let accumulatedMembers = 0;
  const gradientStops = stats.roles.map((role, index) => {
    const start = roleTotal === 0 ? 0 : (accumulatedMembers / roleTotal) * 100;
    accumulatedMembers += Math.max(0, role.memberCount);
    const end = roleTotal === 0 ? 0 : (accumulatedMembers / roleTotal) * 100;
    const color = roleColors[index % roleColors.length] ?? roleColors[0];
    return `${color} ${start}% ${end}%`;
  });
  const donutStyle = {
    background:
      roleTotal === 0
        ? 'var(--color-surface-hover)'
        : `conic-gradient(${gradientStops.join(', ')})`,
  } satisfies CSSProperties;
  const activeRole = activeIndex === null ? undefined : stats.roles[activeIndex];
  const handleRoleLeave = (event: MouseEvent<SVGPathElement>) => {
    if (event.currentTarget !== document.activeElement) setActiveIndex(null);
  };
  const handleRoleBlur = (event: FocusEvent<SVGPathElement>) => {
    if (!event.currentTarget.matches(':hover')) setActiveIndex(null);
  };

  return (
    <div className="space-y-4" aria-label={description}>
      <div className="flex flex-col items-center gap-4 @lg:flex-row @lg:justify-center">
        <div
          className="relative grid size-36 shrink-0 place-items-center rounded-full"
          style={donutStyle}
          role="img"
          aria-label={`${description} for ${stats.totalMembers.toLocaleString()} members`}
        >
          {activeRole ? (
            <div
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-md border border-border bg-surface-elevated px-3 py-2 text-overline text-text-primary shadow-dropdown"
            >
              {activeRole.roleName}: {activeRole.memberCount.toLocaleString()} (
              {activeRole.percentage.toFixed(1)}%)
            </div>
          ) : null}
          <svg
            className="pointer-events-none absolute inset-0 size-full"
            viewBox="0 0 100 100"
            aria-label="Role distribution segments"
          >
            {stats.roles.map((role, index) => {
              const startPercentage = stats.roles
                .slice(0, index)
                .reduce((percentage, previousRole) => {
                  const safeCount = Math.max(0, previousRole.memberCount);
                  return percentage + (roleTotal === 0 ? 0 : (safeCount / roleTotal) * 100);
                }, 0);
              const safeCount = Math.max(0, role.memberCount);
              const percentage = roleTotal === 0 ? 0 : (safeCount / roleTotal) * 100;

              return percentage > 0 ? (
                <path
                  key={`${role.roleId ?? 'global'}-${role.roleName}-${index}`}
                  className="pointer-events-auto cursor-pointer fill-transparent focus-visible:stroke-brand focus-visible:outline-none"
                  d={getDonutPath(startPercentage, startPercentage + percentage, 33)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${role.roleName}: ${role.memberCount.toLocaleString()} members (${role.percentage.toFixed(1)}%)`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={handleRoleLeave}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={handleRoleBlur}
                />
              ) : null;
            })}
          </svg>
          <div className="grid size-24 place-items-center rounded-full bg-surface-raised px-2 text-center">
            <span className="text-heading text-text-primary">
              {stats.totalMembers.toLocaleString()}
            </span>
            <span className="text-overline text-text-muted">members</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 text-overline text-text-muted">
          <p>{description}</p>
          <p className="mt-1 text-text-faint">Role membership distribution</p>
        </div>
      </div>
      <div className="max-h-48 space-y-2 overflow-y-auto pr-2">
        {stats.roles.map((role, index) => {
          const color = roleColors[index % roleColors.length] ?? roleColors[0];

          return (
            <div
              key={`${role.roleId ?? 'global'}-${role.roleName}-${index}`}
              className="flex items-center gap-2 text-body"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-text-normal" title={role.roleName}>
                {role.roleName}
              </span>
              <span className="shrink-0 font-mono text-code text-text-muted">
                {role.memberCount.toLocaleString()} ({role.percentage.toFixed(1)}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { RoleDistributionChart };
