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

