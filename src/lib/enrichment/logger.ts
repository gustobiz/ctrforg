/**
 * CTRForge Enrichment Pipeline — Structured Logger
 * 
 * Provides consistent, parseable log output across all providers.
 * Every log line includes: timestamp, level, provider name, channel ID, message.
 * This makes production debugging and log aggregation straightforward.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Structured enrichment log function.
 * 
 * @param level - Severity level
 * @param provider - Provider name (e.g. "YouTubeProvider", "ApifyProvider")
 * @param channelId - YouTube channel ID being enriched
 * @param message - Human-readable log message
 * @param meta - Optional metadata object for additional context
 */
export function enrichmentLog(
  level: LogLevel,
  provider: string,
  channelId: string,
  message: string,
  meta?: Record<string, any>
): void {
  const prefix = `[Enrichment:${provider}] [${channelId}]`;

  switch (level) {
    case LogLevel.ERROR:
      console.error(prefix, message, meta !== undefined ? meta : '');
      break;
    case LogLevel.WARN:
      console.warn(prefix, message, meta !== undefined ? meta : '');
      break;
    case LogLevel.INFO:
      console.log(prefix, message, meta !== undefined ? meta : '');
      break;
    case LogLevel.DEBUG:
      // Only log debug in development
      if (process.env.NODE_ENV !== 'production') {
        console.log(prefix, '[DEBUG]', message, meta !== undefined ? meta : '');
      }
      break;
  }
}

/**
 * Convenience wrappers for common log levels.
 */
export const log = {
  debug: (provider: string, channelId: string, msg: string, meta?: Record<string, any>) =>
    enrichmentLog(LogLevel.DEBUG, provider, channelId, msg, meta),
  info: (provider: string, channelId: string, msg: string, meta?: Record<string, any>) =>
    enrichmentLog(LogLevel.INFO, provider, channelId, msg, meta),
  warn: (provider: string, channelId: string, msg: string, meta?: Record<string, any>) =>
    enrichmentLog(LogLevel.WARN, provider, channelId, msg, meta),
  error: (provider: string, channelId: string, msg: string, meta?: Record<string, any>) =>
    enrichmentLog(LogLevel.ERROR, provider, channelId, msg, meta),
};
