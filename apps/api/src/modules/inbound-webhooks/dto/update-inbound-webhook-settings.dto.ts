import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString, Matches } from 'class-validator';

export class UpdateInboundWebhookSettingsDto {
  @ApiProperty({
    description:
      'Discord role IDs given read access to every NEW inbound webhook whose creator names no roles. ' +
      'An empty list means no defaults. Existing webhooks keep the roles they already have.',
    example: ['1234567890123456789'],
  })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(/^\d{17,20}$/, {
    each: true,
    message: 'each role must be a Discord snowflake',
  })
  defaultReaderRoleIds!: string[];
}
