export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  let body;
  try { body = await req.json(); } catch { return errJson(400, 'Bad Request'); }

  try {
    const { provider = 'gemini', courseName, subject, messages = [] } = body;

    if (!messages.length) return errJson(400, '消息列表不能为空');

    const system = `你是一名专业的考试备考助手，擅长制定科学高效的复习计划，并能根据用户的追问进行深入解答。
课程：${courseName || '未命名'}${subject ? `（${subject}）` : ''}
请用 Markdown 格式回复，使用中文。`;

    return provider === 'claude'
      ? handleClaude(system, messages)
      : handleGemini(system, messages);

  } catch (err) {
    return errJson(500, `服务器错误：${err.message}`);
  }
}

// ── Anthropic Claude ──────────────────────────────────────────────────────────
async function handleClaude(system, messages) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return errJson(500, 'ANTHROPIC_API_KEY 未在 Vercel 环境变量中配置');

  let upstream;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 4096,
        stream: true,
        system,
        messages,
      }),
    });
  } catch (err) {
    return errJson(502, `无法连接 Anthropic：${err.message}`);
  }

  if (!upstream.ok) {
    const raw = await upstream.text();
    let msg = raw;
    try { msg = JSON.parse(raw).error?.message || raw; } catch {}
    return errJson(upstream.status, msg);
  }

  return streamSSE(upstream.body, line => {
    try {
      const ev = JSON.parse(line);
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') return ev.delta.text;
    } catch {}
  });
}

// ── Google Gemini ─────────────────────────────────────────────────────────────
async function handleGemini(system, messages) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return errJson(500, 'GEMINI_API_KEY 未在 Vercel 环境变量中配置');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:streamGenerateContent?alt=sse&key=${apiKey}`;

  // Map messages: assistant → model
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  let upstream;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: 4096 },
      }),
    });
  } catch (err) {
    return errJson(502, `无法连接 Gemini：${err.message}`);
  }

  if (!upstream.ok) {
    const raw = await upstream.text();
    let msg = raw;
    try { msg = JSON.parse(raw).error?.message || raw; } catch {}
    return errJson(upstream.status, msg);
  }

  return streamSSE(upstream.body, line => {
    try {
      const ev = JSON.parse(line);
      return ev.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch {}
  });
}

// ── Shared SSE streaming ──────────────────────────────────────────────────────
function streamSSE(body, extractText) {
  const { readable, writable } = new TransformStream();
  const writer  = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    const reader  = body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;
          const text = extractText(raw);
          if (text) await writer.write(encoder.encode(`data: ${JSON.stringify({ t: text })}\n\n`));
        }
      }
      await writer.write(encoder.encode('data: [DONE]\n\n'));
    } catch (err) {
      try {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ err: err.message })}\n\n`));
      } catch {}
    } finally {
      try { await writer.close(); } catch {}
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}

function errJson(status, msg) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
