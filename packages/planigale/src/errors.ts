export class ApiError extends Error {
  status: number;
  errorCode: string;
  log: boolean = true;

  constructor(status: number, errorCode: string, message?: string) {
    super(message ?? errorCode);
    this.status = status;
    this.errorCode = errorCode;
  }

  serialize(): Record<string, unknown> {
    return {
      errorCode: this.errorCode,
      message: this.message,
    };
  }

  [Symbol.for('Deno.customInspect')](): string {
    return `ApiError: [${this.errorCode}] ${this.status} ${this.message}\n` +
      `${this.stack?.split('\n').slice(1).join('\n')}`;
  }
}

export class ValidationFailed extends ApiError {
  errors: unknown;
  log: boolean = false;
  constructor(errors: unknown) {
    super(400, 'VALIDATION_ERROR', 'Validation failed');
    this.errors = errors;
  }

  serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      errors: this.errors,
    };
  }
}

export class InternalServerError extends ApiError {
  originalError: Error;
  constructor(e: Error) {
    super(500, 'INTERNAL_SERVER_ERROR', e.message);
    this.originalError = e;
  }

  serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      stack: this.originalError.stack?.split('\n'),
    };
  }
}

export class ResourceNotFound extends ApiError {
  log: boolean = false;
  constructor(message: string) {
    super(404, 'RESOURCE_NOT_FOUND', message);
  }
}
