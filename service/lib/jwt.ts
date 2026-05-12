import { jwtVerify, createRemoteJWKSet, type JWTVerifyOptions } from 'jose';

export interface JwtOptions {
  jwksUrl: string;
  issuer?: string;
  audience?: string | string[];
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function extractBearerToken(token: string): string {
  if (!token || typeof token !== 'string') {
    throw new Error('missing_bearer');
  }
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error('missing_bearer');
  }
  const match = trimmed.match(/^Bearer\s+(.+)$/);
  if (!match) {
    throw new Error('missing_bearer');
  }
  return match[1];
}

export async function verifyJwt(token: string, options: JwtOptions | undefined) {
  if (!options || !options.jwksUrl) {
    throw new Error('missing_jwks');
  }

  const rawToken = extractBearerToken(token);
  const { jwksUrl, issuer, audience } = options;

  let jwks = jwksCache.get(jwksUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUrl));
    jwksCache.set(jwksUrl, jwks);
  }

  const verifyOptions: JWTVerifyOptions = {};
  if (issuer) verifyOptions.issuer = issuer;
  if (audience) verifyOptions.audience = audience;

  const { payload } = await jwtVerify(rawToken, jwks, verifyOptions);
  return payload;
}
