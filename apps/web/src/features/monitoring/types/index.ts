export type MonitoringPeriod = '7d' | '30d' | '90d';
export type AuditActionType =
  'auth' | 'project' | 'server' | 'role' | 'webhook' | 'member' | 'sync' | 'permission';
export type AuditSeverity = 'info' | 'warning' | 'error';

export interface UsageProject {
  projectId: string;
  projectName: string;
  requests: number;
  errors: number;
}

export interface UsageEndpoint {
  endpoint: string;
  method: string;
  count: number;
  avgResponseTime: number;
}

export interface UsageStats {
  totalRequests: number;
  byProject: UsageProject[];
  byEndpoint: UsageEndpoint[];
  errors: { total: number; byType: { '4xx': number; '5xx': number } };
}

export interface HealthStatus {
  api: { status: 'healthy'; uptime: number; responseTime: number };
  discord: { status: 'connected' | 'disconnected'; guilds: number; latency: number };
  database: { status: 'connected' | 'disconnected'; queryTime: number; connections: number };
  redis: { status: 'connected' | 'disconnected'; hitRate: number; memoryUsed: string };
}

export interface AuthFailure {
  id: number;
  timestamp: string;
  ipAddress: string | null;
  reason: string | null;
  attemptedActor: string | null;
  actorId: string | null;
  path: string | null;
}

export interface AuthFailuresResponse {
  failures: AuthFailure[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditLog {
  id: number;
  timestamp: string;
  actorId: string | null;
  actorName: string | null;
  actionType: AuditActionType;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  severity: AuditSeverity;
}

export interface AuditLogFilters {
  dateFrom?: string;
  dateTo?: string;
  actorId?: string;
  actionType?: AuditActionType;
  severity?: AuditSeverity;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}
