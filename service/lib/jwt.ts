import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

export type JwtOptions = {
  jwksUrl: string;
  issuer?: string;
  audience?: string;
};

export async function verifyJwt(authorization?: string, opts?: JwtOptions): Promise<JWTPayload> {
  if (!authorization?.startsWith('Bearer ')) throw new Error('missing_bearer');
  if (!opts?.jwksUrl) throw new Error('missing_jwks');
  const token = authorization.slice('Bearer '.length);
  if (!jwks) jwks = createRemoteJWKSet(new URL(opts.jwksUrl));
  const { payload } = await jwtVerify(token, jwks, {
    issuer: opts.issuer,
    audience: opts.audience,
  });
  return payload;
}
