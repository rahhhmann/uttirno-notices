// Explicit local operator action. Never called by onboarding, application startup or a model extractor.
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SourceConfigSchema, canonical, authorizeSource } from '@uttirno/source-config';
try {
  if (process.env.NODE_ENV === 'production' || !process.argv[2])
    throw new Error('LOCAL_INPUT_REQUIRED');
  const raw = await readFile(process.argv[2]);
  if (raw.length > 1048576) throw new Error('SOURCE_CONFIG_LIMIT');
  const parsed = JSON.parse(raw.toString('utf8'));
  const config = SourceConfigSchema.parse(parsed.config ?? parsed);
  const pair = generateKeyPairSync('ed25519');
  const keyId = `local-operator-${randomUUID()}`;
  const trust = { [keyId]: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() };
  const bundle = {
    config,
    approval: {
      keyId,
      signature: sign(null, Buffer.from(canonical(config)), pair.privateKey).toString('base64'),
    },
  };
  authorizeSource(bundle, trust);
  const directory = path.resolve('.local', 'source-approvals', `${config.id}-${randomUUID()}`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  for (const [name, body] of [
    ['private.pem', pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()],
    ['trust.json', JSON.stringify(trust, null, 2)],
    ['source.json', JSON.stringify(bundle, null, 2)],
  ])
    await writeFile(path.join(directory, name), body, { flag: 'wx', mode: 0o600 });
  console.log(
    JSON.stringify({
      source: path.join(directory, 'source.json'),
      trust: path.join(directory, 'trust.json'),
      basis: 'local operator decision; not authority consent',
      productionApproval: false,
    }),
  );
} catch {
  console.error(
    'LOCAL_SOURCE_SIGNING_REJECTED: require current active reviewed config; no credentials printed.',
  );
  process.exitCode = 1;
}
