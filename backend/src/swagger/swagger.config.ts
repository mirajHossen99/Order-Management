import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('Order-Management API Documentation')
  .setDescription(
    'Order-Management API documentation for the application services',
  )
  .setVersion('1.0')
  .addCookieAuth('refreshToken')
  .addTag('API')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      in: 'header',
    },
    'auth',
  )
  .addSecurityRequirements('auth')
  .build();
