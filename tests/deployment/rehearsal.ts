// Opt-in SYNTHETIC container rehearsal. Uses only guarded local services; never a live source/provider.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { m4Context } from '../helpers/m4.js';
import { runtimeRoles } from '../helpers/operations.js';
async function docker(args: string[], env: NodeJS.ProcessEnv, input?: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn('docker', args, { env, windowsHide: true, stdio: 'pipe' });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
      if (output.length > 1048576) child.kill();
    });
    child.stderr.resume();
    child.stdin.on('error', () => {});
    child.stdin.end(input);
    const timer = setTimeout(() => child.kill(), 180000);
    child.on('error', () => {
      clearTimeout(timer);
      reject(new Error('DEPLOYMENT_TOOL_UNAVAILABLE'));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      code === 0 ? resolve(output) : reject(new Error(`DEPLOYMENT_COMMAND_FAILED_${args[0]}`));
    });
  });
}
const c = await m4Context({}, false),
  roles = await runtimeRoles(c).catch(async (error) => {
    await c.close();
    throw error;
  });
await mkdir('.local', { recursive: true });
const folder = await mkdtemp(path.resolve('.local/m8-rehearsal-'));
const apiConfig = path.join(folder, 'api-config'),
  workerConfig = path.join(folder, 'worker-config');
await mkdir(apiConfig);
await mkdir(workerConfig);
assert.equal(new URL(c.env.S3_ENDPOINT).hostname, '127.0.0.1');
assert.equal(new URL(c.env.S3_ENDPOINT).port, '54566');
const token = randomBytes(32).toString('hex');
const dockerHost = (value: string) => {
  const url = new URL(value);
  if (url.port === '55432') {
    url.hostname = 'postgres';
    url.port = '5432';
  } else if (url.port === '56379') {
    url.hostname = 'redis';
    url.port = '6379';
  } else if (url.port === '54566') {
    url.hostname = 'storage';
    url.port = '4566';
  } else throw new Error('UNKNOWN_SYNTHETIC_SERVICE');
  return url.href;
};
async function envFile(name: string, values: Record<string, unknown>) {
  const file = path.join(folder, name);
  await writeFile(
    file,
    Object.entries(values)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([key, value]) => {
        if (/[\r\n]/.test(value)) throw new Error('ENV_VALUE_REJECTED');
        return `${key}=${value}`;
      })
      .join('\n') + '\n',
    { mode: 0o600 },
  );
  return file;
}
const apiFile = await envFile('api.env', {
  ...c.env,
  LLM_PROVIDER: '',
  LLM_API_KEY: '',
  LLM_MODEL: '',
  NODE_ENV: 'development',
  DATABASE_URL: dockerHost(roles.apiUrl),
  DATABASE_SCHEMA: c.schema,
  REDIS_URL: dockerHost(c.env.REDIS_URL),
  S3_ENDPOINT: dockerHost(c.env.S3_ENDPOINT),
  API_PUBLIC_ORIGIN: 'http://127.0.0.1:18400',
  ADMIN_ORIGIN: 'http://127.0.0.1:18301',
  API_CURSOR_SECRET: randomBytes(32).toString('hex'),
  API_SESSION_SECRET: randomBytes(32).toString('hex'),
  OPERATIONS_TOKEN: token,
});
const webFile = await envFile('web.env', { NODE_ENV: 'production' }),
  migrationFile = await envFile('migration.env', {
    DATABASE_URL: dockerHost(c.env.DATABASE_URL),
    DATABASE_SCHEMA: c.schema,
  });
