import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt } from 'class-validator';

export class AssignPermissionsDto {
  @ApiProperty({
    example: [1, 2, 3],
    description: 'Array of permission IDs to assign to the role',
  })
  @IsArray()
  @IsInt({ each: true })
  permissionIds!: number[];
}
