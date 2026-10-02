import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString, Matches } from 'class-validator';

export class SetAllowedRolesDto {
  /**
   * Non-empty by design. Removing the last role is a deletion of the webhook,
   * not an edit of it — an empty set would silently orphan the submissions.
   */
  @ApiProperty({ example: ['1234567890123456789'] })
  @IsArray()
  @ArrayNotEmpty({ message: 'at least one allowed role is required' })
  @IsString({ each: true })
  @Matches(/^\d{17,20}$/, {
    each: true,
    message: 'each role must be a Discord snowflake',
  })
  roleIds!: string[];
}
