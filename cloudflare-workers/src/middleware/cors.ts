const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Signature',
  'Access-Control-Expose-Headers': 'X-Event-Count, X-Latest-Seq',
  'Access-Control-Max-Age': '86400',
};

export function corsHeaders(): Record<string, string> {
  return { ...CORS_HEADERS };
}

export function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
