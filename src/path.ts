import { PathSyntaxError, UnsafePathError } from './errors.js';
import type { PathInput, PathOptions, PathSegment, ValidatePathResult } from './types.js';

const UNSAFE_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const BARE_SEGMENT_PATTERN = /^[A-Za-z_$][\w$]*$/u;

export function parsePath(path: PathInput, options: PathOptions = {}): PathSegment[] {
  const segments = typeof path === 'string' ? parsePathString(path) : normalizeSegments(path);
  assertSafeSegments(segments, options);
  return segments;
}

export function stringifyPath(path: readonly PathSegment[], options: PathOptions = {}): string {
  const segments = normalizeSegments(path);
  assertSafeSegments(segments, options);

  return segments.map((segment, index) => stringifySegment(segment, index)).join('');
}

export function normalizePath(path: PathInput, options: PathOptions = {}): string {
  return stringifyPath(parsePath(path, options), options);
}

export function isSafePath(path: PathInput): boolean {
  try {
    parsePath(path);
    return true;
  } catch {
    return false;
  }
}

export function validatePath(path: PathInput, options: PathOptions = {}): ValidatePathResult {
  try {
    return {
      segments: parsePath(path, options),
      valid: true
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error('Unknown path error.'),
      segments: [],
      valid: false
    };
  }
}

export function isUnsafeSegment(segment: PathSegment): boolean {
  return typeof segment === 'string' && UNSAFE_SEGMENTS.has(segment);
}

function parsePathString(path: string): PathSegment[] {
  if (path === '') {
    return [];
  }

  const segments: PathSegment[] = [];
  let index = 0;
  let expectsSegment = true;

  while (index < path.length) {
    const char = path[index];

    if (char === '.') {
      if (expectsSegment) {
        throw new PathSyntaxError('Expected a segment before "."', index);
      }

      expectsSegment = true;
      index += 1;
      continue;
    }

    if (char === '[') {
      if (expectsSegment && segments.length > 0) {
        throw new PathSyntaxError('Unexpected bracket after "."', index);
      }

      const result = readBracketSegment(path, index);
      segments.push(result.segment);
      index = result.nextIndex;
      expectsSegment = false;
      continue;
    }

    if (!expectsSegment) {
      throw new PathSyntaxError('Expected "." or "[" before the next segment', index);
    }

    const result = readBareSegment(path, index);
    segments.push(result.segment);
    index = result.nextIndex;
    expectsSegment = false;
  }

  if (expectsSegment) {
    throw new PathSyntaxError('Expected a segment after "."', path.length - 1);
  }

  return segments;
}

function readBareSegment(path: string, start: number): { nextIndex: number; segment: string } {
  let index = start;
  let segment = '';

  while (index < path.length) {
    const char = path[index];

    if (char === '.' || char === '[') {
      break;
    }

    if (char === ']') {
      throw new PathSyntaxError('Unexpected closing bracket', index);
    }

    if (char === '\\') {
      const next = path[index + 1];

      if (next === undefined) {
        throw new PathSyntaxError('Expected an escaped character', index);
      }

      segment += next;
      index += 2;
      continue;
    }

    segment += char;
    index += 1;
  }

  if (segment === '') {
    throw new PathSyntaxError('Expected a path segment', start);
  }

  return { nextIndex: index, segment };
}

function readBracketSegment(path: string, start: number): { nextIndex: number; segment: PathSegment } {
  const first = path[start + 1];

  if (first === undefined) {
    throw new PathSyntaxError('Expected a closing bracket', start);
  }

  if (first === '"' || first === "'") {
    return readQuotedBracketSegment(path, start, first);
  }

  return readNumericBracketSegment(path, start);
}

function readQuotedBracketSegment(
  path: string,
  start: number,
  quote: '"' | "'"
): { nextIndex: number; segment: string } {
  let index = start + 2;
  let segment = '';

  while (index < path.length) {
    const char = path[index];

    if (char === quote) {
      if (path[index + 1] !== ']') {
        throw new PathSyntaxError('Expected "]" after quoted segment', index + 1);
      }

      return { nextIndex: index + 2, segment };
    }

    if (char === '\\') {
      const next = path[index + 1];

      if (next === undefined) {
        throw new PathSyntaxError('Expected an escaped character', index);
      }

      segment += readEscapedCharacter(next);
      index += 2;
      continue;
    }

    segment += char;
    index += 1;
  }

  throw new PathSyntaxError('Expected a closing quote', start);
}

function readNumericBracketSegment(path: string, start: number): { nextIndex: number; segment: number } {
  let index = start + 1;
  let raw = '';

  while (index < path.length && path[index] !== ']') {
    raw += path[index];
    index += 1;
  }

  if (path[index] !== ']') {
    throw new PathSyntaxError('Expected a closing bracket', start);
  }

  if (!/^(0|[1-9]\d*)$/u.test(raw)) {
    throw new PathSyntaxError('Expected a non-negative integer or quoted string inside brackets', start + 1);
  }

  return { nextIndex: index + 1, segment: Number(raw) };
}

function readEscapedCharacter(char: string): string {
  if (char === 'n') {
    return '\n';
  }

  if (char === 'r') {
    return '\r';
  }

  if (char === 't') {
    return '\t';
  }

  return char;
}

function normalizeSegments(path: readonly PathSegment[]): PathSegment[] {
  return path.map((segment) => {
    if (typeof segment === 'number') {
      if (!Number.isSafeInteger(segment) || segment < 0) {
        throw new PathSyntaxError('Expected path indexes to be non-negative safe integers', 0);
      }

      return segment;
    }

    if (typeof segment !== 'string') {
      throw new PathSyntaxError('Expected path segments to be strings or numbers', 0);
    }

    return segment;
  });
}

function assertSafeSegments(segments: readonly PathSegment[], options: PathOptions): void {
  if (options.allowUnsafe) {
    return;
  }

  const unsafe = segments.find((segment) => isUnsafeSegment(segment));

  if (unsafe !== undefined) {
    throw new UnsafePathError(String(unsafe));
  }
}

function stringifySegment(segment: PathSegment, index: number): string {
  if (typeof segment === 'number') {
    return `[${segment}]`;
  }

  if (BARE_SEGMENT_PATTERN.test(segment)) {
    return index === 0 ? segment : `.${segment}`;
  }

  return `[${JSON.stringify(segment)}]`;
}
