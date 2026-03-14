export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({
        ok: true,
        service: 'immortal-pyramid',
        timestamp: new Date().toISOString(),
      });
    }

    // Let Cloudflare Assets serve files from ./public
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    // Placeholder scheduled handler to keep cron trigger valid.
    console.log('Scheduled cleanup tick:', event.cron);
  },
};
