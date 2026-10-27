import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';

async function bootstrap() {
  const logger = new Logger('OmniAI-Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000,http://localhost:3001');

  // Set global API prefix
  app.setGlobalPrefix(apiPrefix);

  // Enable CORS
  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global standardized response interceptor
  app.useGlobalInterceptors(new TransformResponseInterceptor());

  // Global RFC 7807 exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(port);
  logger.log(`OmniAI Seller Hub backend running on http://localhost:${port}/${apiPrefix}`);
}

await bootstrap();
