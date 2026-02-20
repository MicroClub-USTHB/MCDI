import { SQL } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';

export * from './member.entity';
export * from './server.entity';
export * from './role.entity';
export * from './permission.entity';
export * from './project.entity';
export * from './role-permission.entity';
export * from './server-member.entity';
export * from './server-member-role.entity';
export * from './project-server.entity';
export * from './session.entity';
export * from './server-sync-log.entity';
export * from './role-inheritance-rule.entity'
export * from './role-inheritance-rule-target.entity'
export * from './project-server-access-audit.entity';


export function transaction(arg0: (tx: any) => Promise<any>) {
    throw new Error('Function not implemented.');
}

export function select(arg0: { serverId: PgColumn<{ name: "server_id"; tableName: "server_sync_logs"; dataType: "string"; columnType: "PgVarchar"; data: string; driverParam: string; notNull: true; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; hasRuntimeDefault: false; enumValues: [string, ...string[]]; baseColumn: never; identity: undefined; generated: undefined; }, {}, { length: 255; }>; lastSyncAt: SQL.Aliased<unknown>; }) {
    throw new Error('Function not implemented.');
}
