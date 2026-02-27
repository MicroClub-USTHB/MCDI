import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class GetMembersQueryDto {
  @ApiProperty({
    description:
      'Search query (partial username, global name, or display name)',
    required: false,
    example: 'john',
    maxLength: 32,
    pattern: '^[a-zA-Z0-9_.]{0,32}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_.]{0,32}$/, {
    message:
      'Search query can only contain alphanumeric characters, dots, and underscores',
  })
  query?: string;

  @ApiProperty({
    description: 'Filter members by role ID',
    required: false,
    example: '123456789012345678',
    pattern: '^\\d{17,20}$',
  })
  @IsOptional()
  @IsString()
  roleId?: string;

  @ApiProperty({
    description: 'Page number',
    required: false,
    default: 1,
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    required: false,
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  getDbPagination() {
    const page = this.page || 1;
    const limit = this.limit || 20;

    return {
      offset: (page - 1) * limit,
      limit,
      page,
    };
  }
}
