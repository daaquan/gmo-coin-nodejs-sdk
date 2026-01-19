/**
 * Audit logging utilities for REST API requests and responses
 * Provides request/response logging with PII masking
 */

export interface AuditLogEntry {
  timestamp: string;
  method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH';
  path: string;
  statusCode: number;
  duration: number; // milliseconds
  requestHeaders?: Record<string, string>;
  requestBody?: unknown;
  responseStatus?: number;
  responseData?: unknown;
  error?: string;
  userId?: string;
}

export interface AuditLoggerConfig {
  logHeaders?: boolean;
  logRequestBody?: boolean;
  logResponseData?: boolean;
  piiPatterns?: RegExp[];
  logger?: (entry: AuditLogEntry) => void;
  includeStackTrace?: boolean;
}

const DEFAULT_PII_PATTERNS = [
  /api[_-]?key/gi,
  /secret/gi,
  /token/gi,
  /password/gi,
  /authorization/gi,
  /bearer/gi,
  /private/gi,
  /x-api-/gi,
  /x-auth-/gi,
];

function maskValue(value: unknown, patterns: RegExp[] = DEFAULT_PII_PATTERNS): unknown {
  if (typeof value === 'string') {
    for (const pattern of patterns) {
      if (pattern.test(value)) return '***MASKED***';
    }
    return value;
  }
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) return value.map((item) => maskValue(item, patterns));
    const masked: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const shouldMask = patterns.some((p) => p.test(key));
      masked[key] = shouldMask ? '***MASKED***' : maskValue(val, patterns);
    }
    return masked;
  }
  return value;
}

function maskHeaders(
  headers: Record<string, string | undefined>,
  patterns: RegExp[] = DEFAULT_PII_PATTERNS,
): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!value) continue;
    masked[key] = patterns.some((p) => p.test(key)) ? '***MASKED***' : value;
  }
  return masked;
}

export class AuditLogger {
  private config: Required<AuditLoggerConfig>;

  constructor(config?: AuditLoggerConfig) {
    this.config = {
      logHeaders: config?.logHeaders ?? true,
      logRequestBody: config?.logRequestBody ?? true,
      logResponseData: config?.logResponseData ?? false,
      piiPatterns: config?.piiPatterns ?? DEFAULT_PII_PATTERNS,
      logger: config?.logger ?? ((entry) => console.log(JSON.stringify(entry))),
      includeStackTrace: config?.includeStackTrace ?? true,
    };
  }

  log(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    options?: {
      headers?: Record<string, string | undefined>;
      requestBody?: unknown;
      responseData?: unknown;
      error?: Error | string;
      userId?: string;
    },
  ): void {
    const logEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      method: method.toUpperCase() as AuditLogEntry['method'],
      path,
      statusCode,
      duration,
    };

    if (options?.userId) logEntry.userId = options.userId;
    if (this.config.logHeaders && options?.headers) {
      logEntry.requestHeaders = maskHeaders(options.headers, this.config.piiPatterns);
    }
    if (this.config.logRequestBody && options?.requestBody) {
      logEntry.requestBody = maskValue(options.requestBody, this.config.piiPatterns);
    }
    if (this.config.logResponseData && options?.responseData) {
      logEntry.responseData = maskValue(options.responseData, this.config.piiPatterns);
    }
    if (options?.error) {
      const errorVal = options.error instanceof Error
        ? (this.config.includeStackTrace ? options.error.stack : options.error.message)
        : String(options.error);
      if (errorVal) logEntry.error = errorVal;
    }

    this.config.logger(logEntry);
  }
}

export const auditLogger = new AuditLogger({
  logHeaders: true,
  logRequestBody: true,
  logResponseData: false,
  logger: (entry) => {
    const level = entry.error ? 'ERROR' : entry.statusCode >= 400 ? 'WARN' : 'INFO';
    console.log(`[AUDIT:${level}] ${entry.method} ${entry.path} - ${entry.statusCode} (${entry.duration}ms)`);
  },
});