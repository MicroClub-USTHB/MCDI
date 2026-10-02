import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'The current refresh token issued alongside the session',
    example: 'r1e2f3r4e5s6h7t8o9k0e1n2...',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class RefreshTokenResponseDto {
  @ApiProperty({
    description: 'New session (access) token replacing the previous one',
    example: 'a1c2c3e4s5s6t7o8k9e0n1...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the new access token expires',
    example: '2026-06-22T12:00:00.000Z',
  })
  expiresAt: Date;

  @ApiProperty({
    description: 'New refresh token — the previous one is now invalid',
    example: 'r1e2f3r4e5s6h7t8o9k0e1n2...',
  })
  refreshToken: string;
}
