import {
  IsString,
  MaxLength,
  IsOptional,
  IsEnum,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ProjectScope {
  READ_MEMBERS = 'read_members',
  CHECK_PERMISSIONS = 'check_permissions',
}

export class CreateProjectDto {
  @ApiProperty({ example: 'MicroClub Website' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'Main club website', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: ['read_members', 'check_permissions'],
    enum: ProjectScope,
    isArray: true,
    required: false,
  })
  @IsArray()
  @IsEnum(ProjectScope, { each: true })
  @IsOptional()
  scopes?: ProjectScope[];
}
