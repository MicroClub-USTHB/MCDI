import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ProjectThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const project = req.project as { id?: string } | undefined;
    const id = project?.id;
    const ip = req.ip as string | undefined;
    return Promise.resolve(id ?? ip ?? 'anonymous');
  }
}
