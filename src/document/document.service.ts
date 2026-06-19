import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import axios from 'axios';

const CACHE_TTL_SECONDS = 60 * 30; // 30 min

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Retorna o contexto (dados da empresa) a ser injetado no system prompt.
   * Hoje: busca o CSV configurado no .env (igual ao comportamento antigo).
   * Fase 2: vai buscar o documento que o tenant subiu via upload (Supabase Storage).
   */
  async getContextForTenant(tenantId: string): Promise<string | null> {
    const cacheKey = `context:${tenantId}`;
    const cached = await this.redis.getClient().get(cacheKey);
    if (cached) return cached;

    const csvUrl = this.config.get<string>('PLANILHA_CSV_URL');
    if (!csvUrl) return null;

    try {
      const response = await axios.get(csvUrl, { timeout: 5000 });
      const content = response.data as string;
      await this.redis.getClient().set(cacheKey, content, 'EX', CACHE_TTL_SECONDS);
      return content;
    } catch (err) {
      this.logger.warn(`Falha ao carregar contexto: ${(err as Error).message}`);
      return null;
    }
  }
}
