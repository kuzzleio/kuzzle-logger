export type SerializedError = {
  [key: string]: unknown;
  cause?: unknown;
  errors?: unknown[];
  message: string;
  name: string;
  stack?: string;
};

/**
 * Returns true for Error instances, and for objects that look like errors
 * (e.g. errors coming from another realm).
 */
export function isErrorLike(value: unknown): value is Error {
  if (value instanceof Error) {
    return true;
  }

  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Error).message === 'string' &&
    typeof (value as Error).stack === 'string'
  );
}

/**
 * Serializes an error into a plain JSON object: name, message, stack, cause,
 * aggregated errors and custom enumerable properties (e.g. KuzzleError id, code, status).
 *
 * Non-error values are returned unchanged, so it can be used as a pino serializer.
 */
export function serializeError(value: unknown): unknown {
  return serializeValue(value, new Set());
}

function serializeValue(value: unknown, ancestors: Set<object>): unknown {
  if (!isErrorLike(value)) {
    return value;
  }

  if (ancestors.has(value)) {
    return '[Circular]';
  }

  ancestors.add(value);

  const serialized: SerializedError = {
    message: value.message,
    name: typeof value.name === 'string' ? value.name : 'Error',
  };

  if (typeof value.stack === 'string') {
    serialized.stack = value.stack;
  }

  // "cause" and AggregateError "errors" are not enumerable
  if (value.cause !== undefined) {
    serialized.cause = serializeValue(value.cause, ancestors);
  }

  const errors = (value as { errors?: unknown }).errors;
  if (Array.isArray(errors)) {
    serialized.errors = errors.map((err) => serializeValue(err, ancestors));
  }

  for (const key in value) {
    if (!(key in serialized)) {
      serialized[key] = serializeValue(value[key as keyof Error], ancestors);
    }
  }

  ancestors.delete(value);

  return serialized;
}

/**
 * pino serializers applied to the "err" and "error" keys of logged objects.
 */
export const errorSerializers = {
  err: serializeError,
  error: serializeError,
};
