import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [SupabaseModule, RedisModule],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
