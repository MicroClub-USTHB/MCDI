import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class LogoutDto {
    @ApiProperty({
        description: 'Session token to invalidate',
        example: '1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z...',
    })
    @IsString()
    @IsNotEmpty()
    token: string;
}

export class LogoutAllDto {
    @ApiProperty({
        description: 'Member ID (Discord ID) to logout from all devices',
        example: '123456789012345678',
    })
    @IsString()
    @IsNotEmpty()
    memberId: string;
}
