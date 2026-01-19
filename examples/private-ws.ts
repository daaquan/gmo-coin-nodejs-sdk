/**
 * Show: obtain WS token, connect, subscribe to execution + order streams.
 */
import { FxPrivateWsAuth, FxPrivateWsClient } from '../src/ws-private.js';

const apiKey = process.env.FX_API_KEY;
const secret = process.env.FX_API_SECRET;
if (!apiKey || !secret) {
  console.error(
    'Missing FX_API_KEY or FX_API_SECRET.\nSet them, e.g.:\n  FX_API_KEY=yourKey FX_API_SECRET=yourSecret npm run examples:ws',
  );
  process.exit(1);
}
const auth = new FxPrivateWsAuth(apiKey, secret);

(async () => {
  try {
    // Allow overriding with a pre-obtained token
    let token = process.env.WS_TOKEN;
    if (!token) {
      const tokenResp = await auth.create();
      token = tokenResp?.data;
      if (!token) {
        console.error(
          'Failed to obtain WS token. Check that your API key/secret are correct and the client IP is allowlisted in GMO Coin settings.',
        );
        console.error('Response:', tokenResp);
        process.exit(1);
      }
    }

    const ws = new FxPrivateWsClient(token);
    await ws.connect();

    ws.onMessage((msg) => console.log('WS:', msg));

    await ws.subscribe('execution');
    await ws.subscribe('order');

    // Keep process alive for demo
    setTimeout(async () => {
      await ws.close();
      // await auth.revoke(token);
      process.exit(0);
    }, 60_000);
  } catch (e) {
    console.error('WS example failed:', e);
    console.error(
      'Hint: Private WS requires a token from /v1/ws-auth and may enforce IP allowlists.',
    );
  }
})();
