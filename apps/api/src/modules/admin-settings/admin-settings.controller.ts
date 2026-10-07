import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AdminAccessGuard } from '../../common/guards/admin-access.guard';
import { RequirePermission } from '../../common/decorators/admin-access.decorator';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { EffectiveSettingsDto } from './dto/settings-response.dto';

type RequestWithMember = Request & { memberId: string };

/**
 * Admin-session settings API. Reads the effective operational config
 * (env defaults + `app_settings` overrides); writes only the handful of
 * knobs marked `editable` in the response. Discord credentials and other
 * boot-time config are surfaced read-only — secrets only as `isSet`.
 */
@ApiTags('Admin Settings')
@ApiBearerAuth('session-token')
@Controller('admin/settings')
@UseGuards(AdminAccessGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermission('settings', 'read')
  @ApiOperation({
    summary: 'Get effective system settings',
    description:
      'Returns settings grouped by category. Each value carries `editable`; ' +
      'secrets are represented only as `{ isSet }`.',
  })
  @ApiOkResponse({
    description: 'Current settings.',
    type: EffectiveSettingsDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  getSettings(): EffectiveSettingsDto {
    return this.settings.getEffectiveSettings();
  }

  @Patch()
  @RequirePermission('settings', 'write')
  @ApiOperation({
    summary: 'Update editable settings',
    description:
      'Persists the provided editable knobs and applies them without a ' +
      'restart. Any non-editable key is rejected by the validation pipe.',
  })
  @ApiOkResponse({
    description: 'Updated settings.',
    type: EffectiveSettingsDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid or non-editable field.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  updateSettings(
    @Body() dto: UpdateSettingsDto,
    @Req() req: RequestWithMember,
  ): Promise<EffectiveSettingsDto> {
    return this.settings.updateSettings(dto, req.memberId);
  }

  @Post('reset')
  @RequirePermission('settings', 'manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset editable settings to environment defaults',
    description: 'Clears every stored override; read-only config is untouched.',
  })
  @ApiOkResponse({
    description: 'Settings after reset.',
    type: EffectiveSettingsDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  resetSettings(@Req() req: RequestWithMember): Promise<EffectiveSettingsDto> {
    return this.settings.resetSettings(req.memberId);
  }
}
