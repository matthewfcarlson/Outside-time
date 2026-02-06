import type { Env } from './types';
import { handleAppend } from './handlers/append';
import { handleRead } from './handlers/read';
import { handleHead } from './handlers/head';
import { handleOptions, corsHeaders } from './middleware/cors';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return handleOptions();
    }

    // Route: /api/log/:publicKey
    const logMatch = url.pathname.match(/^\/api\/log\/([0-9a-f]{64})$/);
    if (logMatch) {
      const publicKey = logMatch[1];

      switch (method) {
        case 'POST':
          return handleAppend(request, env, publicKey);
        case 'GET':
          return handleRead(request, env, publicKey);
        case 'HEAD':
          return handleHead(env, publicKey);
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
