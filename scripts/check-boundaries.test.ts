import { it, expect } from 'vitest';
import { dependencyAllowed, importSpecifiers } from './check-boundaries.mjs';
it('forbids UI persistence imports, prototype reuse and cross-layer domain imports', () => {
  expect(dependencyAllowed('@uttirno/portal', 'pg')).toBe(false);
  expect(dependencyAllowed('@uttirno/admin', '@uttirno/database')).toBe(false);
  expect(dependencyAllowed('@uttirno/agent', '@uttirno/ui')).toBe(false);
  expect(dependencyAllowed('@uttirno/domain', 'fastify')).toBe(false);
  expect(dependencyAllowed('@uttirno/api', '../../research/prototype/src/normalize.mjs')).toBe(
    false,
  );
  expect(dependencyAllowed('@uttirno/api', '@uttirno/env')).toBe(true);
});
it('catches static exports, dynamic imports and require', () => {
  expect(
    importSpecifiers(
      'export * from "pg"; const a = import("@uttirno/database"); require("ioredis");',
    ),
  ).toEqual(['pg', '@uttirno/database', 'ioredis']);
  expect(() => importSpecifiers('import(computed)')).toThrow();
});
