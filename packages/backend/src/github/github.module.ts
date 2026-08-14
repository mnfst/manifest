import { Module } from '@nestjs/common';
import { GithubController } from './github.controller';

@Module({
  controllers: [GithubController],
})
export class GithubModule {}
