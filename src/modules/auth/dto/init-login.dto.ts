import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class InitLoginDto {
    @ApiProperty({
        description: 'API key of the platform requesting authentication',
        example: 'pk_live_abc123xyz789',
    })
    @IsString()
    @IsNotEmpty()
    apiKey: string;

    @ApiProperty({
        description: 'Discord server ID to verify membership against. Required for external platforms. Internal platforms always use the main server.',
        example: '1234567890123456',
        required: false,
    })
    @IsString()
    @IsOptional()
    serverId?: string;

    @ApiProperty({
        description: 'URI to redirect back to after successful authentication',
        example: 'https://events.microclub.net/auth/callback',
    })
    @IsString()
    @IsNotEmpty()
    redirectUri: string;
}
