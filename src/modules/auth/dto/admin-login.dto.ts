import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminLoginDto {
  @ApiProperty({
    description: 'Discord member ID of the system admin',
    example: '123456789012345678',
  })
  @IsString()
  @IsNotEmpty()
  memberId: string;
}

export class AdminLoginResponseDto {
  @ApiProperty({ description: 'Bearer token to include in Authorization header' })
  token: string;

  @ApiProperty({ description: 'Token expiry timestamp (24 h from now)' })
  expiresAt: Date;

  @ApiProperty({ description: 'Authenticated system-admin member' })
  member: {
    id: string;
    username: string;
    globalName: string | null;
    displayName: string | null;
    avatar: string | null;
    email: string | null;
    isSystemAdmin: boolean;
  };
}
