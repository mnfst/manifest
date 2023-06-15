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
          console.log('Seeding complete!')
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
