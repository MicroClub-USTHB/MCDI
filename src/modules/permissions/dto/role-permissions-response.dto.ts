import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PermissionItemDto {
  @ApiProperty({ description: 'Permission ID', example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ description: 'Permission key', example: 'READ_MEMBERS' })
  @Expose()
  key: string;

  @ApiProperty({
    description: 'Permission description',
    required: false,
    example: 'Allows reading member data',
  })
  @Expose()
  description?: string;
}

export class RolePermissionsResponseDto {
  @ApiProperty({
    description: 'Discord role ID',
    example: '123456789012345678',
  })
  @Expose()
  roleId: string;

  @ApiProperty({ description: 'Role name', example: 'Developer' })
  @Expose()
  roleName: string;

  @ApiProperty({ description: 'Server ID', example: '987654321098765432' })
  @Expose()
  serverId: string;

  @ApiProperty({ type: [PermissionItemDto] })
  @Expose()
  @Type(() => PermissionItemDto)
  permissions: PermissionItemDto[];
}
