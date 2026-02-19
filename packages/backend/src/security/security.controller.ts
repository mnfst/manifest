import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { RangeQueryDto } from '../common/dto/range-query.dto';
import { SecurityService } from './security.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { UserCacheInterceptor } from '../common/interceptors/user-cache.interceptor';
import { DASHBOARD_CACHE_TTL_MS } from '../common/constants/cache.constants';

@Controller('api/v1')
@UseInterceptors(UserCacheInterceptor)
@CacheTTL(DASHBOARD_CACHE_TTL_MS)
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('security')
  async getSecurity(@Query() query: RangeQueryDto, @CurrentUser() user: AuthUser) {
    const range = query.range ?? '24h';
    return this.securityService.getSecurityOverview(range, user.id);
  }
}
