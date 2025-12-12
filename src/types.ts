export type Side = 'BUY' | 'SELL';
export type ExecType = 'LIMIT' | 'STOP' | 'OCO';
export type SettleType = 'OPEN' | 'CLOSE';

export interface ApiEnvelope<T> {
  status: number; // 0 = success
  data: T;
  responsetime: string; // ISO8601
}

/** /v1/account/assets */
export interface FxAsset {
  equity: string;
  availableAmount: string;
  balance: string;
  estimatedTradeFee: string;
  margin: string;
  marginRatio: string;
  positionLossGain: string;
  totalSwap: string;
  transferableAmount: string;
}
export type FxAssetResp = ApiEnvelope<FxAsset>;

/** Orders common */
export interface FxActiveOrder {
  rootOrderId: number;
  clientOrderId?: string;
  orderId: number;
  symbol: string; // e.g., "USD_JPY"
  side: Side;
  orderType: 'NORMAL' | 'IFD' | 'OCO' | 'IFDOCO';
  executionType: ExecType;
  settleType: SettleType;
  size: string;
  price?: string;
  status: 'WAITING' | 'ORDERED' | 'MODIFYING' | 'EXECUTED' | 'EXPIRED';
  cancelType?: 'PRICE_BOUND' | 'OCO';
  expiry?: string; // yyyymmdd
  timestamp: string;
}

export interface FxExecution {
  executionId: string;
  orderId: string;
  symbol: string;
  side: Side;
  price: string;
  size: string;
  timestamp: string;
}

export interface FxPositionSummary {
  symbol: string;
  side: Side;
  size: string;
  price: string;
}

export type FxActiveOrdersResp = ApiEnvelope<FxActiveOrder[]>;
export type FxExecutionsResp = ApiEnvelope<FxExecution[]>;
export type FxLatestExecsResp = ApiEnvelope<FxExecution[]>;

/** Positions */
export interface FxOpenPosition {
  positionId: number;
  symbol: string;
  side: Side;
  size: string;
  price: string;
}
export type FxOpenPositionsResp = ApiEnvelope<FxOpenPosition[]>;
export type FxPositionSummaryResp = ApiEnvelope<FxPositionSummary[]>;

/** Place orders */
export interface FxOrderReq {
  symbol: string;
  side: Side;
  size: string;
  clientOrderId?: string;
  executionType: ExecType;
  limitPrice?: string; // required for LIMIT
  stopPrice?: string; // required for STOP
  oco?: { limitPrice: string; stopPrice: string }; // required for OCO
  expireDate?: string; // optional yyyymmdd
  settleType?: SettleType; // default OPEN
}
export type FxOrderResp = ApiEnvelope<FxActiveOrder[]>;

export interface FxSpeedOrderReq {
  symbol: string;
  side: Side;
  clientOrderId?: string;
  size: string;
  upperBound?: string; // BUY protective max
  lowerBound?: string; // SELL protective min
  isHedgeable?: boolean;
}
export type FxSpeedOrderResp = ApiEnvelope<FxActiveOrder[]>;

export interface FxIfdOrderReq {
  symbol: string;
  clientOrderId?: string;
  firstSide: Side;
  firstExecutionType: ExecType;
  firstSize: string;
  firstPrice?: string;
  firstStopPrice?: string;
  secondExecutionType: ExecType;
  secondSize: string;
  secondPrice?: string;
  secondStopPrice?: string;
}
export type FxIfdOrderResp = ApiEnvelope<FxActiveOrder[]>;

export interface FxIfdocoOrderReq {
  symbol: string;
  clientOrderId?: string;
  firstSide: Side;
  firstExecutionType: ExecType;
  firstSize: string;
  firstPrice?: string;
  firstStopPrice?: string;
  // OCO leg (second): limit/stop pair
  secondExecutionType: 'LIMIT' | 'STOP'; // overall OCO requires two prices below
  secondLimitPrice?: string;
  secondStopPrice?: string;
  secondSize: string;
}
export type FxIfdocoOrderResp = ApiEnvelope<FxActiveOrder[]>;

export interface FxChangeOrderReq {
  orderId?: number;
  clientOrderId?: string;
  price?: string;
}
export type FxChangeOrderResp = ApiEnvelope<FxActiveOrder[]>;

export interface FxChangeIfdReq {
  rootOrderId?: number;
  clientOrderId?: string;
  firstPrice?: string;
  secondPrice?: string;
}
export interface FxChangeIfdocoReq {
  rootOrderId?: number;
  clientOrderId?: string;
  firstPrice?: string;
  secondLimitPrice?: string;
  secondStopPrice?: string;
}
export type FxChangeIfdResp = ApiEnvelope<FxActiveOrder[]>;
export type FxChangeIfdocoResp = ApiEnvelope<FxActiveOrder[]>;

