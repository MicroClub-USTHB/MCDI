import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum AuditAction {
  GRANT = 'GRANT',
  UPDATE = 'UPDATE',
  REVOKE = 'REVOKE',
}

export class ListAuditDto {
  @ApiPropertyOptional({
    description: 'Max entries to return (1–500, default 100).',
    example: 100,
    minimum: 1,
    maximum: 500,
  })
  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by project ID.',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Filter by server ID.',
    example: '123456789012345678',
  })
  @IsString()
  @IsOptional()
  serverId?: string;

  @ApiPropertyOptional({
    description: 'Filter by action type.',
    enum: AuditAction,
    example: AuditAction.GRANT,
  })
  @IsEnum(AuditAction)
  @IsOptional()
  action?: AuditAction;
}
