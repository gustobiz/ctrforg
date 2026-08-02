/**
 * CTRForge Enrichment Pipeline — Retry with Jitter
 * 
 * Reusable retry utility with exponential backoff and random jitter.
 * Prevents thundering herd on rate-limited APIs (e.g. Apify 429s).
 * 
 * Special handling:
 * - 401 (Invalid token): Fail immediately, no retry
 * - 429 (Rate limit): Extra backoff multiplier before retry
 * - Timeout errors: Normal retry with backoff
 */

export interface RetryOptions {
  maxRetries: number;      // How many times to retry after first failure
  baseDelayMs: number;     // Base delay in ms (doubled each retry)
  label: string;           // Human-readable label for log messages
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  label: 'Unknown',
};

/**
 * Execute an async function with automatic retries on failure.
 * Uses exponential backoff with random jitter to prevent
 * multiple concurrent retries from hitting APIs simultaneously.
 * 
 * @param fn - The async function to execute
 * @param opts - Retry configuration
 * @returns The result of the function
 * @throws The last error if all retries are exhausted
 * 
 * @example
 * ```ts
 * const data = await retryWithJitter(
 *   () => fetch('https://api.example.com/data').then(r => r.json()),
 *   { maxRetries: 3, baseDelayMs: 1000, label: 'ExampleAPI' }
 * );
 * ```
 */
export async function retryWithJitter<T>(
  fn: () => Promise<T>,
  opts?: Partial<RetryOptions>
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...opts };
  let lastError: any;

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const errorMessage = err.message || String(err);

      // Immediately fail on authentication errors — no point retrying
      if (errorMessage.includes('401') || errorMessage.includes('Invalid') && errorMessage.includes('token')) {
        throw err;
      }

      // If we've exhausted all retries, break out
      if (attempt > config.maxRetries) {
        break;
      }

      // Calculate delay: exponential backoff + random jitter
      const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 500;
      let delay = exponentialDelay + jitter;

      // Rate-limited responses get extra backoff
      if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
        delay *= 2;
        console.warn(`[Retry:${config.label}] Rate limited on attempt ${attempt}. Extended backoff: ${Math.round(delay)}ms`);
      } else {
        console.warn(`[Retry:${config.label}] Attempt ${attempt}/${config.maxRetries + 1} failed. Retrying in ${Math.round(delay)}ms: ${errorMessage}`);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Safe version of retryWithJitter that never throws.
 * Returns null on failure instead of throwing.
 * Used by providers that should never stop the pipeline on failure.
 * 
 * @param fn - The async function to execute
 * @param opts - Retry configuration
 * @returns The result, or null if all retries failed
 */
export async function retryWithJitterSafe<T>(
  fn: () => Promise<T>,
  opts?: Partial<RetryOptions>
): Promise<T | null> {
  try {
    return await retryWithJitter(fn, opts);
  } catch {
    return null;
  }
}
