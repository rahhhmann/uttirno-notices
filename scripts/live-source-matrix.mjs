// Explicit opt-in real GET acquisition. Sequential; never run in ordinary CI/unit tests.
import { execFile } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { SourceConfigSchema } from '@uttirno/source-config';
function command(args) {
  return new Promise((resolve) =>
    execFile(
      process.execPath,
      ['--use-system-ca', ...args],
      { cwd: process.cwd(), windowsHide: true, timeout: 900000, maxBuffer: 1048576 },
      (error, stdout) => resolve({ ok: !error, stdout }),
    ),
  );
}
const escaped = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
try {
  if (process.env.NODE_ENV === 'production' || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0')
    throw new Error('PRIVATE_LOCAL_TLS_VERIFIED_RUN_REQUIRED');
  const registry = JSON.parse(await readFile('config/live-sources.v1.json', 'utf8'));
  if (
    registry.schemaVersion !== 1 ||
    !Array.isArray(registry.sources) ||
    registry.sources.length < 1 ||
    registry.sources.length > 10
  )
    throw new Error('INVALID_REGISTRY');
  const requested = process.argv.slice(2);
  if (requested.some((id) => !registry.sources.some((s) => s.id === id)))
    throw new Error('UNKNOWN_SOURCE_ID');
  const selected = registry.sources.filter((s) => !requested.length || requested.includes(s.id));
  const root = path.resolve('.local', 'live-sources');
  const reportDirectory = path.join(root, `matrix-${randomUUID()}`);
  await mkdir(reportDirectory, { recursive: true, mode: 0o700 });
  const summary = {
    schemaVersion: 1,
    startedAt: new Date().toISOString(),
    mode: 'real_get_private_review',
    publicationApproved: false,
    factualMappingApproved: false,
    sources: [],
  };
  async function save() {
    await writeFile(path.join(reportDirectory, 'summary.json'), JSON.stringify(summary, null, 2), {
      mode: 0o600,
    });
    const rows = summary.sources
      .map(
        (s) =>
          `<tr><td>${escaped(s.id)}</td><td>${escaped(s.state)}</td><td>${s.documents}</td><td>${s.pages}</td><td>${escaped(s.scope)}</td><td>${s.reportPath ? `<a href="${escaped(pathToFileURL(s.reportPath).href)}">Private original/text report</a>` : escaped(s.error)}</td></tr>`,
      )
      .join('');
    await writeFile(
      path.join(reportDirectory, 'report.html'),
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'"><title>Actual source test matrix</title><h1>Actual source test matrix</h1><p>Real GET discovery/archive/text extraction only. Nothing published. Field/position mapping and independent review remain incomplete. These are configured sample scopes, not full website coverage.</p><table border="1"><thead><tr><th>Source</th><th>Status</th><th>Documents</th><th>Pages</th><th>Scope</th><th>Review</th></tr></thead><tbody>${rows}</tbody></table></html>`,
      { mode: 0o600 },
    );
  }
  for (const source of selected) {
    const row = {
      id: source.id,
      scope: source.scope,
      state: 'incomplete',
      documents: 0,
      pages: 0,
      reportPath: null,
      error: null,
    };
    try {
      const file = path.resolve(source.config);
      if (!file.startsWith(path.resolve('config/sources') + path.sep) || !file.endsWith('.json'))
        throw new Error('CONFIG_SCOPE');
      const config = SourceConfigSchema.parse(JSON.parse(await readFile(file, 'utf8')).config);
      if (config.id !== source.id) throw new Error('SOURCE_ID_MISMATCH');
      const signing = await command(['scripts/sign-local-source.mjs', source.config]);
      if (!signing.ok) throw new Error('POLICY_OR_LOCAL_SIGNING_REJECTED');
      const approval = JSON.parse(signing.stdout);
      const run = await command([
        'apps/agent/dist/main.js',
        'pipeline',
        approval.source,
        approval.trust,
        path.join(root, config.id),
      ]);
      let result;
      try {
        result = JSON.parse(run.stdout);
      } catch {
        throw new Error('SOURCE_RUN_FAILED');
      }
      row.state = run.ok && result.state === 'needs_review' ? 'needs_review' : 'incomplete';
      row.documents = result.documents;
      row.reportPath = result.reportPath;
      const manifest = JSON.parse(
        await readFile(path.join(path.dirname(result.reportPath), 'manifest.json'), 'utf8'),
      );
      row.pages = manifest.documents.reduce((sum, d) => sum + (d.result?.pages ?? 0), 0);
      row.error =
        manifest.discovery.errors.join(', ') ||
        manifest.documents
          .filter((d) => d.error)
          .map((d) => d.error)
          .join(', ') ||
        null;
    } catch (error) {
      row.error =
        error instanceof Error && /^[A-Z_]+$/.test(error.message)
          ? error.message
          : 'SOURCE_RUN_FAILED';
    }
    summary.sources.push(row);
    await save();
    console.log(
      `${row.id}: ${row.state}; documents=${row.documents}; pages=${row.pages}${row.error ? `; ${row.error}` : ''}`,
    );
  }
  console.log(`Review matrix: ${path.join(reportDirectory, 'report.html')}`);
  if (summary.sources.some((s) => s.state !== 'needs_review')) process.exitCode = 1;
} catch {
  console.error(
    'LIVE_SOURCE_MATRIX_REJECTED: check reviewed configs, IDs, build and verified local runtime.',
  );
  process.exitCode = 1;
}
