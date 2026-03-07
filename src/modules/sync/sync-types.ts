/**
 * A single change record buffered during a bulk sync run and then
 * batch-inserted into the sync_change_details table.
 */
export interface SyncChangeEntry {
  syncLogId: number;
  serverId: string;
  entityType: string;
  entityId: string;
  action: string;
  description?: string;
  details?: string;
}
