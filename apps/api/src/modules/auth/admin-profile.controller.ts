import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AdminAccessGuard } from '../../common/guards/admin-access.guard';
import { AdminSessionOnly } from '../../common/decorators/admin-access.decorator';
import { AdminProfileService } from './services/admin-profile.service';
import {
  AdminProfileResponseDto,
  UpdateAdminProfileDto,
} from './dto/admin-profile.dto';

type RequestWithMember = Request & { memberId: string };

/**
 * Admin-session profile. `GET` mirrors the member fields of `/auth/admin/me`
 * (without the session context). The only writable field is `preferredName`,
 * a local display-name override that Discord sync never overwrites.
 */
@ApiTags('Admin Settings')
@ApiBearerAuth('session-token')
@Controller('admin/profile')
@UseGuards(AdminAccessGuard)
@AdminSessionOnly()
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class AdminProfileController {
  constructor(private readonly profileService: AdminProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Get the current admin profile' })
  @ApiOkResponse({
    description: 'Admin profile.',
    type: AdminProfileResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  getProfile(@Req() req: RequestWithMember): Promise<AdminProfileResponseDto> {
    return this.profileService.getProfile(req.memberId);
  }

  @Patch()
  @ApiOperation({
    summary: 'Update the admin profile',
    description:
      'Only `preferredName` is writable. Send null to clear it; omit it to ' +
      'leave it unchanged. Discord-owned fields cannot be changed here.',
  })
  @ApiOkResponse({
    description: 'Updated profile.',
    type: AdminProfileResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid field.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  updateProfile(
    @Body() dto: UpdateAdminProfileDto,
    @Req() req: RequestWithMember,
  ): Promise<AdminProfileResponseDto> {
    return this.profileService.updateProfile(req.memberId, dto);
  }
}
