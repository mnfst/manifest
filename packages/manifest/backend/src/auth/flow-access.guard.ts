import { Injectable, CanActivate, ExecutionContext, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppAccessService } from './app-access.service';
import { FlowEntity } from '../flow/flow.entity';
import type { Session } from './decorators/current-user.decorator';

/**
 * Guard to check if a user has access to a flow's parent app
 * Returns 404 (not 403) for unauthorized access to prevent information leakage
 *
 * IMPORTANT: This guard must be applied AFTER AuthGuard to ensure session exists
 *
 * Usage:
 * @UseGuards(FlowAccessGuard)
 * @Get('flows/:flowId')
 * getFlow(@Param('flowId') flowId: string) { ... }
 */
@Injectable()
export class FlowAccessGuard implements CanActivate {
  constructor(
    private readonly appAccessService: AppAccessService,
    @InjectRepository(FlowEntity)
    private readonly flowRepository: Repository<FlowEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const session = request.session as Session | undefined;

    // If no session, let AuthGuard handle it (should return 401)
    if (!session?.user?.id) {
      return true;
    }

    // Get flowId from route params
    const flowId = request.params.flowId;

    if (!flowId) {
      // No flowId in route, nothing to check
      return true;
    }

    // Get the flow to find its parent app
    const flow = await this.flowRepository.findOne({
      where: { id: flowId },
      select: ['id', 'appId'],
    });

    if (!flow) {
      // Flow doesn't exist - return 404
      throw new NotFoundException('Flow not found');
    }

    // Check if user has access to the parent app
    const hasAccess = await this.appAccessService.hasAccess(session.user.id, flow.appId);

    if (!hasAccess) {
      // Return 404 to prevent information leakage
      throw new NotFoundException('Flow not found');
    }

    return true;
  }
}
