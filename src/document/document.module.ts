import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}
