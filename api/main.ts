import { HttpBadRequestError, HttpInternalServerError } from '@errors/http';
import { HttpError } from '@errors/http/http-error';
import { InputValidationError } from '@errors/runtime';
import { RuntimeError } from '@errors/runtime/runtime-error';
import { formatUnknownError } from '@helper/error-handler';
import middy from '@middy/core';
import errorLogger from '@middy/error-logger';
import jsonParser from '@middy/http-json-body-parser';
import inputOutputLogger from '@middy/input-output-logger';
import validator from '@middy/validator';
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { APIGatewayProxyStructuredResultV2 } from 'aws-lambda/trigger/api-gateway-proxy';
import httpErrors from 'http-errors';
import { createResponse } from './response';

//-- Middlewares

const formatError: middy.MiddlewareFn = (request) => {
  if (!(request.error instanceof HttpError)) {
    if (request.error === null) {
      request.error = new HttpInternalServerError();
    } else if (httpErrors.isHttpError(request.error)) {
      request.error = new HttpError(
        request.error.statusCode,
        request.error.name,
        request.error.message,
        request.error.details
          ? {
              data: request.error.details,
            }
          : undefined
      );
    } else {
      request.error = formatUnknownError(request.error);
    }
  }
};

const formatResponseForError: middy.MiddlewareFn = (request) => {
  const response: APIGatewayProxyStructuredResultV2 = {
    statusCode: (<HttpError>request.error).statusCode,
    body: JSON.stringify(request.error),
  };

  request.response = response;
};

const formatResponse: middy.MiddlewareFn = (request) => {
  request.response = createResponse(200, request.response);
};

//-- Handlers

// Simple handler

type Body = {
  name?: string;
};

/**
 * An handler example
 *
 * POST {"name": 1} - 400 error
 * POST {} - 'Hello Anonymous!'
 * POST - 400 error
 * POST {"name": "John Doe"}- 'Hello John Doe!'
 *
 * See logs in the console
 */
export const hello = middy(
  async (event: Omit<APIGatewayProxyEventV2, 'body'> & { body?: Body }): Promise<string> => {
    if (!event.body || !event.body.name) {
      return 'Hello Anonymous!';
    }

    return `Hello ${event.body.name}!`;
  }
);

// Log input and output
hello.use(inputOutputLogger());
// Parse "body" field as JSON
hello.use(jsonParser());
// Validate input
hello.use(
  validator({
    inputSchema: {
      type: 'object',
      properties: {
        body: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
            },
          },
        },
      },
    },
    // https://ajv.js.org/options.html#ajv-options
    ajvOptions: {
      // https://ajv.js.org/options.html#coercetypes
      coerceTypes: false,
    },
  })
);
// Log error
hello.use(errorLogger());
// Wrap unknown error with a HttpError instance
hello.onError(formatError);
// Turn error to response
hello.onError(formatResponseForError);
// Turn any return value of base handler to response
hello.after(formatResponse);

/**
 * Error handling example
 *
 * In this example we attache two middlewares:
 * - The first will format any error that is not a instance of HttpError
 * - The second will create response object based on HttpError
 */

/**
 * Available query parameters:
 * - ?type=400 - HttpBadRequestError
 * - ?type=500 - HttpInternalServerError
 * - ?type=_0  - InputValidationError
 * - ?type=_1  - RuntimeError
 * - ?type=_2  - TypeError
 */
export const error = middy(
  async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    if (event.queryStringParameters) {
      switch (event.queryStringParameters.type) {
        case '400':
          throw new HttpBadRequestError();
        case '500':
          throw new HttpInternalServerError();
        case '_0':
          throw new InputValidationError('Input validation error');
        case '_1':
          throw new RuntimeError('Runtime Error');
        case '_2':
          throw new TypeError('Arg must be a number');
      }
    }

    throw new HttpBadRequestError('Empty error type in query');
  }
);

//// Middlewares setup

error.onError(formatError);
error.onError(formatResponseForError);
