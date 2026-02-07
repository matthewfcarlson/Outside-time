import type { Env } from './types';
import { handleAppend } from './handlers/append';
import { handleRead } from './handlers/read';
import { handleHead } from './handlers/head';
import { handleOptions, corsHeaders } from './middleware/cors';
import { checkRateLimit } from './middleware/rateLimit';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return handleOptions();
    }

    // Per-IP rate limit (guards against public-key enumeration)
    const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const ipLimited = await checkRateLimit(env.IP_LIMITER, clientIp);
    if (ipLimited) return ipLimited;

    // Route: /api/log/:publicKey
    const logMatch = url.pathname.match(/^\/api\/log\/([0-9a-f]{64})$/);
    if (logMatch) {
      const publicKey = logMatch[1];

      switch (method) {
        case 'POST': {
          const limited = await checkRateLimit(env.WRITE_LIMITER, publicKey);
          if (limited) return limited;
          return handleAppend(request, env, publicKey);
        }
        case 'GET': {
          const limited = await checkRateLimit(env.READ_LIMITER, publicKey);
          if (limited) return limited;
          return handleRead(request, env, publicKey);
        }
        case 'HEAD': {
          const limited = await checkRateLimit(env.READ_LIMITER, publicKey);
          if (limited) return limited;
          return handleHead(env, publicKey);
        }
      }
    }

    // Health check
    if (url.pathname === '/health' && method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(),
        },
      });
    }

    // 404 for everything else
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(),
      },
    });
  },
};
