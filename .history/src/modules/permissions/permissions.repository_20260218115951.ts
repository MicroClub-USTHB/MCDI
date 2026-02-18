import { Inject, Injectable } from '@nestjs/common';
import * as databaseModule from '../../database/database.module';

@Injectable()
export class PermissionsRepository {
  constructor(
    @Inject(databaseModule.DRIZZLE)
    private readonly db: databaseModule.DrizzleDB,
  ) {}
}
