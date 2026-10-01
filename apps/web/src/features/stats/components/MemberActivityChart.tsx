import type { CSSProperties } from 'react';
import { useState } from 'react';
import type { FocusEvent, MouseEvent } from 'react';

import type { MemberStats } from '@/features/stats/types';

interface MemberActivityChartProps {
  stats: MemberStats;
}

interface DonutItem {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

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

function MemberActivityChart({ stats }: MemberActivityChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const total = stats.activeMembers + stats.inactiveMembers;
  const activePercentage = total === 0 ? 0 : (stats.activeMembers / total) * 100;
  const inactivePercentage = total === 0 ? 0 : (stats.inactiveMembers / total) * 100;
  const donutStyle = {
    background: `conic-gradient(var(--color-success) 0 ${activePercentage}%, var(--color-surface-hover) ${activePercentage}% 100%)`,
  } satisfies CSSProperties;
  const activityItems: DonutItem[] = [
    {
      label: 'Active',
      value: stats.activeMembers,
      percentage: activePercentage,
      color: 'bg-success',
    },
    {
      label: 'Inactive',
      value: stats.inactiveMembers,
      percentage: inactivePercentage,
      color: 'bg-surface-hover',
    },
  ];
  const activeItem = activeIndex === null ? undefined : activityItems[activeIndex];
  const handleItemLeave = (event: MouseEvent<SVGPathElement>) => {
    if (event.currentTarget !== document.activeElement) setActiveIndex(null);
  };
  const handleItemBlur = (event: FocusEvent<SVGPathElement>) => {
    if (!event.currentTarget.matches(':hover')) setActiveIndex(null);
  };

  return (
    <div className="flex flex-col items-center gap-4 @lg:flex-row @lg:justify-center @lg:gap-8">
      <div
        className="relative grid size-40 shrink-0 place-items-center rounded-full"
        style={donutStyle}
        role="img"
        aria-label={`${stats.activeMembers.toLocaleString()} active members and ${stats.inactiveMembers.toLocaleString()} inactive members`}
      >
        {activeItem ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-md border border-border bg-surface-elevated px-3 py-2 text-overline text-text-primary shadow-dropdown"
          >
            {activeItem.label}: {activeItem.value.toLocaleString()} (
            {activeItem.percentage.toFixed(1)}%)
          </div>
        ) : null}
        <svg
          className="pointer-events-none absolute inset-0 size-full"
          viewBox="0 0 100 100"
          aria-label="Member activity segments"
        >
          {activityItems.map((item, index) => {
            const startPercentage = activityItems
              .slice(0, index)
              .reduce((totalPercentage, activity) => totalPercentage + activity.percentage, 0);

            return item.percentage > 0 ? (
              <path
                key={item.label}
                className="pointer-events-auto cursor-pointer fill-transparent focus-visible:stroke-brand focus-visible:outline-none"
                d={getDonutPath(startPercentage, startPercentage + item.percentage, 30)}
                tabIndex={0}
                role="button"
                aria-label={`${item.label}: ${item.value.toLocaleString()} members (${item.percentage.toFixed(1)}%)`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={handleItemLeave}
                onFocus={() => setActiveIndex(index)}
                onBlur={handleItemBlur}
              />
            ) : null;
          })}
        </svg>
        <div className="grid size-24 place-items-center rounded-full bg-surface-raised text-center">
          <span className="text-heading text-text-primary">{total.toLocaleString()}</span>
          <span className="text-overline text-text-muted">members</span>
        </div>
      </div>
      <dl className="grid w-full max-w-xs gap-3 text-body">
        {activityItems.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4">
            <dt className="inline-flex items-center gap-2 text-text-muted">
              <span className={`size-2 rounded-full ${item.color}`} aria-hidden="true" />
              {item.label}
            </dt>
            <dd className="text-right text-text-primary">
              {item.value.toLocaleString()}{' '}
              <span className="text-text-muted">({item.percentage.toFixed(1)}%)</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export { MemberActivityChart };
