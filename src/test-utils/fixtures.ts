export interface MemberFixture {
  id: string;
  username: string;
  globalName: string | null;
  displayName: string | null;
  avatar: string | null;
  email: string | null;
}

export function buildMemberFixture(
  overrides: Partial<MemberFixture> = {},
): MemberFixture {
  return {
    id: '800000000000000001',
    username: 'test-member',
    globalName: 'Test Member',
    displayName: 'Test Member',
    avatar: null,
    email: null,
    ...overrides,
  };
}

export interface ProjectFixture {
  id: string;
  name: string;
  isActive: boolean;
  apiKeyPrefix: string;
}

export function buildProjectFixture(
  overrides: Partial<ProjectFixture> = {},
): ProjectFixture {
  return {
    id: 'project-1',
    name: 'Test Project',
    isActive: true,
    apiKeyPrefix: 'pk_test',
    ...overrides,
  };
}

export interface ServerFixture {
  id: string;
  name: string;
  isMain: boolean;
  isActive: boolean;
}

export function buildServerFixture(
  overrides: Partial<ServerFixture> = {},
): ServerFixture {
  return {
    id: '900000000000000001',
    name: 'Test Server',
    isMain: false,
    isActive: true,
    ...overrides,
  };
}

export interface SessionFixture {
  token: string;
  memberId: string;
  expiresAt: Date;
}

export function buildSessionFixture(
  overrides: Partial<SessionFixture> = {},
): SessionFixture {
  return {
    token: 'session-token',
    memberId: '800000000000000001',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    ...overrides,
  };
}
