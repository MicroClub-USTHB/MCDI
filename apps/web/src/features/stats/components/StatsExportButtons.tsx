'use client';

import { useState } from 'react';

import { FileImage, FileSpreadsheet, LoaderCircle } from 'lucide-react';

import type { GrowthStats, MemberStats, RoleStats, ServerStats } from '@/features/stats/types';
import { Button } from '@/shared/components/ui/button';

export interface StatsExportData {
  memberStats?: MemberStats;
  growthStats?: GrowthStats;
  roleStats?: RoleStats;
  serverStats?: ServerStats;
}

interface StatsExportButtonsProps {
  data?: StatsExportData;
}

type CanvasColors = Record<
  'base' | 'raised' | 'elevated' | 'primary' | 'muted' | 'brand' | 'success' | 'error' | 'warning',
  string
>;

type CsvValue = string | number | null | undefined;

const CSV_COLUMNS = [
  'section',
  'metric',
  'value',
  'date',
  'count',
  'newMembers',
  'leftMembers',
  'netMembers',
  'roleName',
  'memberCount',
  'percentage',
  'serverId',
  'serverName',
  'activeMembers',
  'roleCount',
  'lastSync',
  'syncStatus',
] as const;

type CsvColumn = (typeof CSV_COLUMNS)[number];

type CsvRow = Partial<Record<CsvColumn, CsvValue>> & {
  section: string;
};

function csvValue(value: CsvValue): string {
  const text = value == null ? '' : String(value);
  const guarded = typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;

  return `"${guarded.replace(/"/g, '""')}"`;
}

export function buildStatsCsv(data: StatsExportData): string {
  const summaryRows: CsvRow[] = data.memberStats
    ? [
        {
          section: 'summary',
          metric: 'totalMembers',
          value: data.memberStats.totalMembers,
        },
        {
          section: 'summary',
          metric: 'clubMembers',
          value: data.memberStats.clubMembers,
        },
        {
          section: 'summary',
          metric: 'nonClubMembers',
          value: data.memberStats.nonClubMembers,
        },
        {
          section: 'summary',
          metric: 'activeMembers',
          value: data.memberStats.activeMembers,
        },
        {
          section: 'summary',
          metric: 'inactiveMembers',
          value: data.memberStats.inactiveMembers,
        },
        {
          section: 'summary',
          metric: 'newMembersThisPeriod',
          value: data.memberStats.newMembersThisPeriod,
        },
        {
          section: 'summary',
          metric: 'growthRate',
          value: data.memberStats.growthRate,
        },
      ]
    : [];

  const growthRows: CsvRow[] =
    data.growthStats?.data.map((point) => ({
      section: 'growth',
      metric: 'bucket',
      date: point.date,
      count: point.count,
      newMembers: point.newMembers,
      leftMembers: point.leftMembers,
      netMembers: point.netMembers,
    })) ?? [];

  const roleStats = data.roleStats;
  const roleRows: CsvRow[] = roleStats
    ? roleStats.roles.map((role) => ({
        section: 'role',
        metric: 'role',
        roleName: role.roleName,
        memberCount: role.memberCount,
        percentage: role.percentage,
        serverId: roleStats.serverId,
        serverName: roleStats.serverName,
      }))
    : [];

  const serverRows: CsvRow[] =
    data.serverStats?.servers.map((server) => ({
      section: 'server',
      metric: 'server',
      memberCount: server.memberCount,
      serverId: server.serverId,
      serverName: server.serverName,
      activeMembers: server.activeMembers,
      roleCount: server.roleCount,
      lastSync: server.lastSync,
      syncStatus: server.syncStatus,
    })) ?? [];

  const rows = [...summaryRows, ...growthRows, ...roleRows, ...serverRows];

  const header = CSV_COLUMNS.map(csvValue).join(',');

  const body = rows.map((row) => CSV_COLUMNS.map((column) => csvValue(row[column])).join(','));

  return [header, ...body].join('\r\n');
}

function readCanvasColors(): CanvasColors {
  const styles = getComputedStyle(document.documentElement);
  const read = (token: string) => styles.getPropertyValue(token).trim() || 'transparent';

  return {
    base: read('--color-surface-base'),
    raised: read('--color-surface-raised'),
    elevated: read('--color-surface-elevated'),
    primary: read('--color-text-primary'),
    muted: read('--color-text-muted'),
    brand: read('--color-brand'),
    success: read('--color-success'),
    error: read('--color-error'),
    warning: read('--color-warning'),
  };
}

