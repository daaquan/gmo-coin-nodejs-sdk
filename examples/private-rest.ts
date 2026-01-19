import { FxPrivateRestClient } from '../src/rest.js';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const apiKey = process.env.FX_API_KEY || '';
  const secret = process.env.FX_API_SECRET || '';

  if (!apiKey || !secret) {
    console.error('Please set FX_API_KEY and FX_API_SECRET in .env');
    return;
  }

  const fx = new FxPrivateRestClient(apiKey, secret);

  // 1. Get Assets
  const assets = await fx.getAssets();
  if (assets.success) {
    console.log('Assets:', assets.data);
  } else {
    console.error('Failed to get assets:', assets.error.message);
  }

  // 2. Get Active Orders
  const active = await fx.getActiveOrders({ symbol: 'USD_JPY' });
  if (active.success) {
    console.log('Active Orders:', active.data.length);
  } else {
    console.error('Failed to get active orders:', active.error.message);
  }
}

main().catch(console.error);