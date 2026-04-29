class ApiError<T = unknown> extends Error {
  public statusCode: number;
  public data: null = null;
  public success = false;
  public errors: T[];

  constructor(
    statusCode: number,
    message = "Something went wrong",
    errors: T[] = [],
    stack?: string,
  ) {
    super(message);

    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace?.(this, this.constructor);
    }
  }
}

export { ApiError };