const workerUrl = new URL(roles.apiUrl);
workerUrl.username = roles.workerRole;
const workerFile = await envFile('worker.env', {
  ...c.env,
  LLM_PROVIDER: '',
  LLM_API_KEY: '',
  LLM_MODEL: '',
  DATABASE_URL: dockerHost(workerUrl.href),
  DATABASE_SCHEMA: c.schema,
});
const environment = {
  ...process.env,
  RELEASE_IMAGE: 'uttirno-m8:local',
  PARSER_IMAGE: 'uttirno-m8-parser:local',
  API_ENV_FILE: apiFile,
  PORTAL_ENV_FILE: webFile,
  ADMIN_ENV_FILE: webFile,
  MIGRATION_ENV_FILE: migrationFile,
  WORKER_ENV_FILE: workerFile,
  ARCHIVE_ROOT: c.root,
  WORKER_CONFIG_ROOT: workerConfig,
  API_CONFIG_ROOT: apiConfig,
  WORKER_ACTOR_ID: 'SYNTHETIC_DISABLED_REHEARSAL',
};
const compose = [
  'compose',
  '-p',
  `uttirno-m8-${randomBytes(5).toString('hex')}`,
  '-f',
  'infra/deployment/compose.yaml',
];
const overlay = path.join(folder, 'backend.json');
await writeFile(
  overlay,
  JSON.stringify({
    services: {
      api: { networks: ['default', 'fixture_backend'] },
      migrate: { networks: ['default', 'fixture_backend'] },
    },
    networks: { fixture_backend: { external: true, name: 'uttirno-local_default' } },
  }),
);
compose.push('-f', overlay);
const start = performance.now();
let started = false;
try {
  await docker([...compose, 'config', '--quiet'], environment);
  await docker([...compose, 'run', '--rm', '--no-deps', 'migrate'], environment);
  started = true;
  await docker([...compose, 'up', '-d', '--wait', 'api', 'portal', 'admin'], environment);
  const parserId = (await docker([...compose, 'ps', '-q', 'parser'], environment)).trim();
  const inspect = JSON.parse(await docker(['inspect', parserId], environment))[0];
  assert.equal(inspect.HostConfig.NetworkMode, 'none');
  assert.equal(inspect.HostConfig.ReadonlyRootfs, true);
  assert.equal(inspect.HostConfig.Memory, 536870912);
  assert.equal(inspect.Config.User, '1000:1000');
  assert.deepEqual(inspect.HostConfig.CapDrop, ['ALL']);
  const denial = await docker(
    [
      ...compose,
      'exec',
      '-T',
      'parser',
      'node',
      '-e',
      "if(process.env.DATABASE_URL||require('fs').existsSync('/archive'))process.exit(1);fetch('http://192.0.2.1',{signal:AbortSignal.timeout(500)}).then(()=>process.exit(1)).catch(()=>console.log('network-denied'))",
    ],
    environment,
  );
  assert.ok(denial.includes('network-denied'));
  const pdf = (await readFile('tests/fixtures/documents/mixed-text.pdf')).toString('base64');
  const parserResult = JSON.parse(
    await docker(
      [
        ...compose,
        'exec',
        '-T',
        'api',
        'node',
        '--input-type=module',
        '-e',
        "import {extractPdf,renderOriginalPng} from '@uttirno/agent/document-review';let value='';for await(const c of process.stdin)value+=c;const bytes=Buffer.from(value,'base64');const result=await extractPdf(bytes,{sourceId:'SYNTHETIC-M8',configFingerprint:'a'.repeat(64)});const png=await renderOriginalPng(bytes,1);console.log(JSON.stringify({pages:result.pages.length,text:result.pages[0].text.length,pngBytes:png.length}));",
      ],
      environment,
      pdf,
    ),
  );
  assert.ok(parserResult.pages > 0);
  assert.ok(parserResult.text > 20);
  assert.ok(parserResult.pngBytes > 24);
  const rejected = await docker(
    [
      ...compose,
      'exec',
      '-T',
      'api',
      'node',
      '-e',
      "const r=require('http').request({socketPath:'/run/parser/native.sock',path:'/extract',method:'POST'},res=>{console.log(res.statusCode);res.resume()});r.end(JSON.stringify({url:'https://notices.example/',path:'/etc/passwd'}));",
    ],
    environment,
  );
  assert.equal(rejected.trim(), '422');
  const noNative = await docker(
    [
      ...compose,
      'exec',
      '-T',
      'api',
      'node',
      '-e',
      "if(require('child_process').spawnSync('pdfinfo',['-v']).error?.code!=='ENOENT')process.exit(1);console.log('native-tools-absent')",
    ],
    environment,
  );
  assert.ok(noNative.includes('native-tools-absent'));
  let portal = '';
  for (let i = 0; i < 20; i++) {
    try {
      portal = await (await fetch('http://127.0.0.1:18300/jobs?lang=en')).text();
      if (portal.includes('No matching jobs')) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(portal.includes('No matching jobs'));
  assert.equal((await fetch('http://127.0.0.1:18400/v1/admin/session')).status, 401);
  assert.equal((await fetch('http://127.0.0.1:18400/internal/metrics')).status, 404);
  const metrics = await fetch('http://127.0.0.1:18400/internal/metrics', {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(metrics.status, 200);
  assert.ok((await metrics.text()).includes('uttirno_dead_stages'));
  // Recreate the shared namespace group together: a single API-container replacement is not a web-only rollback.
  await docker(
    [...compose, 'up', '-d', '--force-recreate', '--wait', 'api', 'portal', 'admin'],
    environment,
  );
  assert.equal((await fetch('http://127.0.0.1:18400/health/ready')).status, 200);
  const report = {
    profile: 'SYNTHETIC local container rehearsal',
    appImage: (
      await docker(['image', 'inspect', 'uttirno-m8:local', '--format', '{{.Id}}'], environment)
    ).trim(),
    parserImage: inspect.Image,
    isolation: {
      networkNone: true,
      readOnly: true,
      nonRoot: true,
      noCapabilities: true,
      memoryMiB: 512,
    },
    parser: parserResult,
    elapsedMs: Math.round(performance.now() - start),
    liveHostingTlsOidcVerified: false,
    previousReleaseRollbackVerified: false,
  };
  await writeFile('.local/m8-deployment.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  if (started) await docker([...compose, 'down'], environment);
  await roles.close();
  await c.close();
  const resolved = path.resolve(folder);
  assert.ok(
    resolved.startsWith(path.resolve('.local') + path.sep) &&
      path.basename(resolved).startsWith('m8-rehearsal-'),
    'UNSAFE_REHEARSAL_CLEANUP',
  );
  await rm(resolved, { recursive: true, force: true });
}
