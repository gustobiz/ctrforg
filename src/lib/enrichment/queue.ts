/**
 * CTRForge Enrichment Pipeline — Background Batching Queue
 * 
 * Enqueues background enrichment tasks for batch processing.
 * Concurrency is limited to respect third-party rate limits (Apify, Google Search).
 */

import { EnrichmentContext } from './types';
import { enrichmentLog, LogLevel } from './logger';

export interface QueueTask {
  ctx: EnrichmentContext;
  enrichFn: (ctx: EnrichmentContext) => Promise<any>;
}

const DEFAULT_CONCURRENCY = 3;

export class EnrichmentQueue {
  private queue: QueueTask[] = [];
  private activeCount = 0;
  private concurrency: number;

  constructor(concurrency = DEFAULT_CONCURRENCY) {
    this.concurrency = concurrency;
  }

  /**
   * Add a task to the queue and trigger execution.
   */
  push(ctx: EnrichmentContext, enrichFn: (ctx: EnrichmentContext) => Promise<any>): void {
    this.queue.push({ ctx, enrichFn });
    enrichmentLog(LogLevel.DEBUG, 'Queue', ctx.channelId, `Task added to queue. Current queue length: ${this.queue.length}`);
    this.processNext();
  }

  /**
   * Push a batch of contexts with an enrichment runner function.
   */
  pushBatch(contexts: EnrichmentContext[], enrichFn: (ctx: EnrichmentContext) => Promise<any>): void {
    for (const ctx of contexts) {
      this.push(ctx, enrichFn);
    }
  }

  /**
   * Process next tasks up to the concurrency limit.
   */
  private processNext(): void {
    if (this.activeCount >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.activeCount++;
    const { ctx, enrichFn } = task;

    enrichmentLog(LogLevel.DEBUG, 'Queue', ctx.channelId, `Starting processing (active tasks: ${this.activeCount}/${this.concurrency})`);

    // Execute task
    enrichFn(ctx)
      .catch((err: any) => {
        enrichmentLog(LogLevel.ERROR, 'Queue', ctx.channelId, `Task execution failed: ${err.message}`);
      })
      .finally(() => {
        this.activeCount--;
        enrichmentLog(LogLevel.DEBUG, 'Queue', ctx.channelId, `Finished processing (active tasks: ${this.activeCount}/${this.concurrency})`);
        this.processNext();
      });

    // Recursively attempt to fill available concurrency slots
    this.processNext();
  }

  /**
   * Get queue status.
   */
  getStatus(): { queueLength: number; activeTasks: number } {
    return {
      queueLength: this.queue.length,
      activeTasks: this.activeCount,
    };
  }
}

// Global background queue instance for the app lifecycle
export const backgroundEnrichmentQueue = new EnrichmentQueue(DEFAULT_CONCURRENCY);
