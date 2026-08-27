export type AppErrorCode =
  | 'PROVIDER_NOT_FOUND'
  | 'PROVIDER_ERROR'
  | 'ACTION_NOT_FOUND'
  | 'CONVERSATION_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'STORAGE_ERROR'
  | 'TEMPLATE_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

export async function wrapAsync<T>(
  fn: () => Promise<T>,
  code: AppErrorCode,
  message: string,
): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (cause) {
    return err(new AppError(code, message, cause));
  }
}
