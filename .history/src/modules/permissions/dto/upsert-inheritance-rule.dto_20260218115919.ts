import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpsertInheritanceRuleDto {
  @ApiProperty({ example: '112233445566778899', description: 'Role ID from main server' })
  @IsString()
  sourceRoleId!: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ example: 'all', enum: ['all', 'selected'] })
  @IsIn(['all', 'selected'])
  targetScope!: 'all' | 'selected';

  @ApiPropertyOptional({
    type: [String],
    example: ['998877665544332211', '887766554433221100'],
    description: 'Required when targetScope = selected',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetServerIds?: string[];
}
