export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response('Bad Request', { status: 400 }); }

  const { courseName, subject, chapters = [], reviewGuide, daysLeft, hoursPerDay, provider = 'gemini' } = body;

  const chapterText = chapters.map(ch => {
    const total = countLeaves(ch), done = countDoneLeaves(ch);
    const secLines = ch.sections.map(sec => {
      if (sec.subsections?.length > 0) {
        return `    - ${sec.title}\n` + sec.subsections.map(s => `      · ${s.title}${s.done ? ' ✓' : ''}`).join('\n');
      }
      return `    - ${sec.title}${sec.done ? ' ✓' : ''}`;
    }).join('\n');
    return `【${ch.title}】(${done}/${total} 已完成)\n${secLines}`;
  }).join('\n\n');

  const totalHours = daysLeft != null ? daysLeft * hoursPerDay : null;

  const system = `你是一名专业的考试备考助手，擅长制定科学高效的复习计划。
请根据用户提供的课程大纲、当前复习进度、老师的考试重点和可用时间，生成一份详细的个性化备考计划。
要求：用 Markdown 格式（## 每天标题，- 具体任务），每天计划具体到章节小节并标注时间，已完成（✓）可轻量复习或跳过，使用中文。`;

  const userMsg = `课程：${courseName}${subject ? `（${subject}）` : ''}
距离考试：${daysLeft != null ? `${daysLeft} 天` : '未设置'}
每天可用：${hoursPerDay} 小时${totalHours != null ? `（共约 ${totalHours} 小时）` : ''}

课程章节及进度：
${chapterText || '（暂无章节数据）'}

老师的复习指导：
${reviewGuide || '（未提供，请根据章节内容自行判断重点）'}

请生成按天分配的详细复习计划。`;

  return provider === 'claude'
    ? handleClaude(system, userMsg)
    : handleGemini(system, userMsg);
}

// ── Anthropic Claude ──────────────────────────────────────────────────────────
async function handleClaude(system, userMsg) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return errJson(500, 'ANTHROPIC_API_KEY 未在 Vercel 环境变量中配置');

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
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
      messages: [{ role: 'user', content: userMsg }],
    }),
  });

  if (!upstream.ok) return new Response(await upstream.text(), { status: upstream.status });

  return streamSSE(upstream.body, line => {
    try {
      const ev = JSON.parse(line);
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') return ev.delta.text;
    } catch { /* ignore */ }
  });
}

// ── Google Gemini ─────────────────────────────────────────────────────────────
async function handleGemini(system, userMsg) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return errJson(500, 'GEMINI_API_KEY 未在 Vercel 环境变量中配置');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`;

  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: userMsg }] }],
      generationConfig: { maxOutputTokens: 4096 },
    }),
  });

  if (!upstream.ok) return new Response(await upstream.text(), { status: upstream.status });

  return streamSSE(upstream.body, line => {
    try {
      const ev = JSON.parse(line);
      return ev.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch { /* ignore */ }
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
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' },
  });
}

function errJson(status, msg) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json' } });
}

function countLeaves(ch) {
  let n = 0;
  for (const s of ch.sections || []) n += (s.subsections?.length > 0) ? s.subsections.length : 1;
  return n;
}
function countDoneLeaves(ch) {
  let n = 0;
  for (const s of ch.sections || []) {
    if (s.subsections?.length > 0) n += s.subsections.filter(b => b.done).length;
    else if (s.done) n++;
  }
  return n;
}
