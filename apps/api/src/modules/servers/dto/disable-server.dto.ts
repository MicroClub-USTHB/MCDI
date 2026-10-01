import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DisableServerDto {
  @ApiPropertyOptional({ example: 'maintenance' })
  @IsOptional()
  @IsString()
  disabledReason?: string;
}
