import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Segurança: headers HTTP
  app.use(helmet());

  // Prefixo global para todas as rotas
  app.setGlobalPrefix('api/v1');

  // Validação automática de todos os DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // remove campos não declarados no DTO
      forbidNonWhitelisted: true, // rejeita requisição se vier campo extra
      transform: true,        // converte tipos automaticamente
    }),
  );

  // CORS (ajustar origens em produção)
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? false : '*',
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Aplicacao rodando em: http://localhost:${port}/api/v1`);
}

bootstrap();