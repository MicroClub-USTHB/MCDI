import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'MicroClub Website' })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Main club website' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether this is an internal MicroClub platform project.',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isInternal?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the project is active.',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Optional Discord webhook URL for this project.',
    example: 'https://discord.com/api/webhooks/000/token',
  })
  @IsUrl()
  @IsOptional()
  webhookUrl?: string;
}
