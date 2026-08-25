import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isUUID } from 'class-validator';
import Discord from 'discord.js';
import { DiscordService } from '../discord/discord.service';
import { encryptSecret } from '../../common/utils/encryption.util';
import { WebhookRow, WebhooksRepository } from './webhooks.repository';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { ListWebhooksQueryDto } from './dto/list-webhooks-query.dto';
import {
  WebhookCreatedResponseDto,
  WebhookDetailResponseDto,
  WebhookListResponseDto,
  WebhookSummaryDto,
} from './dto/webhook-response.dto';

const MAX_AVATAR_BYTES = 256 * 1024;
const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

@Injectable()
export class WebhooksService {
  constructor(
    private readonly discordService: DiscordService,
    private readonly webhooksRepository: WebhooksRepository,
    private readonly configService: ConfigService,
  ) {}

  async createWebhook(
    serverId: string,
    channelId: string,
    projectId: string,
    dto: CreateWebhookDto,
  ): Promise<WebhookCreatedResponseDto> {
    const encryptionKey = this.encryptionKey();
    if (!encryptionKey) {
      throw new InternalServerErrorException({
        code: 'ENCRYPTION_KEY_MISSING',
        message: 'WEBHOOK_ENCRYPTION_KEY is not configured',
      });
    }

    const avatar =
      dto.avatar === undefined ? undefined : this.decodeAvatar(dto.avatar);

    const channel = await this.discordService.getChannelById(channelId);

    if (!channel) {
      throw new NotFoundException({
        code: 'CHANNEL_NOT_FOUND',
        message: 'Channel does not exist or bot lacks webhook access',
      });
    }

    // Discord only accepts webhooks on standard guild channels, so a DM,
    // a thread or a category has to be rejected before the API call
    if (
      channel.isDMBased() ||
      channel.isThread() ||
      channel.type === Discord.ChannelType.GuildCategory
    ) {
      throw new BadRequestException({
        code: 'INVALID_CHANNEL_TYPE',
        message: 'Webhooks can only be created in standard server channels',
      });
    }

    const created = await this.discordService.createWebhook(
      channelId,
      dto.name,
      avatar ? { name: dto.name, avatar } : undefined,
    );

    if (!created) {
      throw new BadGatewayException({
        code: 'DISCORD_ERROR',
        message: 'Discord refused to create the webhook',
      });
    }

    if (!created.token) {
      // Discord only returns tokens for incoming webhooks; anything else is unusable
      await this.discordService.deleteWebhook(created.id);
      throw new BadGatewayException({
        code: 'DISCORD_ERROR',
        message: 'Discord did not return a webhook token',
      });
    }

    let row: WebhookRow;
    try {
      row = await this.webhooksRepository.create({
        discordWebhookId: created.id,
        projectId,
        serverId,
        channelId,
        name: created.name,
        avatar: created.avatar ?? null,
        encryptedToken: encryptSecret(created.token, encryptionKey),
      });
    } catch (error) {
      // Don't leave an orphaned webhook on Discord when the row can't be stored
      await this.discordService.deleteWebhook(created.id);
      throw error;
    }

    return {
      id: row.id,
      name: row.name,
      channelId: row.channelId,
      serverId: row.serverId,
      projectId: row.projectId,
      createdAt: row.createdAt.toISOString(),
      usageCount: row.usageCount,
    };
  }

