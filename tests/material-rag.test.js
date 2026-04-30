const assert = require('node:assert/strict');
const test = require('node:test');

const {
  chunkMarkdownMaterial,
  extractQueryHints,
  rankMaterialChunks,
  formatRetrievedContext,
} = require('../material-rag.js');

const sampleMarkdown = `# Chapter 3 Differential Equations

Intro paragraph.

## 3.4 Linear Equations

Some explanation before exercises.

### Exercises

Exercise 2. Solve y'' + y = 0.

Exercise 3. Solve y'' + 4y' + 4y = 0.
Show the characteristic equation.

## 3.5 Systems

Exercise 3. Solve the system.
`;

test('chunkMarkdownMaterial preserves headings and detects textbook identifiers', () => {
  const chunks = chunkMarkdownMaterial({
    fileId: 'file1',
    courseId: 'course1',
    fileName: 'ode.md',
    text: sampleMarkdown,
  });

  const target = chunks.find(c => c.sectionNo === '3.4' && c.itemNo === '3');
  assert.ok(target, 'expected a chunk for section 3.4 exercise 3');
  assert.equal(target.fileName, 'ode.md');
  assert.deepEqual(target.headingPath, ['Chapter 3 Differential Equations', '3.4 Linear Equations', 'Exercises']);
  assert.match(target.content, /Exercise 3/);
  assert.match(target.content, /characteristic equation/);
});

test('extractQueryHints recognizes section and exercise references', () => {
  assert.deepEqual(extractQueryHints('帮我解 3.4 第 3 题'), {
    sectionNo: '3.4',
    itemNo: '3',
    keywords: ['帮我解'],
  });
});

test('rankMaterialChunks prefers exact section and exercise matches', () => {
  const chunks = chunkMarkdownMaterial({
    fileId: 'file1',
    courseId: 'course1',
    fileName: 'ode.md',
    text: sampleMarkdown,
  });

  const matches = rankMaterialChunks('帮我解 3.4 第 3 题', chunks, 3);

  assert.equal(matches[0].sectionNo, '3.4');
  assert.equal(matches[0].itemNo, '3');
  assert.match(matches[0].content, /4y' \+ 4y/);
});

test('formatRetrievedContext includes source metadata and snippets', () => {
  const chunks = chunkMarkdownMaterial({
    fileId: 'file1',
    courseId: 'course1',
    fileName: 'ode.md',
    text: sampleMarkdown,
  });
  const matches = rankMaterialChunks('帮我解 3.4 第 3 题', chunks, 1);
  const context = formatRetrievedContext(matches);

  assert.match(context, /课程资料检索片段/);
  assert.match(context, /文件：ode\.md/);
  assert.match(context, /位置：Chapter 3 Differential Equations > 3\.4 Linear Equations > Exercises/);
  assert.match(context, /章节：3\.4/);
  assert.match(context, /题号：3/);
  assert.match(context, /Exercise 3/);
});
