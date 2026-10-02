import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ValidateSessionDto {
  @ApiProperty({
    description: 'Session token',
    example: '1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z...',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}
