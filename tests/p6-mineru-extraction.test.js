// Static tests for P6 fix: MinerU ZIP extraction and content-limit changes.
// Run with: node --test tests/p6-mineru-extraction.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');

// ── Re-import the fixed extractMdFromZip from mineru-result.js ────────────────
// We extract the function by loading the module source and re-evaluating just
// the helper (the module exports a Vercel handler, not the internal function).
const fs = require('fs');
const src = fs.readFileSync(
  new URL('../api/mineru-result.js', 'file://' + __filename),
  'utf8'
);
// Isolate extractMdFromZip + its zlib dependency into a runnable snippet
const fnMatch = src.match(
  /const zlib[\s\S]*?^function extractMdFromZip[\s\S]*?^}/m
);
assert.ok(fnMatch, 'Could not locate extractMdFromZip in source');
const extractMdFromZip = new Function(
  'require',
  fnMatch[0] + '\nreturn extractMdFromZip;'
)(require);

// ── ZIP builder helper ────────────────────────────────────────────────────────
// Builds a minimal valid ZIP buffer with the given files ({ name, text }).
function buildZip(files) {
  const localHeaders = [];
  const centralDir   = [];
  let offset = 0;

  for (const { name, text } of files) {
    const data    = Buffer.from(text, 'utf8');
    const fnBuf   = Buffer.from(name, 'utf8');
    // Local file header
    const lh = Buffer.alloc(30 + fnBuf.length);
    lh.writeUInt32LE(0x04034b50, 0);  // signature
    lh.writeUInt16LE(20, 4);           // version needed
    lh.writeUInt16LE(0, 6);            // flags
    lh.writeUInt16LE(0, 8);            // compression: stored
    lh.writeUInt32LE(0, 14);           // CRC (skip for test)
    lh.writeUInt32LE(data.length, 18); // compressed size
    lh.writeUInt32LE(data.length, 22); // uncompressed size
    lh.writeUInt16LE(fnBuf.length, 26);
    lh.writeUInt16LE(0, 28);           // extra len
    fnBuf.copy(lh, 30);

    // Central directory entry
    const cd = Buffer.alloc(46 + fnBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);            // flags
    cd.writeUInt16LE(0, 10);           // compression: stored
    cd.writeUInt32LE(0, 16);           // CRC
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(fnBuf.length, 28);
    cd.writeUInt16LE(0, 30);           // extra
    cd.writeUInt16LE(0, 32);           // comment
    cd.writeUInt32LE(offset, 42);      // local header offset
    fnBuf.copy(cd, 46);

    localHeaders.push(lh, data);
    centralDir.push(cd);
    offset += lh.length + data.length;
  }

  const cdBuf  = Buffer.concat(centralDir);
  const eocd   = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, cdBuf, eocd]);
}

// ─────────────────────────────────────────────────────────────────────────────

test('extractMdFromZip — single .md file is returned correctly', () => {
  const zip = buildZip([{ name: 'output/full.md', text: '# Chapter 1\nHello world' }]);
  const result = extractMdFromZip(zip);
  assert.equal(result, '# Chapter 1\nHello world');
});

test('extractMdFromZip — multiple .md files are ALL concatenated (P6 fix)', () => {
  const zip = buildZip([
    { name: 'auto/page_001.md', text: '# Chapter 1\nContent A' },
    { name: 'auto/page_002.md', text: '## Section 1.1\nContent B' },
    { name: 'auto/page_003.md', text: '## Section 1.2\nContent C' },
  ]);
  const result = extractMdFromZip(zip);
  assert.ok(result.includes('Content A'), 'missing page 1');
  assert.ok(result.includes('Content B'), 'missing page 2');
  assert.ok(result.includes('Content C'), 'missing page 3');
});

test('extractMdFromZip — files are sorted alphabetically (ordering preserved)', () => {
  // Insert in reverse order to verify sort kicks in
  const zip = buildZip([
    { name: 'auto/page_003.md', text: 'THIRD' },
    { name: 'auto/page_001.md', text: 'FIRST' },
    { name: 'auto/page_002.md', text: 'SECOND' },
  ]);
  const result = extractMdFromZip(zip);
  const idxFirst  = result.indexOf('FIRST');
  const idxSecond = result.indexOf('SECOND');
  const idxThird  = result.indexOf('THIRD');
  assert.ok(idxFirst < idxSecond, 'page 1 should precede page 2');
  assert.ok(idxSecond < idxThird, 'page 2 should precede page 3');
});

test('extractMdFromZip — non-.md files (images etc.) are ignored', () => {
  const zip = buildZip([
    { name: 'images/fig1.png', text: '\x89PNG fake' },
    { name: 'output/main.md',  text: '# Real content' },
    { name: 'metadata.json',   text: '{"pages":3}' },
  ]);
  const result = extractMdFromZip(zip);
  assert.equal(result, '# Real content');
  assert.ok(!result.includes('PNG'), 'image bytes must not appear');
});

test('extractMdFromZip — returns null for empty ZIP (no .md files)', () => {
  const zip = buildZip([{ name: 'meta.json', text: '{}' }]);
  const result = extractMdFromZip(zip);
  assert.equal(result, null);
});

test('content limit is now 10 MB (not 200 KB)', () => {
  // Check the literal in source rather than calling the full handler
  const src = fs.readFileSync(
    new URL('../api/mineru-result.js', 'file://' + __filename), 'utf8'
  );
  assert.ok(
    src.includes('10_000_000') || src.includes('10000000'),
    'Expected 10 MB cap in mineru-result.js'
  );
  assert.ok(
    !src.includes('slice(0, 200000)'),
    'Old 200 KB cap must be removed'
  );
});
