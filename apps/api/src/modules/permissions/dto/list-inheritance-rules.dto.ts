import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ListInheritanceRulesDto {
  @ApiProperty({
    description: 'Filter by source role ID.',
    required: false,
    example: '123456789012345678',
  })
  @IsOptional()
  @IsString()
  sourceRoleId?: string;

  @ApiProperty({
    description: 'Filter by enabled status.',
    required: false,
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({
    description: 'Filter by target scope type.',
    required: false,
    enum: ['all', 'selected'],
    example: 'selected',
  })
  @IsOptional()
  @IsIn(['all', 'selected'])
  targetScope?: 'all' | 'selected';

  @ApiProperty({
    description:
      'Filter rules that apply to a specific server (scope=all always matches, scope=selected matches when the server is in targetServerIds).',
    required: false,
    example: '123456789012345678',
  })
  @IsOptional()
  @IsString()
  serverId?: string;
}
