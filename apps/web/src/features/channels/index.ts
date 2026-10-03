export const channels = {
  name: 'Channels',
  route: '/dashboard/channels',
} as const;

export { channelKeys } from './api/keys';
export { fetchChannels, fetchChannel, fetchMessageHistory } from './api/service';
export { useChannelsQuery, useChannelQuery, useMessageHistoryQuery } from './api/queries';
export {
  mapChannelTree,
  mapChannelDetail,
  mapMessage,
  mapMessageList,
  decimalToHex,
  authorAvatarUrl,
} from './api/mappers';
export type {
  ChannelNode,
  ChannelGroup,
  ChannelTreeModel,
  ChannelDetailView,
  MessageView,
  MessageEmbedView,
} from './api/mappers';
export { ChannelTree, ChannelDetail, MessageHistory } from './components';
export type {
  ChannelDto,
  ChannelCategoryDto,
  ChannelListResponseDto,
  ChannelDetailDto,
  ChannelPermissionOverwriteDto,
  MessageDto,
  MessageHistoryResponseDto,
} from './types';
export { MESSAGE_HISTORY_LIMIT } from './types';
