import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_MESSAGES = 20;
const CACHE_TTL_SECONDS = 60 * 60; // 1h

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly redis: RedisService,
  ) {}

  private cacheKey(chatId: string) {
    return `history:${chatId}`;
  }

  async getHistory(chatId: string): Promise<ChatMessage[]> {
    const cached = await this.redis.getClient().get(this.cacheKey(chatId));
    if (cached) {
      return JSON.parse(cached);
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('conversations')
      .select('role, content')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(MAX_MESSAGES);

    if (error) {
      this.logger.error(`Erro ao buscar histórico: ${error.message}`);
      return [];
    }

    const history = (data ?? []) as ChatMessage[];
    await this.redis
      .getClient()
      .set(this.cacheKey(chatId), JSON.stringify(history), 'EX', CACHE_TTL_SECONDS);

    return history;
  }

  async addMessage(chatId: string, leadId: string, message: ChatMessage): Promise<void> {
    const { error } = await this.supabase.getClient().from('conversations').insert({
      chat_id: chatId,
      lead_id: leadId,
      role: message.role,
      content: message.content,
    });

    if (error) {
      this.logger.error(`Erro ao salvar mensagem: ${error.message}`);
    }

    // Invalida o cache para forçar releitura na próxima chamada
    await this.redis.getClient().del(this.cacheKey(chatId));
  }

  async clearHistory(chatId: string): Promise<void> {
    await this.supabase.getClient().from('conversations').delete().eq('chat_id', chatId);
    await this.redis.getClient().del(this.cacheKey(chatId));
  }
}
