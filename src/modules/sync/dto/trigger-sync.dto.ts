import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class TriggerSyncDto {
  @ApiProperty({
    description: 'Discord server (guild) ID',
    example: '123456789012345678',
  })
  @IsString()
  @Matches(/^\d{17,20}$/, { message: 'Invalid server ID format' })
  serverId: string;
}
