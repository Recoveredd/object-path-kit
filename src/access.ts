import { parsePath } from './path.js';
import type { PathInput, PathOptions, PathSegment } from './types.js';

type MutableContainer = Record<string | number, unknown>;

export function getPath<TDefault = undefined>(
  source: unknown,
  path: PathInput,
  defaultValue?: TDefault,
  options?: PathOptions
): unknown | TDefault {
  const segments = parsePath(path, options);

  if (segments.length === 0) {
    return source;
  }

  let current = source;

  for (const segment of segments) {
    if (!isIndexable(current) || !Object.hasOwn(current, segment)) {
      return defaultValue as TDefault;
    }

    current = current[segment];
  }

  return current;
}

export function hasPath(source: unknown, path: PathInput, options?: PathOptions): boolean {
  const segments = parsePath(path, options);
  let current = source;

  for (const segment of segments) {
    if (!isIndexable(current) || !Object.hasOwn(current, segment)) {
      return false;
    }

    current = current[segment];
  }

  return true;
}

export function setPathImmutable<TValue>(
  source: unknown,
  path: PathInput,
  value: TValue,
  options?: PathOptions
): unknown | TValue {
  const segments = parsePath(path, options);

  if (segments.length === 0) {
    return value;
  }

  return setAtSegment(source, segments, value, 0);
}

export function deletePathImmutable(
  source: unknown,
  path: PathInput,
  options?: PathOptions
): unknown {
  const segments = parsePath(path, options);

  if (segments.length === 0) {
    return undefined;
  }

  const result = deleteAtSegment(source, segments, 0);
  return result.changed ? result.value : source;
}

function setAtSegment<TValue>(
  current: unknown,
  segments: readonly PathSegment[],
  value: TValue,
  index: number
): unknown {
  const segment = segments[index];

  if (segment === undefined) {
    return value;
  }

  const clone = cloneContainer(current, segment);

  if (index === segments.length - 1) {
    clone[segment] = value;
    return clone;
  }

  const next = isIndexable(current) && Object.hasOwn(current, segment)
    ? current[segment]
    : createContainerFor(segments[index + 1]);

  clone[segment] = setAtSegment(next, segments, value, index + 1);
  return clone;
}

function deleteAtSegment(
  current: unknown,
  segments: readonly PathSegment[],
  index: number
): { changed: boolean; value: unknown } {
  const segment = segments[index];

  if (segment === undefined || !isIndexable(current) || !Object.hasOwn(current, segment)) {
    return { changed: false, value: current };
  }

  const clone = cloneContainer(current, segment);

  if (index === segments.length - 1) {
    if (Array.isArray(clone) && typeof segment === 'number') {
      clone.splice(segment, 1);
    } else {
      delete clone[segment];
    }

    return { changed: true, value: clone };
  }

  const next = deleteAtSegment(current[segment], segments, index + 1);

  if (!next.changed) {
    return { changed: false, value: current };
  }

  clone[segment] = next.value;
  return { changed: true, value: clone };
}

function cloneContainer(value: unknown, segment: PathSegment): MutableContainer {
  if (Array.isArray(value)) {
    return [...value] as unknown as MutableContainer;
  }

  if (isPlainObject(value)) {
    return { ...value };
  }

  return typeof segment === 'number' ? ([] as unknown as MutableContainer) : {};
}

function createContainerFor(segment: PathSegment | undefined): unknown[] | Record<string, unknown> {
  return typeof segment === 'number' ? [] : {};
}

function isIndexable(value: unknown): value is Record<PropertyKey, unknown> {
  return Boolean(value) && (typeof value === 'object' || typeof value === 'function');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
