import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger/swagger.setup';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  setupSwagger(app);

  await app.listen(configService.get<string>('PORT') ?? 3000);
}
bootstrap();
