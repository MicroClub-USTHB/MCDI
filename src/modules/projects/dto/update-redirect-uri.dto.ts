import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateRedirectUriDto {
  @ApiProperty({
    description:
      'Allowed redirect URI(s) for this project. ' +
      'Use a comma-separated list to allow multiple URIs. ' +
      'The value passed in POST /auth/login-session must exactly match one of these.',
    example: 'https://events.microclub.net/auth/callback',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  redirectUri: string;
}
