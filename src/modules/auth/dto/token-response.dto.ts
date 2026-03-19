import { ApiProperty } from '@nestjs/swagger';

export class TokenResponseDto {
  @ApiProperty({
    description: 'Long-lived session token (Bearer token)',
    example: 's1e2s3s4i5o6n7t8o9k0e1n2...',
  })
  token: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the token expires',
    example: '2026-04-18T12:00:00.000Z',
  })
  expiresAt: Date;
}
