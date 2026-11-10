import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function googleLocalEnvironment(document) {
  const client = document?.web;
  if (
    !client ||
    typeof client.client_id !== 'string' ||
    !/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(client.client_id) ||
    typeof client.client_secret !== 'string' ||
    !/^[a-zA-Z0-9_-]+$/.test(client.client_secret) ||
    client.auth_uri !== 'https://accounts.google.com/o/oauth2/auth' ||
    client.token_uri !== 'https://oauth2.googleapis.com/token' ||
    !Array.isArray(client.redirect_uris) ||
    !client.redirect_uris.includes('http://localhost:4000/v1/admin/auth/callback')
  )
    throw new Error('GOOGLE_WEB_CLIENT_WITH_REGISTERED_LOCAL_CALLBACK_REQUIRED');
  return `${Object.entries({
    API_PUBLIC_ORIGIN: 'http://localhost:4000',
    ADMIN_ORIGIN: 'http://localhost:3001',
    AUTH_ISSUER: 'https://accounts.google.com',
    AUTH_CLIENT_ID: client.client_id,
    AUTH_CLIENT_SECRET: client.client_secret,
    AUTH_REDIRECT_URI: 'http://localhost:4000/v1/admin/auth/callback',
    AUTH_ALLOWED_ORIGINS:
      'https://accounts.google.com,https://oauth2.googleapis.com,https://www.googleapis.com',
    AUTH_STATE_KEY: randomBytes(32).toString('hex'),
  })
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2]) throw new Error('INPUT_REQUIRED');
    const body = googleLocalEnvironment(JSON.parse(await readFile(process.argv[2], 'utf8')));
    await mkdir('.local', { recursive: true });
    await writeFile('.local/google-oidc.env', body, { flag: 'wx', mode: 0o600 });
    console.log('Created ignored .local/google-oidc.env; existing configuration was preserved.');
    console.log('No login, staff binding, source activation or permission grant was performed.');
  } catch {
    console.error(
      'Google local setup failed: require a valid web client with the registered localhost callback and no existing output. Credentials were not printed.',
    );
    process.exitCode = 1;
  }
}
