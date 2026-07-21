import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminLoginMemberDto {
  @ApiProperty({
    description: 'Member ID (Discord snowflake)',
    example: '123456789012345678',
  })
  id: string;

  @ApiProperty({ description: 'Discord username', example: 'johndoe' })
  username: string;

  @ApiPropertyOptional({
    description: 'Discord global display name',
    example: 'John Doe',
    nullable: true,
  })
  globalName: string | null;

  @ApiPropertyOptional({
    description: 'Server-level display name override',
    example: 'J. Doe',
    nullable: true,
  })
  displayName: string | null;

  @ApiPropertyOptional({
    description: 'Discord avatar hash or full CDN URL',
    example: 'https://cdn.discordapp.com/avatars/123456789012345678/abc123.png',
    nullable: true,
  })
  avatar: string | null;

  @ApiPropertyOptional({
    description: 'Email address from Discord',
    example: 'johndoe@example.com',
    nullable: true,
  })
  email: string | null;

  @ApiProperty({
    description: 'Whether the member has the system admin flag set',
    example: true,
  })
  isSystemAdmin: boolean;
}
