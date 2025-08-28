import { Controller, Post } from '@nestjs/common'
import { SeederService } from '../../services/seeder.service'

@Controller('seeder')
export class SeederController {
  constructor(private readonly seederService: SeederService) {}

  @Post('seed')
  seed() {
    return this.seederService.seed()
  }
}
