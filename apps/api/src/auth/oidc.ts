import * as oidc from 'openid-client';
export type OidcOptions = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  allowedOrigins: string[];
  allowLoopbackHttp: boolean;
};
export class OidcProvider {
  private config: Promise<oidc.Configuration> | undefined;
  constructor(private readonly options: OidcOptions) {}
  private async configuration() {
    if (!this.config)
      this.config = this.discover().catch((error) => {
        this.config = undefined;
        throw error;
      });
    return this.config;
  }
  private async discover() {
    const bounded: oidc.CustomFetch = async (input, init) => {
      const url = new URL(input);
      if (
        !this.options.allowedOrigins.includes(url.origin) ||
        url.username ||
        url.password ||
        url.hash ||
        (url.protocol !== 'https:' &&
          !(
            this.options.allowLoopbackHttp &&
            url.protocol === 'http:' &&
            ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
          ))
      )
        throw new Error('OIDC_ENDPOINT_DENIED');
      const request: RequestInit = {
        method: init.method,
        headers: init.headers,
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      };
      if (init.body !== undefined) request.body = init.body as NonNullable<RequestInit['body']>;
      const response = await fetch(url, request);
      if (!response.body) return response;
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.length;
        if (size > 262144) {
          await reader.cancel();
          throw new Error('OIDC_RESPONSE_LIMIT');
        }
        chunks.push(next.value);
      }
      return new Response(Buffer.concat(chunks), {
        status: response.status,
        headers: response.headers,
      });
    };
    const execute = [
      oidc.enableNonRepudiationChecks,
      ...(this.options.allowLoopbackHttp ? [oidc.allowInsecureRequests] : []),
    ];
    const config = await oidc.discovery(
      new URL(this.options.issuer),
      this.options.clientId,
      { client_secret: this.options.clientSecret, id_token_signed_response_alg: 'RS256' },
      oidc.ClientSecretPost(this.options.clientSecret),
      { execute, timeout: 10, [oidc.customFetch]: bounded },
    );
    if (config.serverMetadata().issuer !== this.options.issuer)
      throw new Error('OIDC_ISSUER_MISMATCH');
    return config;
  }
  async begin() {
    const config = await this.configuration(),
      verifier = oidc.randomPKCECodeVerifier(),
      state = oidc.randomState(),
      nonce = oidc.randomNonce();
    const url = oidc.buildAuthorizationUrl(config, {
      redirect_uri: this.options.redirectUri,
      scope: 'openid',
      state,
      nonce,
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      code_challenge_method: 'S256',
      response_type: 'code',
    });
    if (!this.options.allowedOrigins.includes(url.origin)) throw new Error('OIDC_ENDPOINT_DENIED');
    return { url: url.href, transaction: { state, nonce, verifier } };
  }
  async callback(url: URL, transaction: { state: string; nonce: string; verifier: string }) {
    if (
      url.origin !== new URL(this.options.redirectUri).origin ||
      url.pathname !== new URL(this.options.redirectUri).pathname
    )
      throw new Error('OIDC_CALLBACK_DENIED');
    const config = await this.configuration();
    const tokens = await oidc.authorizationCodeGrant(config, url, {
      expectedState: transaction.state,
      expectedNonce: transaction.nonce,
      pkceCodeVerifier: transaction.verifier,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims?.sub || claims.iss !== this.options.issuer)
      throw new Error('OIDC_IDENTITY_INVALID');
    // Access/refresh/ID tokens are discarded; only verified stable issuer + subject cross this boundary.
    return { issuer: claims.iss, subject: claims.sub };
  }
}
