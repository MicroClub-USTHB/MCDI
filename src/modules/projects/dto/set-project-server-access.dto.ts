import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AccessOperationsDto {
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
  @ApiPropertyOptional({ type: AccessOperationsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AccessOperationsDto)
  operations?: AccessOperationsDto;
}
