import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';

export class DiscordCallbackDto {
    @ApiProperty({
        description: 'Discord user ID',
        example: '123456789012345678',
    })
    @IsString()
    @IsNotEmpty()
    discordId: string;

    @ApiProperty({
        description: 'Discord username',
        example: 'johndoe',
    })
    @IsString()
    @IsNotEmpty()
    username: string;

    @ApiProperty({
        description: 'Discord avatar hash',
        example: 'a1b2c3d4e5f6g7h8i9j0',
        required: false,
    })
    @IsString()
    @IsOptional()
    avatar?: string;

    @ApiProperty({
        description: 'Discord email',
        example: 'johndoe@example.com',
        required: false,
    })
    @IsEmail()
    @IsOptional()
    email?: string;
}