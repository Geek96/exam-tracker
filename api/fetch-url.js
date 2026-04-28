async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end('Method Not Allowed'); return; }

  // Vercel auto-parses JSON bodies, but fall back to manual read if not
  var body = req.body;
  if (!body || typeof body !== 'object') {
    try {
      var raw = await new Promise(function(resolve, reject) {
        var d = '';
        req.on('data', function(c) { d += c; });
        req.on('end', function() { resolve(d); });
        req.on('error', reject);
      });
      body = JSON.parse(raw);
    } catch (e) {
      body = {};
    }
  }

  var url = body.url;
  if (!url || !/^https?:\/\//.test(url)) {
    res.status(400).json({ error: '请输入有效的 http/https 链接' }); return;
  }

  try {
    var upstream = await fetch(url, {
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

    var ct  = upstream.headers.get('content-type') || '';
    var txt = await upstream.text();
    var text;

    if (ct.includes('text/html')) {
      text = txt
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
      text = txt.trim();
    }

    res.json({ text: text.slice(0, 30000) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}

module.exports = handler;
