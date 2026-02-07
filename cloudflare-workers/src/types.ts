export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  WRITE_LIMITER?: RateLimiter;
  READ_LIMITER?: RateLimiter;
  IP_LIMITER?: RateLimiter;
}

export interface EventRow {
  public_key: string;
  seq: number;
  ciphertext: string; // base64-encoded when returned via JSON
  created_at: number;
}

export interface AppendRequest {
  ciphertext: string; // base64-encoded sealed box
}

export interface LogResponse {
  events: Array<{
    seq: number;
    ciphertext: string; // base64
    created_at: number;
  }>;
  has_more: boolean;
}

export interface AppendResponse {
  seq: number;
  created_at: number;
}

export interface ErrorResponse {
  error: string;
}
