import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { SkipGlobalThrottle } from '../../common/guards/app-throttler.guard';
import { InboundWebhooksService } from './inbound-webhooks.service';
import type { SubmitBody } from './dto/submit.dto';

type ProjectRequest = RawBodyRequest<Request> & {
  project?: { id: string };
};

/**
 * Write-only surface, authenticated by the project's API key.
 *
 * Deliberately exposes no read route: a project submits, it does not read
 * back accumulated submissions. Reading is gated on Discord roles instead,
 * on a separate controller behind a separate guard.
 */
@ApiTags('Inbound Webhooks (Ingest)')
@ApiSecurity('api-key')
// Has its own Redis limit (per webhook and per project)
@SkipGlobalThrottle()
@Controller('inbound-webhooks')
@UseGuards(ApiKeyGuard)
export class InboundWebhookIngestController {
  constructor(private readonly service: InboundWebhooksService) {}

  @Post(':id/submit')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit a payload',
    description:
      'Validated against the webhook schema. Every field error is returned at once.',
  })
  @ApiParam({ name: 'id' })
  @ApiHeader({
    name: 'X-MCDI-Signature',
    required: false,
    description: 't=<unix seconds>,v1=<hex hmac-sha256 of "t.<raw body>">',
  })
  @ApiCreatedResponse({ description: 'Accepted.' })
  @ApiBadRequestResponse({
    description: 'Bad signature (401) or rate limited (429).',
  })
  @ApiForbiddenResponse({ description: 'Origin not in the allowlist.' })
  @ApiNotFoundResponse({ description: 'No such webhook for this project.' })
  @ApiConflictResponse({ description: 'Signature replayed.' })
  @ApiGoneResponse({ description: 'Webhook is inactive.' })
  @ApiUnprocessableEntityResponse({
    description: 'Payload failed schema validation.',
  })
  async submit(
    @Param('id') id: string,
    @Body() body: SubmitBody,
    @Req() req: ProjectRequest,
  ) {
    return this.service.ingest(id, body ?? {}, {
      projectId: req.project?.id ?? '',
      rawBody: req.rawBody,
      signatureHeader: req.headers['x-mcdi-signature'] as string | undefined,
      origin: req.headers.origin,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
