// SYNTHETIC OIDC protocol fixture. Real HTTP/JWKS/RSA signatures; no real provider or user data.
import { createServer } from 'node:http';
import { generateKeyPairSync, randomBytes, createHash, sign } from 'node:crypto';
export async function oidcFixture(redirectUri = 'http://127.0.0.1:4000/v1/admin/auth/callback') {
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 }),
    publicJwk = keys.publicKey.export({ format: 'jwk' });
  const clientId = 'SYNTHETIC-client',
    clientSecret = 'SYNTHETIC-client-secret-not-real';
  let issuer = '',
    subject = 'admin-sub',
    mode: 'valid' | 'nonce' | 'audience' | 'signature' | 'expired' | 'issuer' | 'pkce' = 'valid';
  const codes = new Map<
      string,
      { nonce: string; challenge: string; subject: string; redirect: string }
    >(),
    requests: string[] = [];
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', issuer);
      requests.push(url.pathname);
      const json = (value: unknown, status = 200) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(value));
      };
      if (url.pathname === '/.well-known/openid-configuration')
        return json({
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          jwks_uri: `${issuer}/jwks`,
          response_types_supported: ['code'],
          subject_types_supported: ['public'],
          id_token_signing_alg_values_supported: ['RS256'],
          token_endpoint_auth_methods_supported: ['client_secret_post'],
          code_challenge_methods_supported: ['S256'],
          scopes_supported: ['openid'],
        });
      if (url.pathname === '/jwks')
        return json({ keys: [{ ...publicJwk, kid: 'synthetic-key', alg: 'RS256', use: 'sig' }] });
      if (url.pathname === '/authorize') {
        const q = url.searchParams;
        if (
          q.get('client_id') !== clientId ||
          q.get('redirect_uri') !== redirectUri ||
          q.get('code_challenge_method') !== 'S256' ||
          !q.get('nonce') ||
          !q.get('state')
        )
          return json({ error: 'invalid_request' }, 400);
        const code = randomBytes(24).toString('hex');
        codes.set(code, {
          nonce: q.get('nonce') ?? '',
          challenge: q.get('code_challenge') ?? '',
          subject,
          redirect: redirectUri,
        });
        const callback = new URL(redirectUri);
        callback.searchParams.set('code', code);
        callback.searchParams.set('state', q.get('state') ?? '');
        callback.searchParams.set('iss', issuer);
        res.writeHead(302, { location: callback.href });
        res.end();
        return;
      }
      if (url.pathname === '/token') {
        let body = '';
        for await (const chunk of req) {
          body += chunk.toString();
          if (body.length > 20000) return json({ error: 'invalid_request' }, 400);
        }
        const q = new URLSearchParams(body),
          code = q.get('code') ?? '',
          transaction = codes.get(code);
        codes.delete(code);
        const challenge = createHash('sha256')
          .update(q.get('code_verifier') ?? '')
          .digest('base64url');
        if (
          !transaction ||
          q.get('client_secret') !== clientSecret ||
          q.get('client_id') !== clientId ||
          q.get('redirect_uri') !== transaction.redirect ||
          challenge !== transaction.challenge ||
          mode === 'pkce'
        )
          return json({ error: 'invalid_grant' }, 400);
        const now = Math.floor(Date.now() / 1000),
          header = Buffer.from(
            JSON.stringify({ alg: 'RS256', kid: 'synthetic-key', typ: 'JWT' }),
          ).toString('base64url');
        const payload = Buffer.from(
          JSON.stringify({
            iss: mode === 'issuer' ? 'https://unapproved.example' : issuer,
            sub: transaction.subject,
            aud: mode === 'audience' ? 'another-client' : clientId,
            iat: now,
            exp: mode === 'expired' ? now - 60 : now + 300,
            nonce: mode === 'nonce' ? 'wrong-nonce' : transaction.nonce,
            roles: ['administrator'],
            email: 'ignored-synthetic@example.invalid',
          }),
        ).toString('base64url');
        const signature =
          mode === 'signature'
            ? randomBytes(256).toString('base64url')
            : sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), keys.privateKey).toString(
                'base64url',
              );
        return json({
          access_token: randomBytes(32).toString('base64url'),
          token_type: 'Bearer',
          expires_in: 300,
          id_token: `${header}.${payload}.${signature}`,
        });
      }
      return json({ error: 'not_found' }, 404);
    } catch {
      res.writeHead(500);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('SYNTHETIC_ISSUER_ADDRESS');
  issuer = `http://127.0.0.1:${address.port}`;
  return {
    issuer,
    clientId,
    clientSecret,
    requests,
    setSubject: (value: string) => {
      subject = value;
    },
    setMode: (value: typeof mode) => {
      mode = value;
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
