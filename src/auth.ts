/**
 * Builds Private API headers for GMO Coin FX:
 * sign = timestamp + method + path + body ('' for GET), HMAC-SHA256(secret)
 * IMPORTANT: path starts with '/v1', not '/private'.
 */
import crypto from 'node:crypto';

export function buildHeaders(
  apiKey: string,
  secret: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string, // e.g. '/v1/order'
  body: string, // '' for GET
) {
  const ts = Date.now().toString();
  const text = ts + method + path + body;
  const sign = crypto.createHmac('sha256', secret).update(text).digest('hex');
  return {
    'API-KEY': apiKey,
    'API-TIMESTAMP': ts,
    'API-SIGN': sign,
    'Content-Type': 'application/json',
  } as Record<string, string>;
}
