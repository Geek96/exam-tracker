async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end('Method Not Allowed'); return; }

  // Vercel auto-parses JSON bodies, but fall back to manual read if not
  let body = req.body;
  if (!body || typeof body !== 'object') {
    try {
      const raw = await new Promise(function(resolve, reject) {
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

  var provider  = body.provider  || 'gemini';
  var courseName = body.courseName || '';
  var subject    = body.subject   || '';
  var msgs       = Array.isArray(body.messages) ? body.messages : [];
  var lang       = body.lang || 'zh';

  var langNote = {
    zh: '请用 Markdown 格式回复，使用中文。',
    en: 'Please respond in English using Markdown format.',
    es: 'Por favor responde en español usando formato Markdown.'
  }[lang] || '请用 Markdown 格式回复，使用中文。';

  var system = '你是一名专业的考试备考助手，擅长制定科学高效的复习计划，并能根据用户的追问进行深入解答。\n' +
    '课程：' + (courseName || '未命名') + (subject ? ('（' + subject + '）') : '') + '\n' +
    '课程资料上下文由前端从用户已选中的本地 Markdown 文件注入到用户消息中。只要用户消息包含“课程资料”“课程资料检索片段”或“课程资料全文摘录”，就视为你已经可以读取这些资料内容；不得声称自己无法访问已选课程资料，也不要要求用户重新上传或粘贴同一份资料。\n' +
    '如果注入的资料片段不足以回答具体问题，请明确指出缺少哪一段内容，并基于已有片段给出可确定的部分。\n' +
    langNote;

  try {
    if (provider === 'claude') {
      await handleClaude(system, msgs, res);
    } else if (provider === 'deepseek') {
      await handleDeepSeek(system, msgs, res);
    } else {
      await handleGemini(system, msgs, res);
    }
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: '服务器错误：' + err.message });
    } else {
      try { res.write('data: ' + JSON.stringify({ err: err.message }) + '\n\n'); } catch {}
      res.end();
    }
  }
}

async function handleClaude(system, messages, res) {
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'ANTHROPIC_API_KEY 未在 Vercel 环境变量中配置' }); return; }

  var upstream;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: 'claude-opus-4-7', max_tokens: 4096, stream: true, system: system, messages: messages }),
    });
  } catch (err) {
    res.status(502).json({ error: '无法连接 Anthropic：' + err.message }); return;
  }

  if (!upstream.ok) {
    var raw = await upstream.text();
    var msg = raw;
    try { msg = JSON.parse(raw).error.message || raw; } catch {}
    res.status(upstream.status).json({ error: msg }); return;
  }

  await streamSSE(upstream.body, res, function(line) {
    try {
      var ev = JSON.parse(line);
      if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') return ev.delta.text;
    } catch {}
  });
}

async function handleDeepSeek(system, messages, res) {
  var apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'DEEPSEEK_API_KEY 未在 Vercel 环境变量中配置' }); return; }

  var contents = [{ role: 'system', content: system }].concat(
    messages.map(function(m) { return { role: m.role, content: m.content }; })
  );

  var upstream;
  try {
    upstream = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        stream: true,
        max_tokens: 4096,
        messages: contents,
      }),
    });
  } catch (err) {
    res.status(502).json({ error: '无法连接 DeepSeek：' + err.message }); return;
  }

  if (!upstream.ok) {
    var raw = await upstream.text();
    var msg = raw;
    try { msg = JSON.parse(raw).error.message || raw; } catch {}
    res.status(upstream.status).json({ error: msg }); return;
  }

  await streamSSE(upstream.body, res, function(line) {
    try {
      var ev = JSON.parse(line);
      if (ev.choices && ev.choices[0] && ev.choices[0].delta && ev.choices[0].delta.content) {
        return ev.choices[0].delta.content;
      }
    } catch {}
  });
}

async function handleGemini(system, messages, res) {
  var apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'GEMINI_API_KEY 未在 Vercel 环境变量中配置' }); return; }

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:streamGenerateContent?alt=sse&key=' + apiKey;

  var contents = messages.map(function(m) {
    return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] };
  });

  var upstream;
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
    res.status(502).json({ error: '无法连接 Gemini：' + err.message }); return;
  }

  if (!upstream.ok) {
    var raw = await upstream.text();
    var msg = raw;
    try { msg = JSON.parse(raw).error.message || raw; } catch {}
    res.status(upstream.status).json({ error: msg }); return;
  }

  await streamSSE(upstream.body, res, function(line) {
    try {
      var ev = JSON.parse(line);
      if (ev.candidates && ev.candidates[0] && ev.candidates[0].content &&
          ev.candidates[0].content.parts && ev.candidates[0].content.parts[0]) {
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

  var reader  = body.getReader();
  var decoder = new TextDecoder();
  var buf     = '';

  try {
    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buf += decoder.decode(chunk.value, { stream: true });
      var lines = buf.split('\n');
      buf = lines.pop();
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.indexOf('data: ') !== 0) continue;
        var raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;
        var text = extractText(raw);
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
