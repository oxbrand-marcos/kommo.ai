import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('X-API-Key não fornecida');
    }

    const result = await this.authService.validateApiKey(apiKey);
    if (!result) {
      throw new UnauthorizedException('API Key inválida ou revogada');
    }

    request.tenantId = result.tenantId;
    return true;
  }
}
