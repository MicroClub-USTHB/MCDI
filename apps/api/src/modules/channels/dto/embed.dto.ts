import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class EmbedImageDto {
  @ApiProperty({ description: 'URL of the image' })
  @IsUrl()
  url: string;
}

class EmbedThumbnailDto {
  @ApiProperty({ description: 'URL of the thumbnail' })
  @IsUrl()
  url: string;
}

class EmbedFooterDto {
  @ApiProperty({ description: 'Footer text', maxLength: 2048 })
  @IsString()
  @MaxLength(2048)
  text: string;

  @ApiPropertyOptional({ description: 'Footer icon URL' })
  @IsOptional()
  @IsUrl()
  icon_url?: string;
}

class EmbedAuthorDto {
  @ApiProperty({ description: 'Author name', maxLength: 256 })
  @IsString()
  @MaxLength(256)
  name: string;

  @ApiPropertyOptional({ description: 'Author URL' })
  @IsOptional()
  @IsUrl()
  url?: string;

  @ApiPropertyOptional({ description: 'Author icon URL' })
  @IsOptional()
  @IsUrl()
  icon_url?: string;
}

export class EmbedDto {
  @ApiPropertyOptional({ description: 'Embed title', maxLength: 256 })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  title?: string;

  @ApiPropertyOptional({ description: 'Embed description', maxLength: 4096 })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  description?: string;

  @ApiPropertyOptional({ description: 'Embed URL' })
  @IsOptional()
  @IsUrl()
  url?: string;

  @ApiPropertyOptional({
    description: 'Color as decimal integer (0–16777215)',
    example: 16711680,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(16777215)
  color?: number;

  @ApiPropertyOptional({ description: 'Embed image' })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmbedImageDto)
  image?: EmbedImageDto;

  @ApiPropertyOptional({ description: 'Embed thumbnail' })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmbedThumbnailDto)
  thumbnail?: EmbedThumbnailDto;

  @ApiPropertyOptional({ description: 'Embed footer' })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmbedFooterDto)
  footer?: EmbedFooterDto;

  @ApiPropertyOptional({ description: 'Embed author' })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmbedAuthorDto)
  author?: EmbedAuthorDto;
}