export interface FxCancelOrdersReq { rootOrderIds: number[]; }
export type FxCancelOrdersResp = ApiEnvelope<FxActiveOrder[]>;

export interface FxCancelBulkReq {
  symbols?: string[];
  side?: Side;
  settleType?: SettleType;
}
export type FxCancelBulkResp = ApiEnvelope<null>;

export interface FxCloseOrderReq {
  symbol: string;
  side: Side;
  clientOrderId?: string;
  executionType: ExecType;
  limitPrice?: string;
  stopPrice?: string;
  settlePosition: { positionId: number; size: string }[];
}
export type FxCloseOrderResp = ApiEnvelope<FxActiveOrder[]>;

/** WS auth lifecycle */
export type FxCreateWsTokenResp = ApiEnvelope<{ token: string; expireAt: string }>;

/** ========== CRYPTO API TYPES ========== */

/** Crypto specific types */
export interface CryptoAsset {
  symbol: string;
  amount: string;
  available: string;
}
export type CryptoAssetsResp = ApiEnvelope<CryptoAsset[]>;

/** Crypto Order types */
export interface CryptoOrderReq {
  symbol: string;
  side: Side; // 'BUY' | 'SELL'
  executionType: 'MARKET' | 'LIMIT' | 'STOP';
  size: string;
  price?: string; // required for LIMIT
  losscutPrice?: string; // for STOP/OCO
  timeInForce?: 'FAK' | 'GTC'; // default FAK for market, GTC for limit
}
export type CryptoOrderResp = ApiEnvelope<{ rootOrderId: string }>;

/** Crypto OCO Order types */
export interface CryptoOcoOrderReq {
  symbol: string;
  side: Side; // 'BUY' | 'SELL'
  size: string;
  limitPrice: string; // Limit order price
  stopPrice: string; // Stop order price (losscut)
  clientOrderId?: string;
  timeInForce?: 'FAK' | 'GTC';
}
export type CryptoOcoOrderResp = ApiEnvelope<{ rootOrderId: string }>;

/** Crypto IFD (If-Done) Order types */
export interface CryptoIfdOrderReq {
  symbol: string;
  clientOrderId?: string;
  // First leg
  firstSide: Side;
  firstExecutionType: 'MARKET' | 'LIMIT' | 'STOP';
  firstSize: string;
  firstPrice?: string; // required for LIMIT
  firstStopPrice?: string; // required for STOP
  // Second leg
  secondExecutionType: 'MARKET' | 'LIMIT' | 'STOP';
  secondSize: string;
  secondPrice?: string; // required for LIMIT
  secondStopPrice?: string; // required for STOP
  timeInForce?: 'FAK' | 'GTC';
}
export type CryptoIfdOrderResp = ApiEnvelope<{ rootOrderId: string }>;

/** Crypto IFDOCO (If-Done with OCO) Order types */
export interface CryptoIfdocoOrderReq {
  symbol: string;
  clientOrderId?: string;
  // First leg (entry order)
  firstSide: Side;
  firstExecutionType: 'MARKET' | 'LIMIT' | 'STOP';
  firstSize: string;
  firstPrice?: string; // required for LIMIT
  firstStopPrice?: string; // required for STOP
  // Second leg (OCO: exit with limit and stop)
  secondLimitPrice: string; // Limit order for profit-taking
  secondStopPrice: string; // Stop order for risk management (losscut)
  secondSize: string;
  timeInForce?: 'FAK' | 'GTC';
}
export type CryptoIfdocoOrderResp = ApiEnvelope<{ rootOrderId: string }>;

/** Crypto Open Positions */
export interface CryptoOpenPosition {
  symbol: string;
  sumSize: string;
  avgPrice: string;
  sumPrice: string;
  side?: Side;
}
export type CryptoOpenPositionsResp = ApiEnvelope<CryptoOpenPosition[]>;

/** Crypto Active Orders */
export interface CryptoActiveOrder {
  rootOrderId: string;
  orderId: string;
  symbol: string;
  side: Side;
  executionType: 'MARKET' | 'LIMIT' | 'STOP';
  size: string;
  price?: string;
  losscutPrice?: string;
  status: 'WAITING' | 'ORDERED' | 'EXECUTED' | 'EXPIRED';
  timestamp: string;
}
export type CryptoActiveOrdersResp = ApiEnvelope<CryptoActiveOrder[]>;

