import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsIn,
  Min,
} from 'class-validator';

export class CreateServerDto {
  @IsString()
  guildId!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  icon?: string | null;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsBoolean()
  isMain?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  syncFrequencyHours?: number;

  @IsOptional()
  @IsIn(['deny_all', 'allow_all', 'custom'])
  defaultPermissionPolicy?: 'deny_all' | 'allow_all' | 'custom';

  @IsOptional()
  @IsString()
  disabledReason?: string | null;
}
