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
  requestHeaders?: Record<string, string>; // Already excludes undefined values
  requestBody?: unknown;
  responseStatus?: number;
  responseData?: unknown;
  error?: string;
  userId?: string; // Optional: for multi-tenant scenarios
}

export interface AuditLoggerConfig {
  /**
   * Whether to log request headers (after masking)
   * Default: true
   */
  logHeaders?: boolean;

  /**
   * Whether to log request body (after masking)
   * Default: true
   */
  logRequestBody?: boolean;

  /**
   * Whether to log response data
   * Default: false (to reduce log size)
   */
  logResponseData?: boolean;

  /**
   * Custom PII patterns to mask (regex patterns)
   * Default: includes API keys, secrets, tokens, passwords
   */
  piiPatterns?: RegExp[];

  /**
   * Custom logger function
   * Default: console.log
   */
  logger?: (entry: AuditLogEntry) => void;

  /**
   * Whether to include stack traces for errors
   * Default: true
   */
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

/**
 * Mask sensitive information from values
 */
function maskValue(value: unknown, patterns: RegExp[] = DEFAULT_PII_PATTERNS): unknown {
  if (typeof value === 'string') {
    let masked = value;
    for (const pattern of patterns) {
      // Don't expose the actual value; replace with asterisks
      if (pattern.test(masked)) {
        return '***MASKED***';
      }
    }
    return masked;
  }

  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return value.map((item) => maskValue(item, patterns));
    }
    const masked: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      // Mask by key name
      for (const pattern of patterns) {
        if (pattern.test(key)) {
          masked[key] = '***MASKED***';
          continue;
        }
      }
      if (!(key in masked)) {
        masked[key] = maskValue(val, patterns);
      }
    }
    return masked;
  }

  return value;
}

/**
 * Mask headers, removing sensitive ones
 */
function maskHeaders(
  headers: Record<string, string | undefined>,
  patterns: RegExp[] = DEFAULT_PII_PATTERNS,
): Record<string, string> {
  const masked: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (!value) continue;

    // Check if key matches any PII pattern
    const shouldMask = patterns.some((pattern) => pattern.test(key));

    if (shouldMask) {
      masked[key] = '***MASKED***';
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Audit logger for REST API operations
 */
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

  /**
   * Log an API request
   */
  logRequest(
    method: string,
    path: string,
    headers?: Record<string, string | undefined>,
    body?: unknown,
    userId?: string,
  ): { startTime: number; method: string; path: string } {
    const startTime = Date.now();

    const logEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      method: method.toUpperCase() as AuditLogEntry['method'],
      path,
      statusCode: 0, // Will be updated in logResponse
      duration: 0,
    };

    if (userId) logEntry.userId = userId;

    if (this.config.logHeaders && headers) {
      logEntry.requestHeaders = maskHeaders(headers, this.config.piiPatterns);
    }

    if (this.config.logRequestBody && body) {
      logEntry.requestBody = maskValue(body, this.config.piiPatterns);
    }

    // Log at debug level for requests
    this.config.logger(logEntry);

    return { startTime, method: method.toUpperCase(), path };
  }

  /**
   * Log an API response
   */
  logResponse(
    startTime: number,
    statusCode: number,
    responseData?: unknown,
    error?: Error | string,
  ): void {
    const duration = Date.now() - startTime;

    const logEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      method: 'GET', // Will be overridden by caller
      path: '', // Will be overridden by caller
      statusCode,
      duration,
    };

    if (this.config.logResponseData && responseData) {
      logEntry.responseData = maskValue(responseData, this.config.piiPatterns);
    }

    if (error) {
      logEntry.error =
        error instanceof Error
          ? this.config.includeStackTrace
            ? error.stack
            : error.message
          : String(error);
    }

    this.config.logger(logEntry);
  }

  /**
   * Log a complete API call
   */
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
      logEntry.error =
        options.error instanceof Error
          ? this.config.includeStackTrace
            ? options.error.stack
            : options.error.message
          : String(options.error);
    }

    this.config.logger(logEntry);
  }
}

/**
 * Global audit logger instance
 */
export const auditLogger = new AuditLogger({
  logHeaders: true,
  logRequestBody: true,
  logResponseData: false, // Disabled by default for privacy
  logger: (entry) => {
    const level = entry.error ? 'error' : entry.statusCode >= 400 ? 'warn' : 'info';
    console.log(
      `[AUDIT:${level.toUpperCase()}] ${entry.method} ${entry.path} - ${entry.statusCode} (${entry.duration}ms)`,
    );
  },
});

/**
 * Create an audit logger with custom configuration
 */
export function createAuditLogger(config?: AuditLoggerConfig): AuditLogger {
  return new AuditLogger(config);
}
