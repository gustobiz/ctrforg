/**
 * CTRForge Enrichment Pipeline — BaseProvider Abstract Class
 * 
 * Every enrichment provider extends this class to get:
 * - Automatic cache check/save
 * - Structured logging
 * - Timing measurement
 * - Graceful error handling (never crashes the pipeline)
 * - Helper for creating EnrichmentField objects
 */

import { EnrichmentResult, EnrichmentContext, ProviderConfig, Confidence } from '../types';
import { getCached, setCache } from '../cache';
import { enrichmentLog, LogLevel } from '../logger';

export abstract class BaseProvider {
  abstract readonly name: string;
  abstract readonly config: ProviderConfig;

  /**
   * Provider-specific enrichment logic.
   * Subclasses implement this to perform their actual work.
   * Errors thrown here are caught by run() and logged gracefully.
   */
  abstract execute(ctx: EnrichmentContext): Promise<EnrichmentResult>;

  /**
   * Run the provider with caching, logging, and error handling.
   * This is the method called by ProviderManager — never call execute() directly.
   */
  async run(ctx: EnrichmentContext): Promise<EnrichmentResult> {
    // Check if provider is enabled
    if (!this.config.enabled) {
      enrichmentLog(LogLevel.DEBUG, this.name, ctx.channelId, 'Skipped (disabled)');
      return this.emptyResult(false, 'Provider disabled');
    }

    // Check provider-level cache
    const cached = getCached(this.name, ctx.channelId, this.config.cacheTtlMs);
    if (cached) {
      enrichmentLog(LogLevel.DEBUG, this.name, ctx.channelId, 'Cache hit — returning cached result');
      return cached;
    }

    // Execute with timing
    const start = Date.now();
    try {
      const result = await this.execute(ctx);
      result._durationMs = Date.now() - start;
      result._provider = this.name;
      result._success = true;

      // Cache successful results
      setCache(this.name, ctx.channelId, result);
      enrichmentLog(LogLevel.INFO, this.name, ctx.channelId, `Completed in ${result._durationMs}ms`);
      return result;
    } catch (err: any) {
      const duration = Date.now() - start;
      enrichmentLog(
        LogLevel.ERROR,
        this.name,
        ctx.channelId,
        `Failed after ${duration}ms: ${err.message}`,
        { stack: err.stack }
      );
      // Never throw — return empty failed result so pipeline continues
      return this.emptyResult(false, err.message);
    }
  }

  /**
   * Create an empty EnrichmentResult with metadata.
   */
  protected emptyResult(success = true, error?: string): EnrichmentResult {
    return {
      _provider: this.name,
      _durationMs: 0,
      _success: success,
      _error: error,
    };
  }

  /**
   * Helper to create an EnrichmentField with the provider's confidence level.
   * Returns undefined if value is falsy — this prevents null values from
   * overwriting real data during merge.
   */
  protected field(
    value: string | null | undefined,
    confidence: Confidence,
    source?: string
  ): { value: string; confidence: Confidence; source: string } | undefined {
    if (!value) return undefined;
    return {
      value,
      confidence,
      source: source || this.name,
    };
  }
}