function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  font: string
) {
  context.fillStyle = color;
  context.font = font;
  context.fillText(text, x, y);
}

function drawStatTile(
  context: CanvasRenderingContext2D,
  colors: CanvasColors,
  x: number,
  label: string,
  value: string,
  accent: string
) {
  context.fillStyle = colors.raised;
  context.fillRect(x, 88, 260, 68);
  context.fillStyle = accent;
  context.fillRect(x, 88, 260, 4);
  drawText(context, label, x + 16, 112, colors.muted, '600 13px sans-serif');
  drawText(context, value, x + 16, 140, colors.primary, '700 24px sans-serif');
}

function drawPanel(
  context: CanvasRenderingContext2D,
  colors: CanvasColors,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string
) {
  context.fillStyle = colors.raised;
  context.fillRect(x, y, width, height);
  drawText(context, title, x + 20, y + 30, colors.primary, '700 16px sans-serif');
}

function drawGrowthReport(
  context: CanvasRenderingContext2D,
  colors: CanvasColors,
  data: GrowthStats,
  x: number,
  y: number
) {
  const chartX = x + 24;
  const chartY = y + 56;
  const chartWidth = 650;
  const chartHeight = 152;
  const maxCount = Math.max(1, ...data.data.map((point) => point.count));
  const maxFlow = Math.max(
    1,
    ...data.data.flatMap((point) => [point.newMembers, point.leftMembers])
  );

  context.strokeStyle = colors.elevated;
  context.lineWidth = 1;
  [0, 0.5, 1].forEach((fraction) => {
    const lineY = chartY + chartHeight - fraction * chartHeight;
    context.beginPath();
    context.moveTo(chartX, lineY);
    context.lineTo(chartX + chartWidth, lineY);
    context.stroke();
  });

  if (data.data.length > 0) {
    const step = chartWidth / Math.max(data.data.length - 1, 1);
    context.strokeStyle = colors.brand;
    context.lineWidth = 3;
    context.beginPath();
    data.data.forEach((point, index) => {
      const pointX = chartX + (data.data.length === 1 ? chartWidth / 2 : index * step);
      const pointY = chartY + chartHeight - (point.count / maxCount) * chartHeight;
      if (index === 0) context.moveTo(pointX, pointY);
      else context.lineTo(pointX, pointY);
    });
    context.stroke();

    const barWidth = Math.min(14, Math.max(4, chartWidth / data.data.length / 3));
    data.data.forEach((point, index) => {
      const pointX = chartX + (data.data.length === 1 ? chartWidth / 2 : index * step);
      const newHeight = (point.newMembers / maxFlow) * 44;
      const leftHeight = (point.leftMembers / maxFlow) * 44;
      context.fillStyle = colors.success;
      context.fillRect(
        pointX - barWidth - 2,
        chartY + chartHeight + 12 - newHeight,
        barWidth,
        newHeight
      );
      context.fillStyle = colors.error;
      context.fillRect(pointX + 2, chartY + chartHeight + 12 - leftHeight, barWidth, leftHeight);
    });
  }

  drawText(context, `Period: ${data.period}`, x + 20, y + 236, colors.muted, '600 13px sans-serif');
  drawText(
    context,
    `Net growth: ${data.totalGrowth > 0 ? '+' : ''}${data.totalGrowth}`,
    x + 170,
    y + 236,
    data.totalGrowth >= 0 ? colors.success : colors.error,
    '600 13px sans-serif'
  );
}

function drawRoleReport(
  context: CanvasRenderingContext2D,
  colors: CanvasColors,
  data: RoleStats,
  x: number,
  y: number
) {
  const roles = data.roles.slice(0, 6);
  const maxMembers = Math.max(1, ...roles.map((role) => role.memberCount));

  roles.forEach((role, index) => {
    const rowY = y + 62 + index * 28;
    drawText(
      context,
      role.roleName.slice(0, 18),
      x + 20,
      rowY,
      colors.muted,
      '500 12px sans-serif'
    );
    context.fillStyle = colors.brand;
    context.fillRect(x + 160, rowY - 11, 160 * (role.memberCount / maxMembers), 12);
    drawText(
      context,
      role.memberCount.toLocaleString(),
      x + 330,
      rowY,
      colors.primary,
      '600 12px sans-serif'
    );
  });
}

