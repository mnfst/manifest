import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Get health status of the app'
  })
  @ApiOkResponse({
    description: 'Health status of the app',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          example: 'OK'
        }
      }
    }
  })
  getHealth() {
    return { status: 'OK' }
  }
}
