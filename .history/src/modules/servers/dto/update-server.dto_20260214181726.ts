import { CreateServerDto } from './create-server.dto';
import { OmitType, PartialType } from '@nestjs/swagger';

export class UpdateServerDto extends PartialType(
    OmitType(classRef, keys)(CreateServerDto, ['guildId', 'isActive', 'disabledReason'] as const),
) {}
