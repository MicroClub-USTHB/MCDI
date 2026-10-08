export const accessKeys = {
  all: ['access'] as const,
  catalog: () => [...accessKeys.all, 'catalog'] as const,
  roles: () => [...accessKeys.all, 'roles'] as const,
  overridesList: () => [...accessKeys.all, 'overrides'] as const,
  memberOverrides: (memberId: string) =>
    [...accessKeys.all, 'member', memberId, 'overrides'] as const,
  memberEffective: (memberId: string) =>
    [...accessKeys.all, 'member', memberId, 'effective'] as const,
};
