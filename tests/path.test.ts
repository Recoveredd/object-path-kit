import { describe, expect, it } from 'vitest';
import {
  getPath,
  hasPath,
  isSafePath,
  normalizePath,
  parsePath,
  PathSyntaxError,
  setPathImmutable,
  stringifyPath,
  UnsafePathError,
  validatePath
} from '../src/index.js';

describe('object-path-kit', () => {
  it('parses dot and bracket notation', () => {
    expect(parsePath('users[0].profile.name')).toEqual(['users', 0, 'profile', 'name']);
    expect(parsePath('meta["user.name"].active')).toEqual(['meta', 'user.name', 'active']);
    expect(parsePath("items[1]['total-price']")).toEqual(['items', 1, 'total-price']);
  });

  it('parses escaped dots in bare segments', () => {
    expect(parsePath('meta.user\\.name')).toEqual(['meta', 'user.name']);
  });

  it('stringifies and normalizes paths', () => {
    expect(stringifyPath(['users', 0, 'profile.name'])).toBe('users[0]["profile.name"]');
    expect(normalizePath("users[0]['profile.name']")).toBe('users[0]["profile.name"]');
  });

  it('rejects invalid path syntax with a dedicated error', () => {
    expect(() => parsePath('users..name')).toThrow(PathSyntaxError);
    expect(() => parsePath('users[abc]')).toThrow(PathSyntaxError);
    expect(() => parsePath('users[0]name')).toThrow(PathSyntaxError);
  });

  it('blocks unsafe prototype pollution segments by default', () => {
    expect(() => parsePath('__proto__.polluted')).toThrow(UnsafePathError);
    expect(() => parsePath(['safe', 'constructor'])).toThrow(UnsafePathError);
    expect(isSafePath('safe.path')).toBe(true);
    expect(isSafePath('__proto__.polluted')).toBe(false);
  });

  it('can parse unsafe paths only when explicitly allowed', () => {
    expect(parsePath('__proto__.polluted', { allowUnsafe: true })).toEqual(['__proto__', 'polluted']);
  });

  it('returns validation results without throwing', () => {
    expect(validatePath('a.b')).toEqual({
      segments: ['a', 'b'],
      valid: true
    });

    const result = validatePath('a..b');
    expect(result.valid).toBe(false);
    expect(result.segments).toEqual([]);
    expect(result.error).toBeInstanceOf(PathSyntaxError);
  });

  it('gets nested values using own properties only', () => {
    const source = {
      users: [
        { profile: { name: 'Ada' } }
      ],
      meta: {
        'user.name': 'Grace'
      }
    };

    expect(getPath(source, 'users[0].profile.name')).toBe('Ada');
    expect(getPath(source, 'meta["user.name"]')).toBe('Grace');
    expect(getPath(source, 'users[1].profile.name', 'missing')).toBe('missing');
    expect(hasPath(source, 'users[0].profile.name')).toBe(true);
    expect(hasPath(source, 'users[1].profile.name')).toBe(false);
  });

  it('returns the source value for an empty path', () => {
    expect(getPath(null, '', 'fallback')).toBeNull();
    expect(hasPath(null, '')).toBe(true);
  });

  it('does not read inherited properties', () => {
    const source = Object.create({ inherited: { value: 1 } }) as Record<string, unknown>;

    expect(getPath(source, 'inherited.value')).toBeUndefined();
    expect(hasPath(source, 'inherited.value')).toBe(false);
  });

  it('sets nested values immutably', () => {
    const source = {
      users: [
        { profile: { name: 'Ada' } }
      ]
    };

    const next = setPathImmutable(source, 'users[0].profile.name', 'Grace') as typeof source;

    expect(next.users[0]?.profile.name).toBe('Grace');
    expect(source.users[0]?.profile.name).toBe('Ada');
    expect(next).not.toBe(source);
    expect(next.users).not.toBe(source.users);
    expect(next.users[0]).not.toBe(source.users[0]);
  });

  it('creates missing containers from following segment types', () => {
    expect(setPathImmutable({}, 'users[0].name', 'Ada')).toEqual({
      users: [
        { name: 'Ada' }
      ]
    });
  });
});
