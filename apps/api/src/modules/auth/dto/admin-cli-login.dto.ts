import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Optional query for `GET /auth/admin/discord`. Omitted by the admin web panel;
 * a CLI (m-forge) passes all three to receive the login result itself.
 */
export class AdminDiscordLoginQueryDto {
  @ApiPropertyOptional({
    description:
      'CLI login only: the loopback URL (http, 127.0.0.1 / localhost / [::1], explicit port) ' +
      'MCDI redirects to with ?code=&state= (or ?error=&state=) once Discord is done.',
    example: 'http://127.0.0.1:53123/callback',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  redirect_uri?: string;

  @ApiPropertyOptional({
    description:
      'CLI login only: PKCE challenge, BASE64URL(SHA256(code_verifier)) (RFC 7636).',
    example: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  code_challenge?: string;

  @ApiPropertyOptional({
    description: 'CLI login only: must be S256.',
    example: 'S256',
  })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  code_challenge_method?: string;
}

export class AdminCliTokenDto {
  @ApiProperty({
    description: 'The one-time code from the CLI login redirect',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  code: string;

  @ApiProperty({
    description:
      'The PKCE code_verifier whose S256 challenge started the login (RFC 7636)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  codeVerifier: string;
}

export class AdminCliTokenResponseDto {
  @ApiProperty({ description: 'Admin session token (Bearer), valid 24 hours' })
  token: string;

  @ApiProperty({ description: 'When the session expires' })
  expiresAt: Date;
}
