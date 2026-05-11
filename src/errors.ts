export class ObjectPathKitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObjectPathKitError';
  }
}

export class PathSyntaxError extends ObjectPathKitError {
  constructor(message: string, readonly index: number) {
    super(`${message} at index ${index}.`);
    this.name = 'PathSyntaxError';
  }
}

export class UnsafePathError extends ObjectPathKitError {
  constructor(readonly segment: string) {
    super(`Unsafe path segment "${segment}" is not allowed.`);
    this.name = 'UnsafePathError';
  }
}
