import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateLoginSessionDto {
  @ApiProperty({
    description:
      'Discord server ID to verify membership against. Required for external platforms. ' +
      'Internal platforms always use the main server.',
    example: '1234567890123456',
    required: false,
  })
  @IsString()
  @IsOptional()
  serverId?: string;

  @ApiProperty({
    description:
      'Discord server name (alternative to serverId for external platforms)',
    example: 'Main Server',
    required: false,
  })
  @IsString()
  @IsOptional()
  serverName?: string;

  @ApiProperty({
    description: 'URI to redirect back to after successful authentication',
    example: 'https://events.microclub.net/auth/callback',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  redirectUri: string;
}

export class LoginSessionResponseDto {
  @ApiProperty({
    description: 'Short-lived URL to redirect the user to for login',
    example: '/api/auth/login/a1b2c3d4e5f6...',
  })
  loginUrl: string;
}
