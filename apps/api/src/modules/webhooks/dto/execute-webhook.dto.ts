import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EmbedDto } from '../../channels/dto/embed.dto';

export class ExecuteWebhookDto {
  @ApiPropertyOptional({
    description: 'Message content, optional when embeds are present',
    maxLength: 2000,
    example: 'Deployment completed',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @ApiPropertyOptional({
    description: 'Embed objects',
    type: [EmbedDto],
    maxItems: 10,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => EmbedDto)
  embeds?: EmbedDto[];

  @ApiPropertyOptional({
    description: 'Name used for this message',
    maxLength: 80,
    example: 'MCDI Deployments',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  username?: string;

  @ApiPropertyOptional({
    name: 'avatar_url',
    description: 'Avatar used for this message',
    example: 'https://example.com/avatar.png',
  })
  @IsOptional()
  @IsUrl()
  avatar_url?: string;
}
