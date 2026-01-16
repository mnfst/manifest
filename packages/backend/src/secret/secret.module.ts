import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSecretEntity } from './secret.entity';
import { SecretService } from './secret.service';
import { SecretController } from './secret.controller';
import { AuthModule } from '../auth';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppSecretEntity]),
    AuthModule,
  ],
  controllers: [SecretController],
  providers: [SecretService],
  exports: [SecretService],
})
export class SecretModule {}
