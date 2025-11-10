import { FxPrivateRestClient, CryptoPrivateRestClient } from '../../src/rest.js';

/**
 * Determine if symbol is FX or Crypto based on format
 * FX symbols contain underscore (e.g., USD_JPY, EUR_JPY)
 * Crypto symbols are single tokens (e.g., BTC, ETH)
 */
export function determineClientType(symbol: string): 'fx' | 'crypto' {
  if (symbol.includes('_')) {
    return 'fx';
  }
  return 'crypto';
}

/**
 * Get the appropriate REST client based on symbol
 */
export function getClient(
  apiKey: string,
  secret: string,
  symbol: string
): FxPrivateRestClient | CryptoPrivateRestClient {
  const clientType = determineClientType(symbol);

  if (clientType === 'fx') {
    return new FxPrivateRestClient(apiKey, secret);
  } else {
    return new CryptoPrivateRestClient(apiKey, secret);
  }
}

/**
 * FX supported symbols
 */
export const FX_SYMBOLS = [
  'USD_JPY',
  'EUR_JPY',
  'GBP_JPY',
  'AUD_JPY',
  'NZD_JPY',
  'CAD_JPY',
  'CHF_JPY',
  'ZAR_JPY',
  'TRY_JPY',
  'CNY_JPY',
  'HKD_JPY',
  'SGD_JPY',
  'INR_JPY',
  'MXN_JPY',
  'BRL_JPY',
  'EUR_USD',
  'GBP_USD',
  'AUD_USD',
];

/**
 * Crypto supported symbols
 */
export const CRYPTO_SYMBOLS = [
  'BTC',
  'ETH',
  'BCH',
  'LTC',
  'XRP',
  'XEM',
  'XLM',
  'BAT',
  'OMG',
  'XTZ',
  'QTUM',
  'ENJ',
  'DOT',
  'ATOM',
  'ADA',
  'MKR',
  'DAI',
  'LINK',
  'SOL',
  'MATIC',
  'AAVE',
  'UNI',
  'AVAX',
  'DOGE',
  'SHIB',
];

/**
 * Validate symbol is supported
 */
export function isValidSymbol(symbol: string): boolean {
  const clientType = determineClientType(symbol);
  if (clientType === 'fx') {
    return FX_SYMBOLS.includes(symbol);
  } else {
    return CRYPTO_SYMBOLS.includes(symbol);
  }
}

/**
 * Check if executionType is supported for the symbol
 */
export function isValidExecutionType(
  symbol: string,
  executionType: string
): boolean {
  const clientType = determineClientType(symbol);

  if (clientType === 'fx') {
    // FX supports LIMIT, STOP, OCO (and more with special order types)
    return ['LIMIT', 'STOP', 'OCO'].includes(executionType);
  } else {
    // Crypto supports MARKET, LIMIT, STOP
    return ['MARKET', 'LIMIT', 'STOP'].includes(executionType);
  }
}
