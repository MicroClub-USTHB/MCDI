export const members = {
  name: 'Members',
  route: '/dashboard/members',
} as const;

export { memberKeys } from './api/keys';
export {
  fetchMembers,
  fetchMember,
  fetchMemberServers,
  fetchMemberPermissions,
  fetchServerRoles,
  exportMembers,
} from './api/service';
export {
  useMembersQuery,
  useMemberQuery,
  useMemberServersQuery,
  useMemberPermissionsQueries,
  useServerRolesQuery,
} from './api/queries';
export { useExportMembersMutation } from './api/mutations';
export {
  MemberFilters,
  MemberAvatar,
  MemberTable,
  ExportButton,
  MemberProfileCard,
  CrossServerView,
  RoleList,
  MemberPermissionsPanel,
  SearchInput,
} from './components';
export type {
  CrossServerListItemDto,
  MemberCrossServerViewDto,
  MemberDetail,
  MemberDetailDto,
  MemberFilters as MemberFiltersType,
  MemberListItem,
  MemberListServerSummary,
  MemberPermissionsDto,
  MemberRole,
  MemberServerDetail,
  PaginatedCrossServerListDto,
  ServerRoleOptionDto,
  ServerRolesResponseDto,
} from './types';
