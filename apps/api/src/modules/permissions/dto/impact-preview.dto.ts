import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt } from 'class-validator';

export class ImpactPreviewDto {
  @ApiProperty({
    example: [1, 2],
    description: 'Array of permission IDs to preview impact for',
  })
  @IsArray()
  @IsInt({ each: true })
  permissionIds!: number[];

  @ApiProperty({
    example: 'add',
    enum: ['add', 'remove'],
    description: 'Whether to preview adding or removing the permissions',
  })
  @IsIn(['add', 'remove'])
  action!: 'add' | 'remove';
}
