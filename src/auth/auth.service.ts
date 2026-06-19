import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHmac, randomBytes } from 'crypto';
import { RedisService } from '../redis/redis.service';
import { SupabaseService } from '../supabase/supabase.service';

interface JwtPayload {
  sub: string;
  tenant_id: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly hmacSecret: string;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.hmacSecret = this.config.get<string>('API_KEY_HMAC_SECRET')!;
  }

  // ── HMAC helper ───────────────────────────────────────────────────────
  private hmacKey(rawKey: string): string {
    return createHmac('sha256', this.hmacSecret).update(rawKey).digest('hex');
  }

  // ── API Keys ──────────────────────────────────────────────────────────
  async createApiKey(tenantId: string, label?: string): Promise<{ apiKey: string }> {
    const rawKey = `kmm_${randomBytes(24).toString('hex')}`;
    const keyHash = this.hmacKey(rawKey);

    const { error } = await this.supabase.getClient().from('api_keys').insert({
      tenant_id: tenantId,
      key_hash: keyHash,
      label: label ?? null,
    });

    if (error) {
      this.logger.error(`Erro ao criar API key: ${error.message}`);
      throw error;
    }

    return { apiKey: rawKey };
  }

  async validateApiKey(rawKey: string): Promise<{ tenantId: string } | null> {
    const keyHash = this.hmacKey(rawKey);
    const cacheKey = `apikey:${keyHash}`;

    const cached = await this.redis.getClient().get(cacheKey);
    if (cached) return JSON.parse(cached);

    const { data: key, error } = await this.supabase
      .getClient()
      .from('api_keys')
      .select('tenant_id')
      .eq('key_hash', keyHash)
      .is('revoked_at', null)
      .single();

    if (error || !key) return null;

    const result = { tenantId: key.tenant_id };
    await this.redis.getClient().set(cacheKey, JSON.stringify(result), 'EX', 300);
    return result;
  }

  // ── Login ─────────────────────────────────────────────────────────────
  async login(email: string, password: string) {
    const { data: user, error } = await this.supabase
      .getClient()
      .from('users')
      .select('id, tenant_id, password_hash, role')
      .eq('email', email)
      .single();

    // Mesma mensagem para "não existe" e "senha errada" — evita enumeração de e-mails
    if (error || !user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.issueTokens({ sub: user.id, tenant_id: user.tenant_id, role: user.role });
  }

  // ── Refresh ───────────────────────────────────────────────────────────
  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('JWT_SECRET'),
      }) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    const stored = await this.redis.getClient().get(`refresh:${payload.sub}`);
    if (stored !== refreshToken) {
      throw new UnauthorizedException('Refresh token revogado');
    }

    // Rotation: invalida o antigo antes de emitir novo par
    await this.redis.getClient().del(`refresh:${payload.sub}`);
    return this.issueTokens(payload);
  }

  // ── Logout ────────────────────────────────────────────────────────────
  async logout(userId: string) {
    await this.redis.getClient().del(`refresh:${userId}`);
  }

  // ── Utilitários ───────────────────────────────────────────────────────
  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 12);
  }

  private async issueTokens(payload: JwtPayload) {
    const secret = this.config.get<string>('JWT_SECRET');

    const accessToken = this.jwt.sign(
      { sub: payload.sub, tenant_id: payload.tenant_id, role: payload.role },
      {
        secret,
        expiresIn: this.config.get<string>('JWT_EXPIRES_IN') as any,
      },
    );

    const refreshToken = this.jwt.sign(
      { sub: payload.sub, tenant_id: payload.tenant_id, role: payload.role },
      {
        secret,
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') as any,
      },
    );

    await this.redis.getClient().set(
      `refresh:${payload.sub}`,
      refreshToken,
      'EX',
      this.parseExpiryToSeconds(this.config.get<string>('JWT_REFRESH_EXPIRES_IN')!),
    );

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  private parseExpiryToSeconds(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1), 10);
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit] ?? 60);
  }
}
