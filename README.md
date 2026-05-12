# object-path-kit

[![CI](https://github.com/Recoveredd/object-path-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/Recoveredd/object-path-kit/actions/workflows/ci.yml)

Parse, normalize and safely access JavaScript object paths.

`object-path-kit` is a small TypeScript utility for applications where object paths are data: JSON tools, table builders, import/export mappings, dynamic forms, admin dashboards and configuration UIs.

Demo: [packages.wasta-wocket.fr/object-path-kit/](https://packages.wasta-wocket.fr/object-path-kit/)

It focuses on predictable path parsing and safe access rather than trying to be a large object manipulation toolkit.

## Package quality

- TypeScript types are generated from the source.
- ESM-only package with no runtime dependencies.
- Marked as side-effect free for bundlers.
- Tested on Node.js 20 and 22 with GitHub Actions.
- Keeps prototype-pollution-sensitive path segments blocked by default.

## Why

Reading `user.profile.name` is easy when the path is hard-coded:

```ts
user.profile.name;
```

It becomes less trivial when the path comes from a column definition, a user setting, a CSV mapping, a form schema or a rule engine:

```ts
getPath(order, 'customer.address.city');
getPath(event, 'context["user.name"]');
getPath(report, 'rows[0].metrics.revenue');
```

`object-path-kit` gives you one small, dependency-free layer for those dynamic paths:

- parse path strings into typed segments
- normalize equivalent path syntaxes
- safely read and test own properties
- immutably write nested values
- reject prototype-pollution segments by default

## Install

```bash
npm install object-path-kit
```

## Quick Start

```ts
import {
  getPath,
  hasPath,
  normalizePath,
  parsePath,
  deletePathImmutable,
  setPathImmutable,
  stringifyPath
} from 'object-path-kit';

const data = {
  users: [
    { profile: { name: 'Ada', active: true } }
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

getPath(data, 'missing.value', 'fallback');
// fallback

hasPath(data, 'users[0].profile.active');
// true

const next = setPathImmutable(data, 'users[0].profile.name', 'Grace');

data.users[0].profile.name;
// Ada

getPath(next, 'users[0].profile.name');
// Grace

const withoutActive = deletePathImmutable(next, 'users[0].profile.active');
```

## Common Use Cases

### Table and JSON tools

Use paths as column definitions without writing per-column accessors.

```ts
const columns = [
  { header: 'Customer', path: 'customer.name' },
  { header: 'City', path: 'customer.address.city' },
  { header: 'Total', path: 'totals[0].amount' }
];

const row = columns.map((column) => getPath(order, column.path, ''));
```

Pair with `object-key-paths` when paths should be discovered from an unknown payload before values are read:

```ts
import { getLeafPaths } from 'object-key-paths';
import { getPath } from 'object-path-kit';

const paths = getLeafPaths(report, {
  pathStyle: 'bracket'
});

const fields = paths.map((path) => ({
  path,
  value: getPath(report, path)
}));
```

Use the same idea with `array-table-kit` when paths come from user settings or config. For bracket notation or keys containing dots, use an accessor:

```ts
import { getPath } from 'object-path-kit';
import { arrayToMarkdownTable } from 'array-table-kit';

const cityPath = 'customer["billing.address"].city';

arrayToMarkdownTable(orders, {
  columns: [
    { key: 'customer', path: 'customer.name' },
    {
      key: 'city',
      header: 'City',
      accessor: (row) => getPath(row, cityPath, '') as string
    }
  ]
});
```

### Import/export mappings

Map incoming fields to nested output objects.

```ts
const mapping = {
  'Customer name': 'customer.name',
  'Billing ZIP': 'billing.address.zipCode'
};

const output = Object.entries(mapping).reduce(
  (record, [csvHeader, path]) => setPathImmutable(record, path, csvRow[csvHeader]),
  {}
);
```

Use `json-csv-kit` when those mappings also need a CSV export. `accessor` keeps bracket paths and ambiguous keys under your control:

```ts
import { getPath } from 'object-path-kit';
import { jsonToCsv } from 'json-csv-kit';

const columns = [
  { key: 'customer', header: 'Customer', path: 'customer.name' },
  { key: 'city', header: 'City', path: 'customer["billing.address"].city' }
];

const csv = jsonToCsv(orders, {
  columns: columns.map((column) => ({
    key: column.key,
    header: column.header,
    accessor: (row) => getPath(row, column.path, '')
  }))
});
```

### Dynamic forms

Bind fields to nested state without mutating the original object.

```ts
const field = {
  label: 'Email',
  path: 'user.profile.email'
};

const value = getPath(formState, field.path, '');
const nextState = setPathImmutable(formState, field.path, 'ada@example.com');
const clearedState = deletePathImmutable(nextState, field.path);
```

### Config and rule engines

Validate paths once, then reuse their parsed segments.

```ts
const result = validatePath(rule.path);

if (!result.valid) {
  console.error(result.error.message);
}
```

## Supported Path Syntax

Dot notation:

```ts
parsePath('user.profile.name');
// ['user', 'profile', 'name']
```

Array indexes:

```ts
parsePath('items[0].price');
// ['items', 0, 'price']
```

Quoted keys:

```ts
parsePath('metadata["user.name"]');
// ['metadata', 'user.name']

parsePath("metadata['display-name']");
// ['metadata', 'display-name']
```

Escaped bare segments:

```ts
parsePath('metadata.user\\.name');
// ['metadata', 'user.name']
```

Empty path:

```ts
parsePath('');
// []

getPath(source, '');
// source
```

Invalid paths throw `PathSyntaxError`:

```ts
parsePath('user..name');
parsePath('items[abc]');
parsePath('items[0]name');
```

## Security

`object-path-kit` blocks unsafe path segments by default:

```ts
parsePath('__proto__.polluted');
parsePath('constructor.prototype');
parsePath(['safe', 'prototype']);
```

Those calls throw `UnsafePathError`.

This protects helpers like `setPathImmutable` from accepting paths that could be used for prototype pollution in less defensive object-path utilities.

If you need to inspect or migrate unsafe strings without using them to access data, you can opt in explicitly:

```ts
parsePath('__proto__.polluted', { allowUnsafe: true });
```

## API

### `parsePath(path, options?)`

```ts
parsePath(path: string | readonly PathSegment[], options?: PathOptions): PathSegment[]
```

Parses a path string into segments. Numbers are used for bracket indexes.

```ts
parsePath('users[0].name');
// ['users', 0, 'name']
```

### `stringifyPath(segments, options?)`

```ts
stringifyPath(segments: readonly PathSegment[], options?: PathOptions): string
```

Serializes path segments into a stable path string.

```ts
stringifyPath(['meta', 'user.name']);
// meta["user.name"]
```

### `normalizePath(path, options?)`

```ts
normalizePath(path: PathInput, options?: PathOptions): string
```

Parses and serializes a path to one canonical representation.

```ts
normalizePath("items[0]['total-price']");
// items[0]["total-price"]
```

### `validatePath(path, options?)`

```ts
validatePath(path: PathInput, options?: PathOptions): ValidatePathResult
```

Returns a validation object instead of throwing.

```ts
validatePath('user..name');
// { valid: false, segments: [], error: PathSyntaxError }
```

### `isSafePath(path)`

```ts
isSafePath(path: PathInput): boolean
```

Returns `false` for invalid or unsafe paths.

### `isUnsafeSegment(segment)`

```ts
isUnsafeSegment(segment: PathSegment): boolean
```

Checks whether a segment is one of `__proto__`, `prototype` or `constructor`.

### `getPath(source, path, defaultValue?, options?)`

```ts
getPath(source: unknown, path: PathInput, defaultValue?: unknown, options?: PathOptions): unknown
```

Reads a value from own properties only. Missing paths return `defaultValue`.

```ts
getPath(data, 'user.name', 'Anonymous');
```

### `hasPath(source, path, options?)`

```ts
hasPath(source: unknown, path: PathInput, options?: PathOptions): boolean
```

Returns whether every segment exists as an own property.

### `setPathImmutable(source, path, value, options?)`

```ts
setPathImmutable(source: unknown, path: PathInput, value: unknown, options?: PathOptions): unknown
```

Returns a new object or array with the nested value set. Existing containers on the path are shallow-cloned.

```ts
const next = setPathImmutable(data, 'user.name', 'Ada');
```

## Types

```ts
type PathSegment = string | number;
type PathInput = string | readonly PathSegment[];

interface PathOptions {
  allowUnsafe?: boolean;
}

interface ValidatePathResult {
  error?: Error;
  segments: PathSegment[];
  valid: boolean;
}
```

## Notes

- Only non-negative integer array indexes are supported in bracket notation.
- `getPath` and `hasPath` use own properties only.
- `setPathImmutable` is intentionally shallow along the updated path; it does not deep-clone unrelated branches.
- The package ships as ESM with TypeScript declarations.

## License

MPL-2.0
