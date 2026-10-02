import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { SessionGuard } from '../../common/guards/session.guard';
import { InboundWebhookReadGuard } from './guards/inbound-webhook-read.guard';
import type { RequestWithReadAccess } from './guards/inbound-webhook-read.guard';
import { InboundWebhooksService } from './inbound-webhooks.service';
import { ListSubmissionsDto } from './dto/list-submissions.dto';

/**
 * Read surface for club members, gated on Discord role membership.
 * Every route here is audited, and every denial returns 404.
 */
@ApiTags('Inbound Webhooks (Read)')
@ApiBearerAuth('session-token')
@Controller('inbound-webhooks')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class InboundWebhookReadController {
  constructor(private readonly service: InboundWebhooksService) {}

  @Get()
  @UseGuards(SessionGuard)
  @ApiOperation({
    summary: 'List the inbound webhooks I am permitted to read',
    description:
      'Filtered by role inside the query, so totals never reveal webhooks the caller cannot see.',
  })
  @ApiOkResponse({ description: 'Readable webhooks.' })
  async listMine(@Req() req: RequestWithReadAccess) {
    return this.service.listReadableByMember(req.memberId);
  }

  @Get(':id/submissions')
  @UseGuards(SessionGuard, InboundWebhookReadGuard)
  @ApiOperation({ summary: 'List submissions' })
  @ApiParam({ name: 'id' })
  @ApiNotFoundResponse({
    description: 'No such webhook, or the caller holds none of its roles.',
  })
  async listSubmissions(
    @Param('id') id: string,
    @Query() query: ListSubmissionsDto,
    @Req() req: RequestWithReadAccess,
  ) {
    return this.service.listSubmissions(
      id,
      {
        limit: query.limit ?? 50,
        offset: query.offset ?? 0,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      },
      req.memberId,
      req.matchedViaRoleId ?? null,
    );
  }

  @Get(':id/submissions/:submissionId')
  @UseGuards(SessionGuard, InboundWebhookReadGuard)
  @ApiOperation({ summary: 'Get one submission' })
  @ApiNotFoundResponse({
    description:
      'No such webhook or submission, or the caller holds none of its roles.',
  })
  async getSubmission(
    @Param('id') id: string,
    @Param('submissionId') submissionId: string,
    @Req() req: RequestWithReadAccess,
  ) {
    return this.service.getSubmission(id, submissionId, req.memberId);
  }
}
