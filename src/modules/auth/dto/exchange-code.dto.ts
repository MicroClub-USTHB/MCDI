import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ExchangeCodeDto {
    @ApiProperty({
        description: 'Authorization code received from the redirect after Discord authentication',
        example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6...',
    })
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiProperty({
        description: 'API key of the platform (must match the one used to initiate login)',
        example: 'pk_live_abc123xyz789',
    })
    @IsString()
    @IsNotEmpty()
    apiKey: string;
}
