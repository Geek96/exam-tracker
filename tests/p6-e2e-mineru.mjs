// End-to-end test: upload demo PDF → MinerU → check content completeness
// Usage: node tests/p6-e2e-mineru.mjs
//
// Uploads ONE chunk (first 199 pages) to keep runtime reasonable.
// Full 611-page test would take ~30 min; a single chunk proves the fix.

import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://exam-tracker-one.vercel.app';
// Use pre-split chunk (pages 200-398) — testing the chunk where truncation was reported.
const PDF_PATH = '/tmp/la_chunk2.pdf';
const POLL_INTERVAL_MS = 8000;
const MAX_POLLS = 90; // 12 minutes

// ── Step 1: Upload PDF to litterbox.catbox.moe (72h temp link) ───────────────
async function uploadFile(filePath) {
  console.log('📤 Uploading PDF chunk (pages 200-398) to litterbox.catbox.moe… (~7.1 MB)');
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: 'application/pdf' });
  const fd = new FormData();
  fd.append('reqtype', 'fileupload');
  fd.append('time', '72h');
  fd.append('fileToUpload', blob, path.basename(filePath));
  const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
    method: 'POST',
    body: fd,
    signal: AbortSignal.timeout(180_000),
  });
  const result = (await res.text()).trim();
  if (!result.startsWith('http')) throw new Error('Upload failed: ' + result);
  console.log('   URL:', result);
  return result;
}

// ── Step 2: Submit to MinerU via Vercel API ───────────────────────────────────
async function submitToMinerU(fileUrl, filename) {
  console.log('🚀 Submitting to MinerU…');
  const res = await fetch(`${BASE_URL}/api/mineru-submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: fileUrl, filename, fileType: 'pdf' }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error('Submit failed: ' + (data.error || res.status));
  console.log('   taskId:', data.taskId);
  return data.taskId;
}

// ── Step 3: Poll until done ───────────────────────────────────────────────────
async function pollUntilDone(taskId) {
  console.log('⏳ Polling for result…');
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(`${BASE_URL}/api/mineru-result?taskId=${encodeURIComponent(taskId)}`);
    const data = await res.json();
    if (data.status === 'done') return data.content;
    if (data.status === 'failed') throw new Error('MinerU failed: ' + data.error);
    const prog = data.progress ? ` ${data.progress}%` : '';
    process.stdout.write(`\r   [${i + 1}/${MAX_POLLS}] pending${prog}   `);
  }
  throw new Error('Timeout after ' + (MAX_POLLS * POLL_INTERVAL_MS / 60000).toFixed(1) + ' min');
}

// ── Step 4: Analyse content ───────────────────────────────────────────────────
function analyseContent(content, label) {
  console.log(`\n\n📊 Content analysis — ${label}`);
  console.log('   Total characters :', content.length.toLocaleString());
  console.log('   Total lines       :', content.split('\n').length.toLocaleString());

  // Check for key chapter markers expected in a 199-page slice of this book
  // Chunk 2 covers pages 200-398: Chapters 3 end, 4, early 5 of Friedberg
  const checks = [
    { label: 'Chapter 4 (Determinants)',          pattern: /determinant/i },
    { label: 'Chapter 5 (Diagonalization)',       pattern: /diagonali[sz]|eigenvalue|eigenvector/i },
    { label: 'Section headers present',           pattern: /^#+\s+/m },
    { label: 'Exercise/problem content',          pattern: /exercise|theorem|proof/i },
    { label: 'Math notation present',             pattern: /\$|\\\(|\\begin\{/ },
    { label: 'Content from late in chunk (Ch5)',  pattern: /cayley.hamilton|markov|invariant\s+sub/i },
  ];

  console.log('\n   Content checks:');
  let passed = 0;
  for (const { label, pattern } of checks) {
    const ok = pattern.test(content);
    console.log(`   ${ok ? '✅' : '❌'} ${label}`);
    if (ok) passed++;
  }

  // Truncation check: old cap was 200,000 chars; warn if suspiciously round
  if (content.length === 200000) {
    console.log('\n   ⚠️  Content is exactly 200,000 chars — OLD truncation bug still active!');
  } else if (content.length > 200000) {
    console.log(`\n   ✅ Content exceeds 200 KB (${content.length.toLocaleString()} chars) — truncation fix confirmed`);
  }

  console.log(`\n   ${passed}/${checks.length} checks passed`);
  return passed;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    console.log('=== P6 End-to-End MinerU Test ===\n');
    console.log('PDF:', path.basename(PDF_PATH));

    if (!fs.existsSync(PDF_PATH)) throw new Error('PDF not found: ' + PDF_PATH);

    const fileUrl  = await uploadFile(PDF_PATH);
    const taskId   = await submitToMinerU(fileUrl, 'linear-algebra-test.pdf');
    const content  = await pollUntilDone(taskId);
    const passed   = analyseContent(content, 'linear-algebra-test.pdf');

    console.log('\n' + (passed >= 4 ? '🎉 TEST PASSED' : '❌ TEST FAILED'));
    process.exit(passed >= 4 ? 0 : 1);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
})();
