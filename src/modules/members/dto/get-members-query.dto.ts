import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GetMembersQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_.]{0,32}$/, {
    message:
      'Search query can only contain alphanumeric characters, dots, and underscores',
  })
  query?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{17,20}$/, { message: 'Invalid role ID format' })
  roleId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

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
