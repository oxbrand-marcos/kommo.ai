import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { LoginDto } from '../kommo/dto/login.dto';
import { RefreshDto } from '../kommo/dto/refresh.dto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: any) {
    await this.authService.logout(req.user.sub);
    return { message: 'Logout realizado' };
  }

  @Post('api-keys')
  @UseGuards(JwtAuthGuard)
  async createApiKey(@Req() req: any) {
    if (req.user.role !== 'admin') {
      throw new Error('Apenas administradores podem gerar API Keys');
    }
    return this.authService.createApiKey(req.user.tenant_id);
  }
}
