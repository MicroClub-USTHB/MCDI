import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ExchangeCodeDto {
  @ApiProperty({
    description: 'Project ID (clientId) that issued the code',
    example: 'p_12345',
  })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({
    description: 'The one-time exchange code received from the redirect',
    example: 'c123...',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: 'The same redirect_uri that was used in the authorize call',
    example: 'https://my-app.com/callback',
  })
  @IsString()
  @IsNotEmpty()
  redirectUri: string;
}
