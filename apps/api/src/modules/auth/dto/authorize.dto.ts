import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class AuthorizeQueryDto {
  @ApiProperty({
    description: 'Project ID (UUID) identifying the client application',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  client_id: string;

  @ApiProperty({
    description:
      'URI to redirect back to after authentication. Must be whitelisted for the project.',
    example: 'https://events.microclub.net/auth/callback',
  })
  @IsString()
  @IsNotEmpty()
  redirect_uri: string;

  @ApiProperty({
    description: 'Discord server ID to verify membership against',
    example: '1234567890123456789',
  })
  @IsString()
  @IsNotEmpty()
  server_id: string;

  @ApiProperty({
    description:
      'Opaque state value passed through to the redirect. Use for CSRF protection.',
    example: 'random_csrf_token_abc123',
  })
  @IsString()
  @IsNotEmpty()
  state: string;
}
