// Vercel Serverless Function Proxy for Monobank API with SSRF protection

export default async function handler(req: any, res: any) {
  // 1. Strict HTTP Method validation (Monobank Personal API only uses GET)
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed. Only GET is permitted.' });
  }

  // 2. Token validation
  const token = req.headers['x-token'] || req.headers['X-Token'];
  if (!token || typeof token !== 'string') {
    return res.status(401).json({ error: 'Missing or invalid X-Token header.' });
  }

  // 3. Extract and sanitize target subpath
  // URL may be /api/mono-proxy?path=/client-info or /api/monobank/client-info
  const rawPath: string = req.query?.path || req.url?.replace(/^\/api\/monobank/, '')?.replace(/^\/api\/mono-proxy/, '') || '';
  const cleanPath = rawPath.split('?')[0].trim();

  // 4. Strict Whitelist against SSRF
  // Allowed: /client-info OR /statement/{account}/{from}/{to}
  const isClientInfo = cleanPath === '/client-info' || cleanPath === 'client-info';
  const isStatement = /^\/?statement\/[a-zA-Z0-9_-]+\/\d+\/\d+$/.test(cleanPath);

  if (!isClientInfo && !isStatement) {
    return res.status(403).json({
      error: 'Forbidden. Requested endpoint is not in the allowed Monobank Personal API whitelist.',
    });
  }

  const normalizedPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  const targetUrl = `https://api.monobank.ua/personal${normalizedPath}`;

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'X-Token': token.trim(),
        'Accept': 'application/json',
      },
    });

    const data = await upstreamRes.text();
    const contentType = upstreamRes.headers.get('content-type') || 'application/json';

    res.status(upstreamRes.status);
    res.setHeader('Content-Type', contentType);

    // Forward Retry-After if 429
    const retryAfter = upstreamRes.headers.get('retry-after');
    if (retryAfter) {
      res.setHeader('Retry-After', retryAfter);
    }

    return res.send(data);
  } catch (err: any) {
    return res.status(502).json({
      error: 'Bad Gateway: Failed to reach Monobank API upstream.',
      details: err.message,
    });
  }
}
