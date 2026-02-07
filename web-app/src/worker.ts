export interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Handle API routes
    if (url.pathname.startsWith("/api/")) {
      return new Response("Not Found", { status: 404 });
    }

    // All other requests are handled by the assets binding (static files / SPA fallback)
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
