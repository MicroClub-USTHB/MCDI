import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateInboundWebhookDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'A FormSchema; re-validated on update.' })
  @IsOptional()
  @IsObject()
  schema?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  acceptedOrigins?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireSignature?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rejectUnknownFields?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowRoleInheritance?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
