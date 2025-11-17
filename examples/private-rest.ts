/**
 * Show: assets, active orders, place + cancel a LIMIT order.
 */
import { FxPrivateRestClient } from '../src/rest.js';
import type { FxActiveOrder } from '../src/types.js';

const apiKey = process.env.FX_API_KEY;
const secret = process.env.FX_API_SECRET;
if (!apiKey || !secret) {
  console.error('Missing FX_API_KEY or FX_API_SECRET.\nSet them, e.g.:\n  FX_API_KEY=yourKey FX_API_SECRET=yourSecret npm run examples:rest');
  process.exit(1);
}
const fx = new FxPrivateRestClient(apiKey, secret);

(async () => {
  try {
    // 1) Account
    const assets = await fx.getAssets();
    console.log('Assets:', assets.data);

    // 2) Optionally place an order (opt-in via env flags)
    // Avoid accidental real trading. Enable one of the following flags explicitly:
    //  - PLACE_LIMIT=1 with ORDER_LIMIT_PRICE set
    //  - PLACE_SPEED=1 (market-like)
    const symbol = process.env.ORDER_SYMBOL || 'USD_JPY';
    const side = (process.env.ORDER_SIDE as 'BUY' | 'SELL') || 'BUY';
    const size = process.env.ORDER_SIZE || '1000';

    if (process.env.PLACE_LIMIT === '1') {
      const price = process.env.ORDER_LIMIT_PRICE;
      if (!price) {
        console.error('PLACE_LIMIT=1 requires ORDER_LIMIT_PRICE to be set.');
        process.exit(1);
      }
      const placed = await fx.placeOrder({
        symbol,
        side,
        size,
        executionType: 'LIMIT',
        limitPrice: price,
      });
      console.log('Placed LIMIT:', placed.data);
      const ids = placed.data.map((o) => o.rootOrderId);
      if (ids.length) {
        const canceled = await fx.cancelOrders({ rootOrderIds: ids });
        console.log('Canceled:', canceled.data);
      }
    } else if (process.env.PLACE_SPEED === '1') {
      const placed = await fx.speedOrder({ symbol, side, size });
      console.log('Placed SPEED:', placed.data);
      const ids = placed.data.map((o) => o.rootOrderId);
      if (ids.length) {
        const canceled = await fx.cancelOrders({ rootOrderIds: ids });
        console.log('Canceled:', canceled.data);
      }
    } else {
      console.log('Order placement is skipped by default. Set PLACE_LIMIT=1 (and ORDER_LIMIT_PRICE) or PLACE_SPEED=1 to place and cancel an order.');
    }

    // 3) List active orders (robust to different shapes)
    const active = await fx.getActiveOrders({ symbol, count: '10' });
    const aData: FxActiveOrder[] | { list?: FxActiveOrder[] } = active.data;
    const list: FxActiveOrder[] = Array.isArray(aData)
      ? aData
      : ((aData as { list?: FxActiveOrder[] })?.list ?? []);
    console.log('Active orders (first 3):', list.slice(0, 3));
  } catch (e) {
    console.error(e);
  }
})();
