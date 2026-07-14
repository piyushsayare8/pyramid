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

    if (url.pathname === '/active-link.json') {
      try {
        const res = await fetch('https://pub-962497bf5b824ce986c4e28eb92fd400.r2.dev/active-link.json');
        if (res.ok) {
          const data = await res.json();
          return Response.json(data, {
            headers: {
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
        
        // Fallback to local R2 Bucket if remote fetch fails
        const object = await env.BUCKET.get('active-link.json');
        if (object === null) {
          return new Response('Not Found', { status: 404 });
        }
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Content-Type', 'application/json');
        headers.set('Access-Control-Allow-Origin', '*');
        return new Response(object.body, {
          headers,
        });
      } catch (err) {
        return new Response('Error retrieving active-link.json', { status: 500 });
      }
    }

    // Let Cloudflare Assets serve files from ./public
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    // Placeholder scheduled handler to keep cron trigger valid.
    console.log('Scheduled cleanup tick:', event.cron);
  },
};
