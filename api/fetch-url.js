export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  let url;
  try {
    ({ url } = await req.json());
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  if (!url || !/^https?:\/\//.test(url)) {
    return new Response(JSON.stringify({ error: '请输入有效的 http/https 链接' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ExamTracker/1.0)',
        'Accept': 'text/html,text/plain,*/*',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `HTTP ${res.status}` }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }

    const ct = res.headers.get('content-type') || '';
    const raw = await res.text();
    let text;

    if (ct.includes('text/html')) {
      text = raw
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    } else {
      text = raw.trim();
    }

    // Limit to keep within model context
    text = text.slice(0, 30000);

    return new Response(JSON.stringify({ text }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }
}
