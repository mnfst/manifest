import { INestApplicationContext } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module'
import { SeederService } from './seeder.service'

async function bootstrap() {
  NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn']
  })
    .then((appContext: INestApplicationContext) => {
      console.log('🌱 Seeding database...')

      appContext
        .get(SeederService)
        .seed()
        .then(() => {
          console.log(
            '🌱 Seed complete ! Please refresh your browser to see your new data.'
          )
        })
        .catch((error) => {
          console.error('Seeding failed!')
          throw error
        })
        .finally(() => appContext.close())
    })
    .catch((error) => {
      throw error
    })
}
bootstrap()
