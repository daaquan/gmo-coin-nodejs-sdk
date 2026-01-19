import { CryptoPrivateRestClient } from '../src/rest.js';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const apiKey = process.env.CRYPTO_API_KEY || '';
  const secret = process.env.CRYPTO_API_SECRET || '';

  if (!apiKey || !secret) {
    console.error('Please set CRYPTO_API_KEY and CRYPTO_API_SECRET in .env');
    return;
  }

  const crypto = new CryptoPrivateRestClient(apiKey, secret);

  // 1. Get Assets
  const assets = await crypto.getAssets();
  if (assets.success) {
    console.log('Crypto Assets:', assets.data);
  }

  // 2. Get Open Positions
  const positions = await crypto.getOpenPositions({ symbol: 'BTC' });
  if (positions.success) {
    console.log('Open Positions:', positions.data);
  }
}

main().catch(console.error);