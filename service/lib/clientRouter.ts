import { FxPrivateRestClient, CryptoPrivateRestClient } from '../../src/rest.js';

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
 * Crypto supported symbols (base currencies)
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
 * Set of crypto base currencies for quick lookup.
 * Used by determineClientType to distinguish e.g. DOGE_JPY (crypto) from USD_JPY (fx).
 */
const CRYPTO_BASES = new Set(CRYPTO_SYMBOLS);

/**
 * Determine if symbol is FX or Crypto.
 * Crypto can be bare (BTC) or paired (DOGE_JPY, BTC_JPY).
 * If the base portion (before _) is a known crypto, it's crypto.
 */
export function determineClientType(symbol: string): 'fx' | 'crypto' {
  const base = symbol.includes('_') ? (symbol.split('_')[0] ?? symbol) : symbol;
  if (CRYPTO_BASES.has(base)) {
    return 'crypto';
  }
  return 'fx';
}

/**
 * Get the appropriate REST client based on symbol
 */
export function getClient(
  apiKey: string,
  secret: string,
  symbol: string,
): FxPrivateRestClient | CryptoPrivateRestClient {
  const clientType = determineClientType(symbol);

  if (clientType === 'fx') {
    return new FxPrivateRestClient(apiKey, secret);
  } else {
    return new CryptoPrivateRestClient(apiKey, secret);
  }
}

/**
 * Validate symbol is supported
 */
export function isValidSymbol(symbol: string): boolean {
  const clientType = determineClientType(symbol);
  if (clientType === 'fx') {
    return FX_SYMBOLS.includes(symbol);
  } else {
    // Accept both bare (DOGE) and paired (DOGE_JPY) forms
    const base = symbol.includes('_') ? (symbol.split('_')[0] ?? symbol) : symbol;
    return CRYPTO_BASES.has(base);
  }
}

/**
 * Check if executionType is supported for the symbol
 */
export function isValidExecutionType(symbol: string, executionType: string): boolean {
  const clientType = determineClientType(symbol);

  if (clientType === 'fx') {
    // FX supports LIMIT, STOP, OCO (and more with special order types)
    return ['LIMIT', 'STOP', 'OCO'].includes(executionType);
  } else {
    // Crypto supports MARKET, LIMIT, STOP
    return ['MARKET', 'LIMIT', 'STOP'].includes(executionType);
  }
}
