import { readFile, appendFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadServerEnvironment } from '@uttirno/env';
const env = loadServerEnvironment(),
  db = new URL(env.DATABASE_URL);
if (
  env.NODE_ENV === 'production' ||
  db.hostname !== '127.0.0.1' ||
  db.port !== '55432' ||
  db.pathname !== '/uttirno_dev'
)
  throw new Error('ISOLATED_LOCAL_ENV_REQUIRED');
const file = fileURLToPath(new URL('../.env', import.meta.url));
const text = await readFile(file, 'utf8'),
  keys = new Set([...text.matchAll(/^([A-Z_][A-Z0-9_]*)=/gm)].map((m) => m[1]));
const entries = {
  API_PUBLIC_ORIGIN: 'http://127.0.0.1:4000',
  ADMIN_ORIGIN: 'http://127.0.0.1:3001',
  API_CURSOR_SECRET: randomBytes(32).toString('hex'),
  API_SESSION_SECRET: randomBytes(32).toString('hex'),
};
const additions = Object.entries(entries).filter(([key]) => !keys.has(key));
if (additions.length)
  await appendFile(
    file,
    `\n# Local M5 API configuration; no OIDC provider or account enabled.\n${additions.map(([key, value]) => `${key}=${value}`).join('\n')}\n`,
    { mode: 0o600 },
  );
console.log(
  `Added ${additions.length} missing local API settings; existing credentials preserved and values redacted.`,
);
