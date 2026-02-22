import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CheckPermissionDto {
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
    example: 'ORGANIZER',
    description: 'Permission name/code to evaluate',
  })
  @IsString()
  permission!: string;
}