/** Crypto Executions */
export interface CryptoExecution {
  executionId: string;
  orderId: string;
  symbol: string;
  side: Side;
  executedPrice: string;
  executedSize: string;
  timestamp: string;
}
export type CryptoExecutionsResp = ApiEnvelope<CryptoExecution[]>;

/** Crypto Cancel Order */
export interface CryptoCancelOrderReq {
  orderId: string;
}
export type CryptoCancelOrderResp = ApiEnvelope<{ orderId: string }>;

/** Crypto Latest Executions */
export type CryptoLatestExecutionsResp = ApiEnvelope<CryptoExecution[]>;

/** Crypto Position Summary */
export interface CryptoPositionSummary {
  symbol: string;
  side: Side;
  size: string;
  price: string;
}
export type CryptoPositionSummaryResp = ApiEnvelope<CryptoPositionSummary[]>;

/** Crypto Change Order */
export interface CryptoChangeOrderReq {
  orderId: string;
  price?: string;
  losscutPrice?: string;
}
export type CryptoChangeOrderResp = ApiEnvelope<CryptoActiveOrder>;

/** Crypto Change OCO Order */
export interface CryptoChangeOcoOrderReq {
  rootOrderId: string;
  limitPrice?: string;
  stopPrice?: string;
}
export type CryptoChangeOcoOrderResp = ApiEnvelope<CryptoActiveOrder[]>;

/** Crypto Change IFD Order */
export interface CryptoChangeIfdOrderReq {
  rootOrderId: string;
  firstPrice?: string;
  firstStopPrice?: string;
  secondPrice?: string;
  secondStopPrice?: string;
}
export type CryptoChangeIfdOrderResp = ApiEnvelope<CryptoActiveOrder[]>;

/** Crypto Change IFDOCO Order */
export interface CryptoChangeIfdocoOrderReq {
  rootOrderId: string;
  firstPrice?: string;
  firstStopPrice?: string;
  secondLimitPrice?: string;
  secondStopPrice?: string;
}
export type CryptoChangeIfdocoOrderResp = ApiEnvelope<CryptoActiveOrder[]>;

/** Crypto Cancel Multiple Orders */
export interface CryptoCancelOrdersReq { 
  rootOrderIds: string[]; 
}
export type CryptoCancelOrdersResp = ApiEnvelope<CryptoActiveOrder[]>;

/** Crypto Cancel Bulk Orders */
export interface CryptoCancelBulkReq {
  symbols?: string[];
  side?: Side;
  settleType?: 'OPEN' | 'CLOSE';
}
export type CryptoCancelBulkResp = ApiEnvelope<null>;

/** ======= PUBLIC API ======= */

/** Ticker Information */
export interface Ticker {
  symbol: string;
  bid: string;           // Best bid price
  ask: string;           // Best ask price
  high: string;          // 24h high
  low: string;           // 24h low
  volume: string;        // 24h volume
  timestamp: string;     // ISO8601
}
export type TickerResp = ApiEnvelope<Ticker>;
export type AllTickersResp = ApiEnvelope<Ticker[]>;

/** Order Book (Depth) */
export interface OrderBook {
  symbol: string;
  bids: Array<[string, string]>;  // [price, size]
  asks: Array<[string, string]>;  // [price, size]
  timestamp: string;
}
export type OrderBookResp = ApiEnvelope<OrderBook>;

/** Trade (Public Trade) */
export interface Trade {
  tradeId: string;
  symbol: string;
  side: Side;
  price: string;
  size: string;
  timestamp: string;
}
export type TradesResp = ApiEnvelope<Trade[]>;

/** Candlestick (OHLCV) */
export interface Candle {
  openTime: number;      // Unix timestamp (ms)
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}
export type KlinesResp = ApiEnvelope<Candle[]>;

/** ======= PAGINATION ======= */

/**
 * Unified pagination options supporting both cursor-based (prevId) and offset-based (offset/limit) approaches
 * - For cursor-based: use `prevId` and `count`
 * - For offset-based: use `offset` and `limit`
 * - `pageSize` is legacy Crypto API parameter (maps to limit)
 */
export interface PaginationOptions {
  /** Cursor-based pagination: previous ID (FX API) */
  prevId?: string;

  /** Offset-based pagination: number of records to skip */
  offset?: string;

  /** Number of records to fetch (replaces pageSize) */
  limit?: string;

  /** Legacy Crypto API parameter (deprecated, use limit) */
  pageSize?: string;

  /** Number of records to fetch for cursor-based pagination (FX API) */
  count?: string;
}

/**
 * Helper to normalize pagination options for API calls
 * Converts unified options to API-specific parameters
 */
export interface NormalizedPaginationParams {
  [key: string]: string | undefined;
}

