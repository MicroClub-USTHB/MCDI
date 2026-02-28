import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsString } from 'class-validator';

export enum CheckMode {
    ALL = 'ALL',
    ANY = 'ANY',
}

export class CheckPermissionsBatchDto {
    @ApiProperty({
        example: '123456789012345678',
        description: 'Discord member ID',
    })
    @IsString()
    discordId!: string;

    @ApiProperty({
        example: '987654321098765432',
        description: 'Server (guild) ID context',
    })
    @IsString()
    serverId!: string;

    @ApiProperty({
        example: ['MANAGE_EVENTS', 'SEND_MESSAGES'],
        description: 'List of permission keys to check',
    })
    @IsArray()
    @IsString({ each: true })
    permissions!: string[];

    @ApiProperty({
        enum: CheckMode,
        example: 'ALL',
        description: 'ALL = user must hold every permission, ANY = at least one',
    })
    @IsEnum(CheckMode)
    mode!: CheckMode;
}
