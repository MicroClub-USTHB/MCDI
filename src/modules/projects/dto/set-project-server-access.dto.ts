import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AccessOperationsDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  READ?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  SEND_MESSAGES?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  MANAGE_WEBHOOKS?: boolean;
}

export class SetProjectServerAccessDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  projectId!: string;

  @ApiProperty({ example: '123456789012345678' })
  @IsString()
  @Matches(/^\d{17,20}$/)
  serverId!: string;

  @ApiPropertyOptional({ type: AccessOperationsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AccessOperationsDto)
  operations?: AccessOperationsDto;
}
