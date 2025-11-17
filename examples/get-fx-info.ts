/**
 * FXのポジションと注文一覧を取得
 */
import 'dotenv/config';
import { FxPrivateRestClient } from '../src/rest.js';

const apiKey = process.env.FX_API_KEY;
const secret = process.env.FX_API_SECRET;

if (!apiKey || !secret) {
  console.error('Missing FX_API_KEY or FX_API_SECRET.');
  process.exit(1);
}

const fx = new FxPrivateRestClient(apiKey, secret);

(async () => {
  try {
    console.log('=== FX ポジション一覧 ===');
    const positions = await fx.getOpenPositions({ symbol: 'USD_JPY' });
    console.log(JSON.stringify(positions, null, 2));

    console.log('\n=== FX 注文一覧 ===');
    const orders = await fx.getActiveOrders({ symbol: 'USD_JPY', count: '100' });
    console.log(JSON.stringify(orders, null, 2));

  } catch (e) {
    console.error('Error:', e);
  }
})();
