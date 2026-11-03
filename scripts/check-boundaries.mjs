import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
export const allowedEdges = {
  '@uttirno/contracts': [],
  '@uttirno/domain': ['@uttirno/contracts'],
  '@uttirno/env': [],
  '@uttirno/source-config': [],
  '@uttirno/llm': ['@uttirno/contracts', '@uttirno/domain'],
  '@uttirno/database': ['@uttirno/contracts', '@uttirno/domain', '@uttirno/source-config'],
  '@uttirno/infrastructure': ['@uttirno/env', '@uttirno/database'],
  '@uttirno/ui': [],
  '@uttirno/portal': ['@uttirno/ui', '@uttirno/contracts', '@uttirno/domain'],
  '@uttirno/admin': ['@uttirno/ui', '@uttirno/contracts', '@uttirno/domain'],
  '@uttirno/api': [
    '@uttirno/env',
    '@uttirno/infrastructure',
    '@uttirno/database',
    '@uttirno/contracts',
    '@uttirno/domain',
  ],
  '@uttirno/agent': [
    '@uttirno/llm',
    '@uttirno/source-config',
    '@uttirno/env',
    '@uttirno/contracts',
    '@uttirno/domain',
    '@uttirno/database',
    '@uttirno/infrastructure',
  ],
  '@uttirno/worker': [
    '@uttirno/source-config',
    '@uttirno/env',
    '@uttirno/agent',
    '@uttirno/contracts',
    '@uttirno/domain',
    '@uttirno/database',
    '@uttirno/infrastructure',
  ],
};
const persistencePackages = ['pg', 'drizzle-orm', 'postgres', 'ioredis', '@aws-sdk/client-s3'];
export function importSpecifiers(text, file = 'module.ts') {
  const result = [];
  const source = parse(text, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    sourceFilename: file,
    createImportExpressions: true,
  });
  function add(node) {
    if (node?.type !== 'StringLiteral')
      throw new Error('Computed import is not permitted in workspace source');
    result.push(node.value);
  }
  function walk(node) {
    if (
      ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) &&
      node.source
    )
      add(node.source);
    if (node.type === 'ImportExpression') add(node.source);
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      node.callee.name === 'require'
    ) {
      if (node.arguments.length !== 1) throw new Error('Invalid module load');
      add(node.arguments[0]);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value)
          if (child && typeof child === 'object' && typeof child.type === 'string') walk(child);
      } else if (value && typeof value === 'object' && typeof value.type === 'string') walk(value);
    }
  }
  walk(source);
  return result;
}
export function dependencyAllowed(owner, spec) {
  if (path.isAbsolute(spec) || (/^[a-z]+:/i.test(spec) && !spec.startsWith('node:'))) return false;
  const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
  if (spec.includes('research') || spec.includes('prototype')) return false;
  if (name.startsWith('@uttirno/'))
    return name === owner || (allowedEdges[owner] ?? []).includes(name);
  if (
    [
      '@uttirno/portal',
      '@uttirno/admin',
      '@uttirno/ui',
      '@uttirno/contracts',
      '@uttirno/domain',
    ].includes(owner) &&
    persistencePackages.includes(name)
  )
    return false;
  if (
    ['@uttirno/contracts', '@uttirno/domain'].includes(owner) &&
    ['fastify', 'next', 'react'].includes(name)
  )
    return false;
  return true;
}
async function walk(dir) {
  const files = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.next'].includes(item.name)) continue;
    const p = path.join(dir, item.name);
    if (item.isDirectory()) files.push(...(await walk(p)));
    else files.push(p);
  }
  return files;
}
export async function checkBoundaries(root = process.cwd()) {
  const errors = [];
  for (const group of ['packages', 'apps'])
    for (const dir of await readdir(path.join(root, group), { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const folder = path.resolve(root, group, dir.name);
      let manifest;
      try {
        manifest = JSON.parse(await readFile(path.join(folder, 'package.json'), 'utf8'));
      } catch (e) {
        if (e.code === 'ENOENT') continue;
        throw e;
      }
      const owner = manifest.name;
      if (!allowedEdges[owner]) errors.push(`Unregistered workspace ${owner}`);
      const deps = { ...manifest.dependencies, ...manifest.peerDependencies };
      for (const dep of Object.keys(deps))
        if (!dependencyAllowed(owner, dep)) errors.push(`${owner} forbidden dependency ${dep}`);
      for (const file of await walk(folder)) {
        if (!/\.(?:[cm]?[jt]s|[jt]sx)$/.test(file) || file.endsWith('.d.ts')) continue;
        try {
          for (const spec of importSpecifiers(await readFile(file, 'utf8'), file)) {
            if (!dependencyAllowed(owner, spec)) errors.push(`${file} forbidden import ${spec}`);
            if (spec.startsWith('.')) {
              const target = path.resolve(path.dirname(file), spec);
              const testHelper =
                file.endsWith('.test.ts') &&
                target.startsWith(path.resolve(root, 'tests/helpers') + path.sep);
              if (!testHelper && target !== folder && !target.startsWith(folder + path.sep))
                errors.push(`${file} crosses workspace via relative import ${spec}`);
            } else if (!spec.startsWith('node:')) {
              const name = spec.startsWith('@')
                ? spec.split('/').slice(0, 2).join('/')
                : spec.split('/')[0];
              if (name.startsWith('@uttirno/') && !deps[name])
                errors.push(`${file} undeclared workspace dependency ${name}`);
            }
          }
        } catch (e) {
          errors.push(`${file}: ${e.message}`);
        }
      }
    }
  return errors;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = await checkBoundaries();
  errors.forEach((e) => {
    console.error(e);
  });
  if (errors.length) process.exitCode = 1;
  else console.log('Workspace dependency boundaries passed.');
}
