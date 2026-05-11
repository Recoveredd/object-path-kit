# object-path-kit

Parse, normalize and safely access JavaScript object paths.

`object-path-kit` is a small TypeScript utility for tools that treat object paths as data: JSON viewers, table mappers, admin tools, import/export mappings, dynamic forms and configuration UIs.

## Features

- Parse dot and bracket paths such as `users[0].profile.name`
- Preserve keys that contain dots with bracket notation: `meta["user.name"]`
- Normalize paths into one stable format
- Read and test own properties safely
- Set nested values immutably
- Block prototype-pollution segments by default: `__proto__`, `prototype`, `constructor`
- Zero runtime dependencies

## Install

```bash
npm install object-path-kit
```

## Usage

```ts
import {
  getPath,
  hasPath,
  normalizePath,
  parsePath,
  setPathImmutable,
  stringifyPath
} from 'object-path-kit';

const data = {
  users: [
    { profile: { name: 'Ada' } }
  ],
  meta: {
    'user.name': 'Grace'
  }
};

parsePath('users[0].profile.name');
// ['users', 0, 'profile', 'name']

stringifyPath(['meta', 'user.name']);
// meta["user.name"]

normalizePath("users[0]['profile.name']");
// users[0]["profile.name"]

getPath(data, 'users[0].profile.name');
// Ada

getPath(data, 'meta["user.name"]');
// Grace

hasPath(data, 'users[1].profile.name');
// false

const next = setPathImmutable(data, 'users[0].profile.name', 'Grace');
// data is unchanged
```

## Path syntax

Supported:

```ts
parsePath('a.b.c');
parsePath('items[0].price');
parsePath('metadata["user.name"]');
parsePath("metadata['display-name']");
parsePath('metadata.user\\.name');
```

Invalid examples throw `PathSyntaxError`:

```ts
parsePath('a..b');
parsePath('items[abc]');
parsePath('items[0]name');
```

## Security

Unsafe path segments throw `UnsafePathError` by default:

```ts
parsePath('__proto__.polluted');
parsePath('constructor.prototype');
```

If you only need to inspect or migrate untrusted paths, you can opt in explicitly:

```ts
parsePath('__proto__.polluted', { allowUnsafe: true });
```

## API

```ts
parsePath(path, options?)
stringifyPath(segments, options?)
normalizePath(path, options?)
validatePath(path, options?)
isSafePath(path)
isUnsafeSegment(segment)
getPath(source, path, defaultValue?, options?)
hasPath(source, path, options?)
setPathImmutable(source, path, value, options?)
```

## License

MIT
