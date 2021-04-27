export type ErrorStatusCode = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503 | 504;

export class HttpError extends Error {
  constructor(public statusCode: number, public name: string, message: string, public details?: Record<string, any>) {
    super(message);
  }

  toJSON() {
    return {
      statusCode: this.statusCode,
      name: this.name,
      message: this.message,
      details: this.details,
    };
  }
}
