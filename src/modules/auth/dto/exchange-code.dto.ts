import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ExchangeCodeDto {
  @ApiProperty({
    description: 'One-time callback code obtained after Discord redirect',
    example: 'a1b2c3d4e5f6g7h8i9j0...',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}
