import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

/**
 * App Controller
 *
 * Root controller for the application.
 */
@Controller()
export class AppController {
  @Public()
  @Get()
  root() {
    // ServeStaticModule will handle serving index.html
    // This route is just a placeholder
    return { message: 'Manifest is running' };
  }
}
