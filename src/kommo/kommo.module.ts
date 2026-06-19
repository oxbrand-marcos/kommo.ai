import { Module } from '@nestjs/common';
import { KommoController } from './kommo.controller';
import { KommoService } from './kommo.service';
import { ClaudeModule } from '../claude/claude.module';
import { ConversationModule } from '../conversation/conversation.module';
import { DocumentModule } from '../document/document.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ClaudeModule, ConversationModule, DocumentModule, AuthModule],
  controllers: [KommoController],
  providers: [KommoService],
})
export class KommoModule {}
