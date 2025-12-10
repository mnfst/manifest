import { Controller, Get } from '@nestjs/common'
import { DatabaseService } from '../services/database.service'

@Controller('db')
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get('is-db-empty')
  public async isDbEmpty(): Promise<{
    empty: boolean
  }> {
    const empty = await this.databaseService.isDbEmpty()

    return { empty }
  }
}
