import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ImpactPreviewResponseDto {
  @ApiProperty({
    description: 'Number of members affected by the change',
    example: 15,
  })
  @Expose()
  affectedMembers: number;

  @ApiProperty({
    description: 'Discord IDs of affected members',
    example: ['111222333444555666', '777888999000111222'],
  })
  @Expose()
  memberIds: string[];

  @ApiProperty({
    description: 'Total number of members holding this role',
    example: 15,
  })
  @Expose()
  roleHolders: number;
}
