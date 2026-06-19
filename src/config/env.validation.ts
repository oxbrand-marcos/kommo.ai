import { plainToInstance } from 'class-transformer';
import {
    IsIn,
    IsNumber,
    IsString,
    MinLength,
    validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: string;

  @IsNumber()
  PORT: number;

  @IsString()
  SUPABASE_URL: string;

  @IsString()
  SUPABASE_SERVICE_KEY: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  @IsString()
  JWT_EXPIRES_IN: string;

  @IsString()
  JWT_REFRESH_EXPIRES_IN: string;

  @IsString()
  REDIS_URL: string;

  @IsString()
  @MinLength(32)
  KOMMO_WEBHOOK_SECRET: string;

  @IsString()
  ANTHROPIC_API_KEY: string;

  @IsString()
  KOMMO_SUBDOMAIN: string;

  @IsString()
  KOMMO_ACCESS_TOKEN: string;

  @IsString()
  KOMMO_BOT_ID: string;

  @IsString()
  KOMMO_FIELD_ID: string;

  @IsString()
  ANTHROPIC_MODEL: string;

  @IsString()
  AI_SYSTEM_PROMPT: string;

  @IsString()
  @MinLength(32)
  API_KEY_HMAC_SECRET: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const messages = errors
      .map((err) => Object.values(err.constraints ?? {}).join(', '))
      .join(' | ');
    throw new Error(`Configuração de ambiente inválida: ${messages}`);
  }

  return validated;
}
