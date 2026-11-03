import { open } from 'node:fs/promises';
import { loadServerEnvironment } from '@uttirno/env';
import { SignedSourceSchema, SourcePolicyError, type TrustKeys } from '@uttirno/source-config';
import { proposeHtml, validateProposal } from './onboarding/propose.js';
import { SourceClient } from './fetch/client.js';
import { discover } from './discovery/crawl.js';
import { ArtifactArchive } from './documents/archive.js';
import { acquireJobDocument } from './documents/pipeline.js';
async function readJson(file: string | undefined): Promise<unknown> {
  return JSON.parse((await readBounded(file)).toString('utf8'));
}
async function readBounded(file: string | undefined): Promise<Buffer> {
  if (!file) throw new Error('MISSING_ARGUMENT');
  const handle = await open(file, 'r');
  try {
    if (!(await handle.stat()).isFile()) throw new Error('INPUT_NOT_REGULAR_FILE');
    const body = Buffer.alloc(1048577);
    let offset = 0;
    while (offset < body.length) {
      const result = await handle.read(body, offset, body.length - offset, offset);
      if (!result.bytesRead) break;
      offset += result.bytesRead;
    }
    if (offset > 1048576) throw new Error('CONFIG_FILE_TOO_LARGE');
    return body.subarray(0, offset);
  } finally {
    await handle.close();
  }
}
async function main() {
  const [command, file, extra, last] = process.argv.slice(2);
  if (command === 'extract-document') {
    const root = process.argv[6];
    const planFile = process.argv[7];
    if (!file || !extra || !last || !root) throw new Error('MISSING_EXTRACTION_ARGUMENTS');
    const load = async () => SignedSourceSchema.parse(await readJson(file));
    const keys = async (): Promise<TrustKeys> => {
      const input = await readJson(extra);
      if (
        !input ||
        typeof input !== 'object' ||
        Array.isArray(input) ||
        Object.values(input).some((v) => typeof v !== 'string')
      )
        throw new Error('INVALID_TRUST_KEYS');
      return input as TrustKeys;
    };
    const client = new SourceClient({
      load,
      keys,
      userAgent: 'UttirnoNoticeBot/0.3 (+https://kaizenext.com; contact@kaizenext.com)',
    });
    const archive = new ArtifactArchive({ root, load, keys });
    const result = await acquireJobDocument(
      client,
      archive,
      last,
      planFile ? await readJson(planFile) : undefined,
    );
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command === 'check-config') {
    loadServerEnvironment();
    console.log('agent configuration valid; no source requests or jobs executed.');
    return;
  }
  if (command === 'validate-source') {
    const source = SignedSourceSchema.parse(await readJson(file));
    console.log(
      JSON.stringify({
        id: source.config.id,
        version: source.config.version,
        state: source.config.state,
        signed: Boolean(source.approval),
        activationChecked: false,
      }),
    );
    return;
  }
  if (command === 'preview') {
    const source = SignedSourceSchema.parse(await readJson(file));
    if (!extra) throw new Error('MISSING_SNAPSHOT_FILE');
    const snapshot = extra.endsWith('.html')
      ? { url: source.config.seeds[0], html: (await readBounded(extra)).toString('utf8') }
      : ((await readJson(extra)) as { url: string; html: string });
    if (typeof snapshot.url !== 'string' || typeof snapshot.html !== 'string')
      throw new Error('INVALID_SNAPSHOT');
    const proposal = last
      ? validateProposal(source.config, snapshot.url, snapshot.html, await readJson(last))
      : proposeHtml(source.config, snapshot.url, snapshot.html);
    console.log(JSON.stringify(proposal, null, 2));
    return;
  }
  if (command === 'collect') {
    if (!file || !extra) throw new Error('COLLECT_REQUIRES_SIGNED_SOURCE_AND_EXTERNAL_TRUST_KEYS');
    const loadKeys = async (): Promise<TrustKeys> => {
      const keyInput = await readJson(extra);
      if (
        keyInput === null ||
        Array.isArray(keyInput) ||
        typeof keyInput !== 'object' ||
        Object.values(keyInput).some((k) => typeof k !== 'string')
      )
        throw new Error('INVALID_TRUST_KEYS');
      return keyInput as TrustKeys;
    };
    const client = new SourceClient({
      load: async () => SignedSourceSchema.parse(await readJson(file)),
      keys: loadKeys,
      userAgent: 'UttirnoNoticeBot/0.2 (+https://kaizenext.com; contact@kaizenext.com)',
    });
    const run = await discover(client);
    console.log(
      JSON.stringify(
        {
          ...run,
          pages: run.pages.map((p) => ({
            url: p.url,
            sha256: p.sha256,
            configVersion: p.configVersion,
            capturedAt: p.capturedAt,
          })),
        },
        null,
        2,
      ),
    );
    if (!run.complete) process.exitCode = 1;
    return;
  }
  throw new Error(
    'USAGE: agent check-config | validate-source FILE | preview SOURCE SNAPSHOT [ADAPTER] | collect SIGNED_SOURCE TRUST_KEYS | extract-document SOURCE TRUST_KEYS URL ARCHIVE_ROOT [PLAN]',
  );
}
main().catch((error) => {
  console.error(
    error instanceof SourcePolicyError
      ? error.code
      : error instanceof Error && /^[A-Z_ :|[\]]+$/.test(error.message)
        ? error.message
        : 'AGENT_COMMAND_FAILED',
  );
  process.exitCode = 1;
});
