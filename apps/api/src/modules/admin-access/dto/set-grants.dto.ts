import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import { ACCESS_LEVELS } from '../../../common/permissions/catalog';

export class SetGrantsDto {
  @ApiProperty({
    description:
      'Level per resource. Resources not listed get no grant. For a role, `none` removes the grant. For a member, `none` denies access that the roles would give.',
    type: 'object',
    additionalProperties: { type: 'string', enum: [...ACCESS_LEVELS] },
    example: { members: 'read', audit: 'read', messages: 'none' },
  })
  @IsObject()
  grants: Record<string, string>;
}
