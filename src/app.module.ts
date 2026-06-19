import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { SupabaseModule } from './supabase/supabase.module';
import { RedisModule } from './redis/redis.module';
import { ConversationModule } from './conversation/conversation.module';
import { ClaudeModule } from './claude/claude.module';
import { KommoModule } from './kommo/kommo.module';
import { AuthModule } from './auth/auth.module';
import { DocumentModule } from './document/document.module';

@Module({
  imports: [
    ConfigModule,
    SupabaseModule,
    RedisModule,
    ConversationModule,
    ClaudeModule,
    KommoModule,
    AuthModule,
    DocumentModule,
  ],
})
export class AppModule {}
