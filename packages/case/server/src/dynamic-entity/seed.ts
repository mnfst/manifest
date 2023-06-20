import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module'
import { DynamicEntitySeeder } from './dynamic-entity.seeder'

async function bootstrap() {
  NestFactory.createApplicationContext(AppModule)
    .then((appContext) => {
      const seeder = appContext.get(DynamicEntitySeeder)
      seeder
        .seed()
        .then(() => {
          console.log(
            '\x1b[33m',
            '[x] Seed complete ! Please refresh your browser to see the new data.'
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
