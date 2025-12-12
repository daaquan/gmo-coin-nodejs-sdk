/**
 * 暗号資産のポジションと注文一覧を取得
 */
import 'dotenv/config';
import { CryptoPrivateRestClient } from '../src/rest.js';

const apiKey = process.env.CRYPTO_API_KEY;
const secret = process.env.CRYPTO_API_SECRET;

if (!apiKey || !secret) {
  console.error('Missing CRYPTO_API_KEY or CRYPTO_API_SECRET.');
  process.exit(1);
}

const crypto = new CryptoPrivateRestClient(apiKey, secret);

(async () => {
  try {
    console.log('=== 暗号資産 資産一覧 ===');
    try {
      const assets = await crypto.getAssets();
      console.log(JSON.stringify(assets, null, 2));
    } catch (e: any) {
      console.error('資産一覧取得エラー:', e.message);
    }

    console.log('\n=== 暗号資産 ポジション一覧 ===');
    try {
      const positions = await crypto.getOpenPositions({ symbol: 'BTC_JPY' });
      console.log(JSON.stringify(positions, null, 2));
    } catch (e: any) {
      console.error('ポジション一覧取得エラー:', e.message);
    }

    console.log('\n=== 暗号資産 注文一覧 ===');
    try {
      const orders = await crypto.getActiveOrders({ symbol: 'BTC_JPY', pageSize: '100' });
      console.log(JSON.stringify(orders, null, 2));
    } catch (e: any) {
      console.error('注文一覧取得エラー:', e.message);
    }

  } catch (e) {
    console.error('Error:', e);
  }
})();
