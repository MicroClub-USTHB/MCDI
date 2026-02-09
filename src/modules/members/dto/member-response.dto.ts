/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Expose, Transform, Type } from 'class-transformer';

class MemberRoleDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  @Transform(({ value }) => value || null)
  color?: number;

  @Expose()
  position: number;
}

export class MemberResponseDto {
  @Expose()
  discordId: string;

  @Expose()
  username: string;

  @Expose()
  @Transform(({ value }) => value || null)
  globalName?: string;

  @Expose()
  @Transform(({ value }) => value || null)
  displayName?: string;

  @Expose()
  @Transform(({ value }) => value || null)
  avatar?: string;

  @Expose()
  isClubMember: boolean;

  @Expose()
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : value || null,
  )
  joinedAt?: string;

  @Expose()
  @Type(() => MemberRoleDto)
  roles: MemberRoleDto[];
}

export class MemberSearchResponseDto {
  @Expose()
  discordId: string;

  @Expose()
  username: string;

  @Expose()
  @Transform(({ value }) => value || null)
  globalName?: string;

  @Expose()
  @Transform(({ value }) => value || null)
  displayName?: string;

  @Expose()
  @Transform(({ value }) => value || null)
  avatar?: string;

  @Expose()
  isClubMember: boolean;

  @Expose()
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : value || null,
  )
  joinedAt?: string;
}
