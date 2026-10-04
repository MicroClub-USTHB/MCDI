import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { InboundWebhooksRepository } from '../inbound-webhooks.repository';
import { InboundWebhooksService } from '../inbound-webhooks.service';

export type RequestWithReadAccess = Request & {
  memberId: string;
  /** The role that granted access, recorded in the audit entry. */
  matchedViaRoleId?: string | null;
};

/**
 * Gates submission reads on Discord role membership.
 *
 * The grant is the only way in: a system admin role does not bypass it. An
 * admin who needs to read a webhook grants it a role they hold.
 *
 * Runs after SessionGuard, which populates `req.memberId`.
 *
 * A webhook that sets `allowRoleInheritance` also admits members whose role
 * inherits a granted role (see `InboundWebhooksRepository.findInheritedGrants`).
 *
 * Denial is a 404, never a 403: a 403 would confirm the webhook exists and
 * that the caller merely lacks permission, which is an enumeration oracle
 * over the organisation's forms.
 */
@Injectable()
export class InboundWebhookReadGuard implements CanActivate {
  constructor(
    private readonly repository: InboundWebhooksRepository,
    private readonly service: InboundWebhooksService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithReadAccess>();
    const memberId = request.memberId;
    const rawId = request.params?.['id'];
    const webhookId = typeof rawId === 'string' ? rawId : null;

    if (!memberId || !webhookId) {
      throw new NotFoundException('Inbound webhook not found');
    }

    // Granted roles are cached; the member's own roles deliberately are not.
    const [allowedRoleIds, memberRoleIds] = await Promise.all([
      this.service.getAllowedRoleIdsCached(webhookId),
      this.repository.findMemberRoleIds(memberId),
    ]);

    const held = new Set(memberRoleIds);
    const matched = allowedRoleIds.find((roleId) => held.has(roleId));

    if (matched) {
      request.matchedViaRoleId = matched;
      return true;
    }

    // Webhooks with `allowRoleInheritance` also admit a member whose role
    // inherits a granted one. Like the member's own roles, never cached.
    const inherited = await this.repository.findInheritedGrantRoleId(
      memberId,
      webhookId,
    );
    if (inherited) {
      request.matchedViaRoleId = inherited;
      return true;
    }

    // Record the denial before hiding the resource — repeated denials on one
    // webhook is the signal that somebody is probing.
    await this.service.auditReadDenied(webhookId, memberId);
    throw new NotFoundException('Inbound webhook not found');
  }
}
