import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '../../../prisma/generated/prisma/client';


@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errors: string[] | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        message = (resObj.message as string | string[]) ?? exception.message;
        if (Array.isArray(resObj.message)) {
          errors = resObj.message as string[];
          message = 'Validation failed';
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Translate common Prisma error codes into sensible HTTP responses
      switch (exception.code) {
        case 'P2002': {
          statusCode = HttpStatus.CONFLICT;
          const target = (exception.meta?.target as string[])?.join(', ');
          message = `A record with this ${target ?? 'value'} already exists`;
          break;
        }
        case 'P2025':
          statusCode = HttpStatus.NOT_FOUND;
          message = 'Requested record was not found';
          break;
        case 'P2003':
          statusCode = HttpStatus.BAD_REQUEST;
          message = 'Invalid reference to a related record';
          break;
        default:
          statusCode = HttpStatus.BAD_REQUEST;
          message = 'Database request error';
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided to the database layer';
    } else if (exception instanceof Error) {
      message = exception.message || message;
    }

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${statusCode}`);
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      path: request.url,
      timestamp: new Date().toISOString(),
      message,
      ...(errors ? { errors } : {}),
    });
  }
}
