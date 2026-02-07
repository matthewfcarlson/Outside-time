import type { RateLimiter } from '../types';
import { corsHeaders } from './cors';

/**
 * Check rate limit for a given key.
 * Returns a 429 Response if the limit is exceeded, or null if the request is allowed.
 * If no limiter is configured (e.g. in tests), the request is always allowed.
 */
export async function checkRateLimit(
  limiter: RateLimiter | undefined,
  key: string
): Promise<Response | null> {
  if (!limiter) return null;

  const { success } = await limiter.limit({ key });
  if (!success) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60',
        ...corsHeaders(),
      },
    });
  }
  return null;
}
