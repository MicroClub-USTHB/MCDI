import { IsString } from 'class-validator';

export class ValidateSessionDto {
  @IsString()
  token!: string;
}
