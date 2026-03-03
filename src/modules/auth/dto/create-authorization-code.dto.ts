import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUrl,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateAuthorizationCodeDto {
  @ApiProperty({
    description: 'User ID (Discord ID)',
    example: '123456789012345678',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'OAuth client ID',
    example: 'client_abc123xyz',
  })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({
    description: 'Redirect URI for OAuth callback',
    example: 'https://example.com/auth/callback',
  })
  @IsUrl()
  @IsNotEmpty()
  redirectUri: string;

  @ApiProperty({
    description: 'Code expiration time in minutes (default: 10)',
    example: 10,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  expiresInMinutes?: number;
}
