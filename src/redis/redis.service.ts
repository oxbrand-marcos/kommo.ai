import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL')!;

    // Detecta se é Upstash (rediss://) ou Redis local (redis://)
    const isTls = redisUrl.startsWith('rediss://');

    this.client = new Redis(redisUrl, {
      // SSL obrigatório para Upstash
      tls: isTls ? {} : undefined,

      // Retry com backoff — para de tentar depois de 3 falhas
      retryStrategy: (times) => {
        if (times > 3) {
          this.logger.error('Redis: não foi possível conectar após 3 tentativas.');
          return null;
        }
        return Math.min(times * 500, 2000);
      },

      // Evita o "Unhandled error event" que spamava o terminal
      lazyConnect: false,
    });

    this.client.on('connect', () => {
      this.logger.log(`Redis conectado (${isTls ? 'Upstash TLS' : 'local'})`);
    });

    this.client.on('error', (err: Error) => {
      this.logger.error(`Redis erro: ${err.message}`);
    });
  }

  onModuleDestroy() {
    this.client.disconnect();
  }

  getClient(): Redis {
    return this.client;
  }
}