/**
 * Check FX open positions
 */
import 'dotenv/config';
import { FxPrivateRestClient } from '../src/rest.js';

const apiKey = process.env.FX_API_KEY;
const secret = process.env.FX_API_SECRET;
if (!apiKey || !secret) {
  console.error('Missing FX_API_KEY or FX_API_SECRET.\nSet them in .env file');
  process.exit(1);
}

const fx = new FxPrivateRestClient(apiKey, secret);

(async () => {
  try {
    console.log('Fetching FX open positions...\n');

    // Get all open positions
    const positions = await fx.getOpenPositions();
    console.log('Open Positions Response:');
    console.log(JSON.stringify(positions, null, 2));

    console.log('\n--- Summary ---');
    console.log('Status:', positions.status);
    console.log('Response code:', positions.responsetime);

    if (positions.data) {
      const list = Array.isArray(positions.data)
        ? positions.data
        : (positions.data as any)?.list || [];
      console.log('Number of open positions:', list.length);

      if (list.length > 0) {
        console.log('\nFirst position:');
        console.log(JSON.stringify(list[0], null, 2));
      }
    }

    // Also try with a specific symbol
    console.log('\n--- USD_JPY Positions ---');
    const usdJpyPositions = await fx.getOpenPositions({ symbol: 'USD_JPY' });
    console.log(JSON.stringify(usdJpyPositions, null, 2));

    // Check active orders
    console.log('\n\n========== ACTIVE ORDERS ==========\n');
    const activeOrders = await fx.getActiveOrders();
    console.log('Active Orders Response:');
    console.log(JSON.stringify(activeOrders, null, 2));

    console.log('\n--- Active Orders Summary ---');
    console.log('Status:', activeOrders.status);
    console.log('Response time:', activeOrders.responsetime);

    if (activeOrders.data) {
      const orderList = Array.isArray(activeOrders.data)
        ? activeOrders.data
        : (activeOrders.data as any)?.list || [];
      console.log('Number of active orders:', orderList.length);

      if (orderList.length > 0) {
        console.log('\nFirst active order:');
        console.log(JSON.stringify(orderList[0], null, 2));
      }
    }

    // Also try with a specific symbol
    console.log('\n--- USD_JPY Active Orders ---');
    const usdJpyOrders = await fx.getActiveOrders({ symbol: 'USD_JPY' });
    console.log(JSON.stringify(usdJpyOrders, null, 2));

    // Check latest executions
    console.log('\n\n========== LATEST EXECUTIONS ==========\n');

    // Try with count=100
    console.log('--- Fetching with count=100 ---');
    const latestExecs = await fx.getLatestExecutions({ symbol: 'USD_JPY', count: '100' });
    console.log('Latest Executions Response (raw):');
    console.log(JSON.stringify(latestExecs, null, 2));
    console.log('\nData type:', typeof latestExecs.data);
    console.log('Is array?', Array.isArray(latestExecs.data));

    console.log('\n--- Latest Executions Summary ---');
    console.log('Status:', latestExecs.status);
    console.log('Response time:', latestExecs.responsetime);

    if (latestExecs.data) {
      const execList = Array.isArray(latestExecs.data)
        ? latestExecs.data
        : (latestExecs.data as any)?.list || [];
      console.log('Number of executions:', execList.length);

      if (execList.length > 0) {
        console.log('\nFirst 5 executions:');
        execList.slice(0, 5).forEach((exec: any, idx: number) => {
          console.log(`\n[${idx + 1}]`, JSON.stringify(exec, null, 2));
        });
      } else {
        console.log('No executions found. Full data object:');
        console.log(JSON.stringify(latestExecs.data, null, 2));
      }
    }

  } catch (e) {
    console.error('Error:', e);
    if (e instanceof Error) {
      console.error('Message:', e.message);
      console.error('Stack:', e.stack);
    }
  }
})();
