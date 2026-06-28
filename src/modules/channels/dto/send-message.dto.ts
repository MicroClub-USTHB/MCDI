import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmbedDto } from './embed.dto';
import { AllowedMentionsDto } from './allowed-mentions.dto';

export class SendMessageDto {
  @ApiPropertyOptional({
    description: 'Message content (max 2000 chars)',
    maxLength: 2000,
    example: 'Hello from MCDI!',
  })
  @ValidateIf((o: SendMessageDto) => !o.embeds?.length)
  @IsString()
  @MaxLength(2000)
  content?: string;

  @ApiPropertyOptional({
    description: 'Embed objects (max 10)',
    type: [EmbedDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => EmbedDto)
  embeds?: EmbedDto[];

  @ApiPropertyOptional({
    description: 'Allowed mentions configuration',
    type: AllowedMentionsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AllowedMentionsDto)
  allowed_mentions?: AllowedMentionsDto;

  @ApiPropertyOptional({
    description: 'Whether the message is text-to-speech',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  tts?: boolean;
}
