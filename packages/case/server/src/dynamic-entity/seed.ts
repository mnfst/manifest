import { NestFactory } from '@nestjs/core'
import * as chalk from 'chalk'

import { AppModule } from '../app.module'
import { DynamicEntitySeeder } from './dynamic-entity.seeder'

/**
 * Bootstrap function to initialize the application
 */
async function bootstrap() {
  NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn']
  })
    .then((appContext) => {
      const seeder = appContext.get(DynamicEntitySeeder)
      seeder
        .seed()
        .then(() => {
          console.log(
            chalk.green(
              '🌱 Seed complete ! Please refresh your browser to see the new data.'
            )
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
