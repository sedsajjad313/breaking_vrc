export const config = { runtime: 'edge' };

const TARGET = (process.env.TARGET_DOMAIN || '').replace(/\/$/, '');

const HOP = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'forwarded'
]);

function cloneHeaders(headers) {
  const out = new Headers();
  for (const [k, v] of headers.entries()) {
    if (HOP.has(k.toLowerCase())) continue;
    if (k.toLowerCase().startsWith('x-vercel-')) continue;
    out.set(k, v);
  }
  return out;
}

export default async function handler(req) {
  if (!TARGET) {
    return new Response('TARGET_DOMAIN missing', { status: 500 });
  }

  try {
    const url = new URL(req.url);
    const upstream = TARGET + url.pathname + url.search;

    const controller = new AbortController();

    const resp = await fetch(upstream, {
      method: req.method,
      headers: cloneHeaders(req.headers),
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
      duplex: 'half',
      redirect: 'manual',
      signal: controller.signal
    });

    const responseHeaders = new Headers(resp.headers);
    responseHeaders.set('access-control-allow-origin', '*');
    responseHeaders.set('cache-control', 'no-store');

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: responseHeaders
    });

  } catch (e) {
    console.error('edge tunnel fail:', e);
    return new Response('Tunnel Failed', { status: 502 });
  }
}
