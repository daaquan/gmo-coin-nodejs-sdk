export type Side = 'BUY' | 'SELL';
export type ExecType = 'LIMIT' | 'STOP' | 'OCO';
export type SettleType = 'OPEN' | 'CLOSE';

export interface ApiEnvelope<T> {
  status: number; // 0 = success
  data: T;
  responsetime: string; // ISO8601
}

/** /v1/account/assets */
export interface Assets {
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
export type AssetsResp = ApiEnvelope<Assets>;

/** Orders common */
export interface ActiveOrder {
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

export interface Execution {
  executionId: string;
  orderId: string;
  symbol: string;
  side: Side;
  price: string;
  size: string;
  timestamp: string;
}

export interface PositionSummary {
  symbol: string;
  side: Side;
  size: string;
  price: string;
}

export type ActiveOrdersResp = ApiEnvelope<ActiveOrder[]>;
export type ExecutionsResp = ApiEnvelope<Execution[]>;
export type LatestExecsResp = ApiEnvelope<Execution[]>;

/** Positions */
export interface OpenPosition {
  positionId: number;
  symbol: string;
  side: Side;
  size: string;
  price: string;
}
export type OpenPositionsResp = ApiEnvelope<OpenPosition[]>;
export type PositionSummaryResp = ApiEnvelope<PositionSummary[]>;

/** Place orders */
export interface OrderReq {
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
export type OrderResp = ApiEnvelope<ActiveOrder[]>;

export interface SpeedOrderReq {
  symbol: string;
  side: Side;
  clientOrderId?: string;
  size: string;
  upperBound?: string; // BUY protective max
  lowerBound?: string; // SELL protective min
  isHedgeable?: boolean;
}
export type SpeedOrderResp = ApiEnvelope<ActiveOrder[]>;

export interface IfdOrderReq {
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
export type IfdOrderResp = ApiEnvelope<ActiveOrder[]>;

export interface IfdocoOrderReq {
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
export type IfdocoOrderResp = ApiEnvelope<ActiveOrder[]>;

export interface ChangeOrderReq {
  orderId?: number;
  clientOrderId?: string;
  price?: string;
}
export type ChangeOrderResp = ApiEnvelope<ActiveOrder[]>;

export interface ChangeIfdReq {
  rootOrderId?: number;
  clientOrderId?: string;
  firstPrice?: string;
  secondPrice?: string;
}
export interface ChangeIfdocoReq {
  rootOrderId?: number;
  clientOrderId?: string;
  firstPrice?: string;
  secondLimitPrice?: string;
  secondStopPrice?: string;
}
export type ChangeIfdResp = ApiEnvelope<ActiveOrder[]>;
export type ChangeIfdocoResp = ApiEnvelope<ActiveOrder[]>;

export interface CancelOrdersReq { rootOrderIds: number[]; }
export type CancelOrdersResp = ApiEnvelope<ActiveOrder[]>;

export interface CancelBulkReq {
  symbols?: string[];
  side?: Side;
  settleType?: SettleType;
}
export type CancelBulkResp = ApiEnvelope<null>;

export interface CloseOrderReq {
  symbol: string;
  side: Side;
  clientOrderId?: string;
  executionType: ExecType;
  limitPrice?: string;
  stopPrice?: string;
  settlePosition: { positionId: number; size: string }[];
}
export type CloseOrderResp = ApiEnvelope<ActiveOrder[]>;

/** WS auth lifecycle */
export type CreateWsTokenResp = ApiEnvelope<{ token: string; expireAt: string }>;

