import { mkdir, rename, readFile, writeFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const moves = ['src', 'test', 'evidence', 'examples', 'config/sources.json'];
for (const relative of moves) {
  const from = path.resolve(root, relative),
    to = path.resolve(root, 'research/prototype', relative);
  if (!from.startsWith(root + path.sep) || !to.startsWith(root + path.sep))
    throw new Error('Unsafe migration path');
  try {
    await access(from);
  } catch (e) {
    if (e.code === 'ENOENT') {
      await access(to);
      continue;
    }
    throw e;
  }
  try {
    await access(to);
    throw new Error(`Destination already exists: ${relative}`);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  await mkdir(path.dirname(to), { recursive: true });
  await rename(from, to);
}
async function walk(dir) {
  const files = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'research'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(p)));
    else if (e.name.endsWith('.md')) files.push(p);
  }
  return files;
}
for (const file of await walk(root)) {
  const body = await readFile(file, 'utf8');
  const updated = body.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (full, label, target) => {
    if (/^[a-z]+:/i.test(target)) return full;
    const old = path.resolve(path.dirname(file), target);
    const rel = path.relative(root, old).replaceAll(path.sep, '/');
    if (!moves.some((m) => rel === m || rel.startsWith(`${m}/`))) return full;
    const dest = path.resolve(root, 'research/prototype', rel);
    return `[${label}](${path.relative(path.dirname(file), dest).replaceAll(path.sep, '/')})`;
  });
  if (updated !== body) await writeFile(file, updated);
}
console.log('Research prototype moved with provenance and relative Markdown links preserved.');
