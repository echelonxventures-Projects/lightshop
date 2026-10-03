import { Catch } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { CatalogError } from '../application/errors';

/**
 * Client errors (bad input, unknown tenant) are part of the API contract, not server faults:
 * hand them to Apollo's formatError untouched instead of letting Nest log them as ERROR.
 */
@Catch(CatalogError)
export class CatalogErrorFilter implements GqlExceptionFilter {
  catch(error: CatalogError): CatalogError {
    return error;
  }
}
