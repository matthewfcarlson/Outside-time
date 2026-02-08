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

    // Funny response for PHP probes
    if (url.pathname.endsWith('.php')) {
      return new Response(
        '<?php echo "Nice try! This is not a PHP site. Maybe go outside instead? 🌲"; ?>\n\n' +
        'HTTP 418 - I\'m a teapot, not a PHP server.\n' +
        'This app is built with modern web technologies.\n' +
        'No wp-admin here. No phpMyAdmin. Just fresh air and encrypted bytes.\n',
        {
          status: 418,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        },
      );
    }

    // Serve static assets / SPA fallback for everything else
    return env.ASSETS.fetch(request);
  },
};
