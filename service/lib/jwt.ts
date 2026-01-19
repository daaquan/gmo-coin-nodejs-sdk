import { jwtVerify, createRemoteJWKSet, type JWTVerifyOptions } from 'jose';

export interface JwtOptions {
  jwksUrl: string;
  issuer?: string;
  audience?: string | string[];
}

export async function verifyJwt(token: string, options: JwtOptions) {
  const { jwksUrl, issuer, audience } = options;
  const jwks = createRemoteJWKSet(new URL(jwksUrl));

  const verifyOptions: JWTVerifyOptions = {};
  if (issuer) verifyOptions.issuer = issuer;
  if (audience) verifyOptions.audience = audience;

  const { payload } = await jwtVerify(token, jwks, verifyOptions);
  return payload;
}