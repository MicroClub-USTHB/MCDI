import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateServerDto {
  @ApiProperty({
    example: '123456789012345678',
    description: 'Discord guild ID',
  })
  @IsString()
  guildId!: string;

  @ApiPropertyOptional({ example: 'Test Guild' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.discordapp.com/icons/.../icon.png',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  icon?: string | null;

  @ApiPropertyOptional({
    example: 'other',
    default: 'other',
    enum: ['main', 'competition', 'event', 'other'],
    description: 'Server category type',
  })
  @IsOptional()
  @IsIn(['main', 'competition', 'event', 'other'])
  type?: 'main' | 'competition' | 'event' | 'other';

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isMain?: boolean;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 2,
    minimum: 1,
    description: 'Sync frequency in hours',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  syncFrequencyHours?: number;

  @ApiPropertyOptional({
    example: 'deny_all',
    enum: ['deny_all', 'allow_all', 'custom'],
    default: 'deny_all',
  })
  @IsOptional()
  @IsIn(['deny_all', 'allow_all', 'custom'])
  defaultPermissionPolicy?: 'deny_all' | 'allow_all' | 'custom';

  @ApiPropertyOptional({ example: 'maintenance', nullable: true })
  @IsOptional()
  @IsString()
  disabledReason?: string | null;
}
