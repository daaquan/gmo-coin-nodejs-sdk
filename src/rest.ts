import { buildHeaders } from './auth.js';
import { getGate, postGate } from './rateLimiter.js';
import type * as T from './types.js';

interface ErrorResponse {
  status?: number;
  code?: string;
  message?: string;
  data?: {
    code?: string;
    message?: string;
  };
}

const BASE = 'https://forex-api.coin.z.com/private';
const V = '/v1';

function ensureExecFields(execType: T.ExecType, body: { limitPrice?: string; stopPrice?: string; oco?: { limitPrice: string; stopPrice: string } }) {
  if (execType === 'LIMIT' && !body.limitPrice) throw new Error('LIMIT requires limitPrice');
  if (execType === 'STOP' && !body.stopPrice) throw new Error('STOP requires stopPrice');
  if (execType === 'OCO' && (!body.oco?.limitPrice || !body.oco?.stopPrice)) throw new Error('OCO requires oco.limitPrice and oco.stopPrice');
}

async function parseJson(res: Response) {
  let json: Record<string, unknown> | undefined;
  try { json = await res.json(); } catch { json = undefined; }
  return json;
}

function errText(method: string, path: string, res: Response, json: Record<string, unknown> | undefined) {
  const statusLine = `${res.status} ${res.statusText}`;
  const err = json as ErrorResponse | undefined;
  const code = err?.data?.code || err?.code || err?.status;
  const msg = err?.data?.message || err?.message || '';
  return `${method} ${path} failed: ${statusLine} code=${code ?? 'n/a'} msg=${msg || JSON.stringify(json)}`;
}

export class FxPrivateRestClient {
  constructor(private apiKey: string, private secret: string, private baseUrl = BASE) {
    if (!apiKey || !secret) {
      throw new Error('FxPrivateRestClient: Missing API credentials. Set FX_API_KEY and FX_API_SECRET.');
    }
  }

  private async _get<TResp>(path: string, qs?: Record<string, string | undefined>): Promise<TResp> {
    await getGate.wait();
    const url = new URL(this.baseUrl + path);
    if (qs) for (const [k, v] of Object.entries(qs)) if (v != null) url.searchParams.set(k, v);
    const headers = buildHeaders(this.apiKey, this.secret, 'GET', path, '');
    const res = await fetch(url, { headers });
    const json = await parseJson(res);
    if (!res.ok || json?.status !== 0) throw new Error(errText('GET', path, res, json));
    return json as TResp;
  }

  private async _post<TResp>(path: string, body: unknown): Promise<TResp> {
    await postGate.wait();
    const payload = JSON.stringify(body ?? {});
    const headers = buildHeaders(this.apiKey, this.secret, 'POST', path, payload);
    const res = await fetch(this.baseUrl + path, { method: 'POST', headers, body: payload });
    const json = await parseJson(res);
    if (!res.ok || json?.status !== 0) throw new Error(errText('POST', path, res, json));
    return json as TResp;
  }

  /** ====== ACCOUNT ====== */
  getAssets() {
    return this._get<T.AssetsResp>(`${V}/account/assets`);
  }

  /** ====== QUERIES ====== */
  getActiveOrders(q?: { symbol?: string; prevId?: string; count?: string }) {
    return this._get<T.ActiveOrdersResp>(`${V}/activeOrders`, q);
  }
  getExecutions(q: { executionId: string }) {
    return this._get<T.ExecutionsResp>(`${V}/executions`, q);
  }
  getLatestExecutions(q: { symbol: string; count?: string }) {
    return this._get<T.LatestExecsResp>(`${V}/latestExecutions`, q);
  }
  getOpenPositions(q?: { symbol?: string; prevId?: string; count?: string }) {
    return this._get<T.OpenPositionsResp>(`${V}/openPositions`, q);
  }
  getPositionSummary(q?: { symbol?: string }) {
    return this._get<T.PositionSummaryResp>(`${V}/positionSummary`, q);
  }

  /** ====== ORDERS ====== */
  speedOrder(body: T.SpeedOrderReq) {
    return this._post<T.SpeedOrderResp>(`${V}/speedOrder`, body);
  }
  placeOrder(body: T.OrderReq) {
    ensureExecFields(body.executionType, body);
    if (body.executionType === 'LIMIT' && !body.limitPrice) throw new Error('LIMIT order requires limitPrice');
    if (body.executionType === 'STOP' && !body.stopPrice) throw new Error('STOP order requires stopPrice');
    if (body.executionType === 'OCO' && (!body.oco?.limitPrice || !body.oco?.stopPrice)) throw new Error('OCO order requires oco.limitPrice and oco.stopPrice');
    return this._post<T.OrderResp>(`${V}/order`, body);
  }
  placeIfdOrder(body: T.IfdOrderReq) {
    ensureExecFields(body.firstExecutionType, { limitPrice: body.firstPrice, stopPrice: body.firstStopPrice });
    ensureExecFields(body.secondExecutionType, { limitPrice: body.secondPrice, stopPrice: body.secondStopPrice });
    return this._post<T.IfdOrderResp>(`${V}/ifdOrder`, body);
  }
  placeIfdocoOrder(body: T.IfdocoOrderReq) {
    ensureExecFields(body.firstExecutionType, { limitPrice: body.firstPrice, stopPrice: body.firstStopPrice });
    // OCO requires two prices (limit + stop)
    if (!body.secondLimitPrice || !body.secondStopPrice) throw new Error('IFDOCO requires secondLimitPrice and secondStopPrice');
    return this._post<T.IfdocoOrderResp>(`${V}/ifoOrder`, body);
  }
  changeOrder(body: T.ChangeOrderReq) {
    return this._post<T.ChangeOrderResp>(`${V}/changeOrder`, body);
  }
  changeIfdOrder(body: T.ChangeIfdReq) {
    return this._post<T.ChangeIfdResp>(`${V}/changeIfdOrder`, body);
  }
  changeIfdocoOrder(body: T.ChangeIfdocoReq) {
    return this._post<T.ChangeIfdocoResp>(`${V}/changeIfoOrder`, body);
  }
  cancelOrders(body: T.CancelOrdersReq) {
    return this._post<T.CancelOrdersResp>(`${V}/cancelOrders`, body);
  }
  cancelBulk(body: T.CancelBulkReq) {
    return this._post<T.CancelBulkResp>(`${V}/cancelBulkOrder`, body);
  }
  closeOrder(body: T.CloseOrderReq) {
    if (!body.settlePosition?.length) throw new Error('closeOrder requires at least one settlePosition');
    ensureExecFields(body.executionType, { limitPrice: body.limitPrice, stopPrice: body.stopPrice });
    return this._post<T.CloseOrderResp>(`${V}/closeOrder`, body);
  }
}
