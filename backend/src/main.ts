import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger/swagger.setup';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // validating incoming requests bodies automitacally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: false,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const configService = app.get(ConfigService);

  setupSwagger(app);

  await app.listen(configService.get<string>('PORT') ?? 3000);
}
bootstrap();