  async listWebhooks(
    projectId: string,
    requestedProjectId: string,
    query: ListWebhooksQueryDto,
  ): Promise<WebhookListResponseDto> {
    if (requestedProjectId !== projectId) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found',
      });
    }

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const { rows, total } = await this.webhooksRepository.findByProject({
      projectId,
      serverId: query.serverId,
      limit,
      offset,
    });

    return {
      webhooks: rows.map((row) => this.toSummary(row)),
      total,
      limit,
      offset,
    };
  }

  async getWebhook(
    webhookId: string,
    projectId: string,
  ): Promise<WebhookDetailResponseDto> {
    const row = await this.findOwnedWebhook(webhookId, projectId);
    return this.toDetail(row);
  }

  async updateWebhook(
    webhookId: string,
    projectId: string,
    dto: UpdateWebhookDto,
  ): Promise<WebhookDetailResponseDto> {
    const row = await this.findOwnedWebhook(webhookId, projectId);

    const discordEdit: Discord.WebhookEditOptions = {};
    if (dto.name !== undefined) {
      discordEdit.name = dto.name;
    }
    if (dto.avatar !== undefined) {
      discordEdit.avatar =
        dto.avatar === null ? null : this.decodeAvatar(dto.avatar);
    }

    if (Object.keys(discordEdit).length === 0) {
      return this.toDetail(row);
    }

    const edited = await this.discordService.editWebhook(
      row.discordWebhookId,
      discordEdit,
    );

    if (!edited) {
      throw new BadGatewayException({
        code: 'DISCORD_ERROR',
        message: 'Failed to update webhook on Discord',
      });
    }

    const updated = await this.webhooksRepository.update(row.id, {
      name: edited.name,
      avatar: edited.avatar ?? null,
    });

    if (!updated) {
      throw new NotFoundException({
        code: 'WEBHOOK_NOT_FOUND',
        message: 'Webhook not found',
      });
    }

    return this.toDetail(updated);
  }

  async deleteWebhook(webhookId: string, projectId: string): Promise<void> {
    const row = await this.findOwnedWebhook(webhookId, projectId);

    const deleted = await this.discordService.deleteWebhook(
      row.discordWebhookId,
    );

    if (!deleted) {
      throw new BadGatewayException({
        code: 'DISCORD_ERROR',
        message: 'Failed to delete webhook on Discord',
      });
    }

    await this.webhooksRepository.delete(row.id);
  }

  // 404 for a missing row and for another project's row alike, so webhook
  // ids cannot be probed across projects
  private async findOwnedWebhook(
    webhookId: string,
    projectId: string,
  ): Promise<WebhookRow> {
    const row = isUUID(webhookId)
      ? await this.webhooksRepository.findById(webhookId)
      : null;

    if (!row || row.projectId !== projectId) {
      throw new NotFoundException({
        code: 'WEBHOOK_NOT_FOUND',
        message: 'Webhook not found',
      });
    }

    return row;
  }

  private toSummary(row: WebhookRow): WebhookSummaryDto {
    return {
      id: row.id,
      name: row.name,
      channelId: row.channelId,
      channelName: this.discordService.getCachedChannelName(row.channelId),
      serverId: row.serverId,
      serverName: this.discordService.getCachedGuildName(row.serverId),
      createdAt: row.createdAt.toISOString(),
      usageCount: row.usageCount,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    };
  }

  private toDetail(row: WebhookRow): WebhookDetailResponseDto {
    return { ...this.toSummary(row), avatar: row.avatar };
  }

  private decodeAvatar(avatar: string): Buffer {
    let base64 = avatar;

    if (avatar.startsWith('data:')) {
      const marker = ';base64,';
      const markerIndex = avatar.indexOf(marker);
      if (markerIndex === -1) {
        throw new BadRequestException({
          code: 'INVALID_AVATAR',
          message: 'Avatar data URI must be base64 encoded',
        });
      }
      base64 = avatar.slice(markerIndex + marker.length);
    }

    if (!BASE64_PATTERN.test(base64)) {
      throw new BadRequestException({
        code: 'INVALID_AVATAR',
        message: 'Avatar must be a base64-encoded image',
      });
    }

    const decoded = Buffer.from(base64, 'base64');

    if (decoded.byteLength === 0) {
      throw new BadRequestException({
        code: 'INVALID_AVATAR',
        message: 'Avatar must be a base64-encoded image',
      });
    }

    if (decoded.byteLength > MAX_AVATAR_BYTES) {
      throw new BadRequestException({
        code: 'INVALID_AVATAR',
        message: 'Avatar must decode to at most 256KB',
      });
    }

    return decoded;
  }

  private encryptionKey(): string {
    return this.configService.get<string>('app.webhookEncryptionKey') ?? '';
  }
}
