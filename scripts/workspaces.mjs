import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root = process.cwd();
const workspaces = [];
for (const group of ['packages', 'apps']) {
  for (const dir of await readdir(group, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const folder = path.join(group, dir.name);
    try {
      const manifest = JSON.parse(await readFile(path.join(folder, 'package.json'), 'utf8'));
      workspaces.push({ folder, manifest });
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
}
const sorted = [];
const visiting = new Set();
const visited = new Set();
function visit(item) {
  const name = item.manifest.name;
  if (visited.has(name)) return;
  if (visiting.has(name)) throw new Error(`Workspace cycle: ${name}`);
  visiting.add(name);
  for (const dep of Object.keys(item.manifest.dependencies ?? {})) {
    const local = workspaces.find((x) => x.manifest.name === dep);
    if (local) visit(local);
  }
  visiting.delete(name);
  visited.add(name);
  sorted.push(item);
}
workspaces.forEach(visit);
const mode = process.argv[2];
if (!['build', 'build-packages', 'typecheck'].includes(mode))
  throw new Error('Unknown workspace command');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this script through its root npm script');
function run(item, task) {
  if (!item.manifest.scripts?.[task]) throw new Error(`Missing task ${item.manifest.name}:${task}`);
  console.log(`\n${item.manifest.name} ${task}`);
  const result = spawnSync(
    process.execPath,
    [npmCli, 'run', task, '--workspace', item.manifest.name],
    { cwd: root, stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const isLibrary = (item) => item.folder.startsWith('packages') || Boolean(item.manifest.exports);
if (mode === 'typecheck') {
  for (const item of sorted.filter(isLibrary)) run(item, 'build');
  for (const item of sorted) run(item, 'typecheck');
} else
  for (const item of sorted.filter(
    (x) => mode !== 'build-packages' || isLibrary(x),
  ))
    run(item, 'build');
