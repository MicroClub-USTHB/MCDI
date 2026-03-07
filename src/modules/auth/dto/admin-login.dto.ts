import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminPasswordLoginDto {
  @ApiProperty({
    description: 'Discord username of the system admin',
    example: 'johndoe',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ description: 'Admin password', example: 'supersecret' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

export class AdminLoginResponseDto {
  @ApiProperty({
    description: 'Bearer token to include in Authorization header',
  })
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
