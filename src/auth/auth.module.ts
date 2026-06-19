import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { RedisModule } from '../redis/redis.module';
import { ApiKeyGuard } from './guards/api-key.guard';
import { JwtAuthGuard } from './guards/jwt.guard';

@Module({
  imports: [
    SupabaseModule,
    RedisModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('API_KEY_HMAC_SECRET'), // ou o nome da sua variável
        signOptions: { 
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '1d') as any 
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, ApiKeyGuard, JwtAuthGuard],
  exports: [AuthService, ApiKeyGuard, JwtAuthGuard],
})
export class AuthModule {}