function drawServerReport(
  context: CanvasRenderingContext2D,
  colors: CanvasColors,
  data: ServerStats,
  x: number,
  y: number
) {
  const servers = data.servers.slice(0, 8);
  const metrics = [
    { key: 'memberCount' as const, color: colors.brand },
    { key: 'activeMembers' as const, color: colors.success },
    { key: 'roleCount' as const, color: colors.warning },
  ];
  const maxes = metrics.map((metric) =>
    Math.max(1, ...servers.map((server) => server[metric.key]))
  );
  const groupWidth = 104;

  servers.forEach((server, serverIndex) => {
    const groupX = x + 24 + serverIndex * groupWidth;
    metrics.forEach((metric, metricIndex) => {
      const value = server[metric.key];
      const max = maxes[metricIndex] ?? 1;
      context.fillStyle = metric.color;
      context.fillRect(
        groupX + metricIndex * 20,
        y + 180 - (value / max) * 116,
        14,
        (value / max) * 116
      );
    });
    drawText(
      context,
      server.serverName.slice(0, 13),
      groupX,
      y + 204,
      colors.muted,
      '500 11px sans-serif'
    );
  });
}

async function downloadStatsPng(data: StatsExportData) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 800;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas export is not supported');

  const colors = readCanvasColors();
  context.fillStyle = colors.base;
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawText(context, 'Member Statistics', 40, 48, colors.primary, '700 28px sans-serif');
  drawText(
    context,
    `Generated ${new Date().toLocaleString()}`,
    40,
    70,
    colors.muted,
    '500 13px sans-serif'
  );
  if (data.memberStats) {
    drawStatTile(
      context,
      colors,
      40,
      'Total members',
      data.memberStats.totalMembers.toLocaleString(),
      colors.brand
    );
    drawStatTile(
      context,
      colors,
      320,
      'Club members',
      data.memberStats.clubMembers.toLocaleString(),
      colors.brand
    );
    drawStatTile(
      context,
      colors,
      600,
      'Active members',
      data.memberStats.activeMembers.toLocaleString(),
      colors.success
    );
    drawStatTile(
      context,
      colors,
      880,
      'New members',
      data.memberStats.newMembersThisPeriod.toLocaleString(),
      colors.success
    );
  }
  if (data.growthStats) {
    drawPanel(context, colors, 40, 180, 720, 270, 'Member growth');
    drawGrowthReport(context, colors, data.growthStats, 40, 180);
  }
  if (data.roleStats) {
    drawPanel(context, colors, 780, 180, 380, 270, 'Roles');
    drawRoleReport(context, colors, data.roleStats, 780, 180);
  }
  if (data.serverStats) {
    drawPanel(context, colors, 40, 470, 1120, 280, 'Members by Server');
    drawServerReport(context, colors, data.serverStats, 40, 470);
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not create PNG export');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'member-statistics.png';
  link.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(data: StatsExportData) {
  const blob = new Blob([buildStatsCsv(data)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'member-statistics.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function StatsExportButtons({ data }: StatsExportButtonsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(false);
  const disabled = !data || isExporting;

  const handleExport = async (format: 'csv' | 'png') => {
    if (!data) return;
    setIsExporting(true);
    setError(false);
    try {
      if (format === 'csv') downloadCsv(data);
      else await downloadStatsPng(data);
    } catch {
      setError(true);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {error ? (
        <span className="text-overline text-error" role="alert">
          Export failed. Try again.
        </span>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={() => void handleExport('png')}
      >
        {isExporting ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <FileImage aria-hidden="true" />
        )}
        PNG
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={() => void handleExport('csv')}
      >
        {isExporting ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <FileSpreadsheet aria-hidden="true" />
        )}
        CSV
      </Button>
      <span className="sr-only" aria-live="polite">
        {isExporting
          ? 'Exporting statistics'
          : data
            ? 'Statistics export ready'
            : 'Statistics exports become available when data finishes loading'}
      </span>
    </div>
  );
}

export { StatsExportButtons };
