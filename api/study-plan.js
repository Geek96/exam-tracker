async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end('Method Not Allowed'); return; }

  const body = req.body || {};
  const { provider = 'gemini', courseName, subject, messages } = body;
  const msgs = Array.isArray(messages) ? messages : [];

  const system = `你是一名专业的考试备考助手，擅长制定科学高效的复习计划，并能根据用户的追问进行深入解答。\n课程：${courseName || '未命名'}${subject ? `（${subject}）` : ''}\n请用 Markdown 格式回复，使用中文。`;

  try {
    if (provider === 'claude') {
      await handleClaude(system, msgs, res);
    } else {
      await handleGemini(system, msgs, res);
    }
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: `服务器错误：${err.message}` });
    } else {
      try { res.write(`data: ${JSON.stringify({ err: err.message })}\n\n`); } catch {}
      res.end();
    }
  }
}

async function handleClaude(system, messages, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'ANTHROPIC_API_KEY 未在 Vercel 环境变量中配置' }); return; }

  let upstream;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: 'claude-opus-4-7', max_tokens: 4096, stream: true, system, messages }),
    });
  } catch (err) {
    res.status(502).json({ error: `无法连接 Anthropic：${err.message}` }); return;
  }

  if (!upstream.ok) {
    const raw = await upstream.text();
    let msg = raw;
    try { msg = JSON.parse(raw).error?.message || raw; } catch {}
    res.status(upstream.status).json({ error: msg }); return;
  }

  await streamSSE(upstream.body, res, function(line) {
    try {
      const ev = JSON.parse(line);
      if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') return ev.delta.text;
    } catch {}
  });
}

async function handleGemini(system, messages, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'GEMINI_API_KEY 未在 Vercel 环境变量中配置' }); return; }

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:streamGenerateContent?alt=sse&key=' + apiKey;

  const contents = messages.map(function(m) {
    return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] };
  });

  let upstream;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: contents,
        generationConfig: { maxOutputTokens: 4096 },
      }),
    });
  } catch (err) {
    res.status(502).json({ error: `无法连接 Gemini：${err.message}` }); return;
  }

  if (!upstream.ok) {
    const raw = await upstream.text();
    let msg = raw;
    try { msg = JSON.parse(raw).error.message || raw; } catch {}
    res.status(upstream.status).json({ error: msg }); return;
  }

  await streamSSE(upstream.body, res, function(line) {
    try {
      const ev = JSON.parse(line);
      if (ev.candidates && ev.candidates[0] && ev.candidates[0].content && ev.candidates[0].content.parts && ev.candidates[0].content.parts[0]) {
        return ev.candidates[0].content.parts[0].text;
      }
    } catch {}
  });
}

async function streamSSE(body, res, extractText) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
  });

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buf += decoder.decode(chunk.value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;
        const text = extractText(raw);
        if (text) res.write('data: ' + JSON.stringify({ t: text }) + '\n\n');
      }
    }
    res.write('data: [DONE]\n\n');
  } catch (err) {
    try { res.write('data: ' + JSON.stringify({ err: err.message }) + '\n\n'); } catch {}
  } finally {
    res.end();
  }
}

module.exports = handler;
