import { HttpError } from '@errors/http/http-error';
import { APIGatewayProxyResult } from 'aws-lambda/trigger/api-gateway-proxy';

export interface ResponseError {
  status: number;
  message: string;
  details?: Record<string, string>;
}

export function handleError(error: unknown): APIGatewayProxyResult {
  if (error instanceof HttpError) {
    return createErrorResponseError({
      status: error.statusCode,
      message: error.message,
    });
  } else if (error instanceof Error) {
    return createErrorResponseError({
      status: 500,
      message: 'Internal Server Error',
    });
  }

  return createErrorResponseError({
    status: 500,
    message: 'Internal Server Error',
  });
}

export function createErrorResponseError(error: ResponseError): APIGatewayProxyResult {
  return createResponse(error.status, error);
}

export function createResponse(code: number, body?: any): APIGatewayProxyResult {
  if (body !== undefined) {
    return {
      statusCode: code,
      body: JSON.stringify(body),
    };
  }

  return {
    statusCode: code,
    body: '',
  };
}
