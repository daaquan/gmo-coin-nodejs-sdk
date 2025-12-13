/**
 * Crypto Public WebSocket Example
 * Demonstrates real-time ticker data streaming for cryptocurrencies
 * No authentication required
 */
import { CryptoPublicWsClient } from '../src/ws-public.js';

const symbols = ['BTC', 'ETH', 'XRP'];

async function main() {
  const ws = new CryptoPublicWsClient();

  console.log('Connecting to Crypto public WebSocket...');
  await ws.connect();
  console.log('Connected!\n');

  ws.onMessage((msg) => {
    console.log('Ticker update:', JSON.stringify(msg, null, 2));
  });

  ws.onError((error) => {
    console.error('WebSocket error:', error.message);
  });

  ws.onClose(() => {
    console.log('Connection closed');
  });

  console.log(`Subscribing to ${symbols.join(', ')}...\n`);
  for (const symbol of symbols) {
    await ws.subscribe(symbol);
    console.log(`Subscribed to ${symbol}`);
  }

  console.log('\nReceiving ticker updates... Press Ctrl+C to exit\n');

  process.on('SIGINT', async () => {
    console.log('\nClosing connection...');
    await ws.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
