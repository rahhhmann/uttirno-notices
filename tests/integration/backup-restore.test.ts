// SYNTHETIC isolated source schema -> real pg_dump -> AES-GCM -> new isolated DB -> pg_restore.
import { it, expect } from 'vitest';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createDatabase,
  encryptBackup,
  decryptBackup,
  PublicReadRepository,
} from '@uttirno/database';
import { m4Context } from '../helpers/m4.js';
import { readOriginal } from '../../apps/api/src/original.js';
async function command(args: string[], env: NodeJS.ProcessEnv, input?: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn('docker', args, { env, windowsHide: true, stdio: 'pipe' }),
      chunks: Buffer[] = [];
    let size = 0;
    const timer = setTimeout(() => child.kill(), 30000);
    child.stdout.on('data', (bytes: Buffer) => {
      size += bytes.length;
      if (size > 67108864) child.kill();
      else chunks.push(bytes);
    });
    child.stderr.resume();
    child.stdin.on('error', () => {});
    child.stdin.end(input);
    child.on('error', () => {
      clearTimeout(timer);
      reject(new Error('DATABASE_TOOL_UNAVAILABLE'));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error('DATABASE_TOOL_FAILED'));
    });
  });
}
it('R23/R24 actual encrypted DB/archive backup restores publication/evidence/audit into a separate DB; tampering fails', async () => {
  const c = await m4Context(),
    target = `m8_restore_${randomBytes(10).toString('hex')}`,
    folder = await mkdtemp(path.join(tmpdir(), 'uttirno-m8-restore-'));
  let restored: ReturnType<typeof createDatabase> | undefined;
  let created = false;
  const started = performance.now();
  try {
    const item = await c.makeDocument(),
      run = await c.beginRun();
    const draft = await c.revisions.stage('operator', {
      sourceId: c.source.config.id,
      runId: run.runId,
      bundle: item.bundle,
      inventory: item.inventory,
    });
    if (draft.state !== 'draft') throw new Error('EXPECTED_DRAFT');
    await c.publication.approve(
      'reviewer',
      draft.revisionId,
      1,
      await c.attestation(item),
      'SYNTHETIC backup restore review',
    );
    const url = new URL(c.env.DATABASE_URL),
      environment = {
        ...process.env,
        PGUSER: decodeURIComponent(url.username),
        PGPASSWORD: decodeURIComponent(url.password),
      };
    const container = (
      await command(
        ['compose', '--env-file', '.env', '-f', 'infra/local/compose.yaml', 'ps', '-q', 'postgres'],
        environment,
      )
    )
      .toString()
      .trim();
    if (!/^[a-f0-9]{12,64}$/.test(container)) throw new Error('DEDICATED_DATABASE_REQUIRED');
    const key = randomBytes(32),
      dump = await command(
        [
          'exec',
          '-i',
          '--env',
          'PGUSER',
          '--env',
          'PGPASSWORD',
          container,
          'pg_dump',
          '--host',
          '127.0.0.1',
          '--format',
          'custom',
          '--schema',
          c.schema,
          '--dbname',
          'uttirno_dev',
        ],
        environment,
      );
    const encrypted = encryptBackup(dump, key);
    await writeFile(path.join(folder, 'database.enc'), encrypted, { mode: 0o600 });
    const corrupted = Buffer.from(encrypted);
    corrupted[corrupted.length - 1] = (corrupted.at(-1) ?? 0) ^ 1;
    expect(() => decryptBackup(corrupted, key)).toThrow();
    await c.database.pool.query(`CREATE DATABASE "${target}"`);
    created = true;
    await command(
      [
        'exec',
        '-i',
        '--env',
        'PGUSER',
        '--env',
        'PGPASSWORD',
        container,
        'pg_restore',
        '--host',
        '127.0.0.1',
        '--exit-on-error',
        '--no-owner',
        '--no-privileges',
        '--dbname',
        target,
      ],
      environment,
      decryptBackup(encrypted, key),
    );
    url.pathname = `/${target}`;
    restored = createDatabase(url.href, c.schema);
    const taxonomy = { version: 'SYNTHETIC', aliases: [], categories: [] };
    const source = new PublicReadRepository(c.options, taxonomy),
      copy = new PublicReadRepository({ ...c.options, pool: restored.pool }, taxonomy);
    const expected = await source.jobs({ limit: 20 });
    const actual = await copy.jobs({ limit: 20 });
    expect(actual.items).toEqual(expected.items);
    expect(actual.items).toHaveLength(2);
    expect(await copy.job(actual.items[0]?.id ?? '')).toEqual(
      await source.job(expected.items[0]?.id ?? ''),
    );
    expect((await restored.pool.query('SELECT count(*) FROM audit_events')).rows).toEqual(
      (await c.database.pool.query('SELECT count(*) FROM audit_events')).rows,
    );
    const bytes = await readFile(path.join(c.root, 'bytes', item.doc.artifactSha256)),
      sealed = encryptBackup(bytes, key);
    await mkdir(path.join(folder, 'bytes'));
    await writeFile(
      path.join(folder, 'bytes', item.doc.artifactSha256),
      decryptBackup(sealed, key),
      { mode: 0o600 },
    );
    expect(await readOriginal(folder, item.doc.artifactSha256, bytes.length)).toEqual(bytes);
    await mkdir('.local', { recursive: true });
    await writeFile(
      '.local/m8-restore.json',
      JSON.stringify(
        {
          kind: 'SYNTHETIC_RESTORE_REHEARSAL',
          records: actual.items.length,
          encryptedBytes: encrypted.length,
          elapsedMs: Math.round(performance.now() - started),
          productionRpoRtoEstablished: false,
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        kind: 'SYNTHETIC_RESTORE_REHEARSAL',
        records: actual.items.length,
        encryptedBytes: encrypted.length,
        elapsedMs: Math.round(performance.now() - started),
        productionRpoRtoEstablished: false,
      }),
    );
  } finally {
    await restored?.close();
    if (created) {
      assert.match(target, /^m8_restore_[a-f0-9]{20}$/, 'UNSAFE_RESTORE_DATABASE');
      await c.database.pool.query(`DROP DATABASE "${target}" WITH (FORCE)`);
    }
    await c.close();
    const resolved = path.resolve(folder);
    assert.ok(
      resolved.startsWith(path.resolve(tmpdir()) + path.sep) &&
        path.basename(resolved).startsWith('uttirno-m8-restore-'),
      'UNSAFE_RESTORE_FOLDER',
    );
    await rm(resolved, { recursive: true, force: true });
  }
}, 60000);
