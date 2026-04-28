export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const { courseName, subject, chapters = [], reviewGuide, daysLeft, hoursPerDay } = body;

  const chapterText = chapters.map(ch => {
    const total = countLeaves(ch);
    const done  = countDoneLeaves(ch);
    const secLines = ch.sections.map(sec => {
      if (sec.subsections && sec.subsections.length > 0) {
        const subLines = sec.subsections.map(s => `      · ${s.title}${s.done ? ' ✓' : ''}`).join('\n');
        return `    - ${sec.title}\n${subLines}`;
      }
      return `    - ${sec.title}${sec.done ? ' ✓' : ''}`;
    }).join('\n');
    return `【${ch.title}】(${done}/${total} 已完成)\n${secLines}`;
  }).join('\n\n');

  const totalHours = daysLeft != null ? daysLeft * hoursPerDay : null;

  const system = `你是一名专业的考试备考助手，擅长制定科学高效的复习计划。
请根据用户提供的课程大纲、当前复习进度、老师的考试重点和可用时间，生成一份详细的个性化备考计划。

要求：
- 用 Markdown 格式输出（## 表示每天，- 表示具体任务）
- 每天计划要具体到章节和小节，标注大概所需时间
- 已完成（✓）的内容可安排轻量复习或跳过
- 根据老师强调的重点适当加权
- 文字简洁实用，使用中文`;

  const userMsg = `课程：${courseName}${subject ? `（${subject}）` : ''}
距离考试：${daysLeft != null ? `${daysLeft} 天` : '日期未设置'}
每天可用时间：${hoursPerDay} 小时${totalHours != null ? `（共约 ${totalHours} 小时）` : ''}

---

课程章节及当前进度：
${chapterText || '（暂无章节数据）'}

---

老师的复习指导 / 考试重点：
${reviewGuide || '（未提供，请根据章节内容自行判断重点）'}

---

请生成一份按天分配的详细复习计划。`;

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
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

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text();
    return new Response(err, { status: anthropicRes.status, headers: { 'Content-Type': 'text/plain' } });
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    const reader = anthropicRes.body.getReader();
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
          const raw = line.slice(6);
          if (raw === '[DONE]') continue;
          try {
            const ev = JSON.parse(raw);
            if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
              await writer.write(encoder.encode(`data: ${JSON.stringify({ t: ev.delta.text })}\n\n`));
            } else if (ev.type === 'message_stop') {
              await writer.write(encoder.encode('data: [DONE]\n\n'));
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } finally {
      await writer.close();
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

function countLeaves(ch) {
  let n = 0;
  for (const s of ch.sections || []) {
    n += (s.subsections && s.subsections.length > 0) ? s.subsections.length : 1;
  }
  return n;
}

function countDoneLeaves(ch) {
  let n = 0;
  for (const s of ch.sections || []) {
    if (s.subsections && s.subsections.length > 0) {
      n += s.subsections.filter(b => b.done).length;
    } else if (s.done) n++;
  }
  return n;
}
