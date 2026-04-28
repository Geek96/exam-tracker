async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end('Method Not Allowed'); return; }

  const body = req.body || {};
  const url = body.url;

  if (!url || !/^https?:\/\//.test(url)) {
    res.status(400).json({ error: '请输入有效的 http/https 链接' }); return;
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ExamTracker/1.0)',
        'Accept': 'text/html,text/plain,*/*',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });

    if (!upstream.ok) {
      res.status(502).json({ error: 'HTTP ' + upstream.status }); return;
    }

    const ct  = upstream.headers.get('content-type') || '';
    const raw = await upstream.text();
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

    res.json({ text: text.slice(0, 30000) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}

module.exports = handler;
