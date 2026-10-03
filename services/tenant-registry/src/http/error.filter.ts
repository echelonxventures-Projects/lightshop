import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { RegistryError } from '../application/errors';

const STATUS: Record<RegistryError['code'], number> = {
  NOT_FOUND: 404, VALIDATION_FAILED: 422, CONFLICT: 409, UNAUTHENTICATED: 401, FORBIDDEN: 403,
};

/** Maps application errors to HTTP with a stable body: { code, message, details }. */
@Catch(RegistryError)
export class RegistryErrorFilter implements ExceptionFilter {
  catch(error: RegistryError | HttpException, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const e = error as RegistryError;
    res.status(STATUS[e.code]).json({ code: e.code, message: e.message, details: e.details });
  }
}
