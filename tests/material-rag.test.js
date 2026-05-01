const assert = require('node:assert/strict');
const test = require('node:test');

const {
  INDEX_VERSION,
  chunkMarkdownMaterial,
  extractQueryHints,
  buildTargetedExcerpt,
  needsTargetedExcerpt,
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

const bareExerciseMarkdown = `# Table of Contents

3.4 Linear Equations ................................ 127
3. Exercises ........................................ 130

# Chapter 3 Differential Equations

## 3.4 Linear Equations

The method uses the characteristic equation.

### Exercises

1. Solve y'' + y = 0.

2. Solve y'' + 2y' + y = 0.

3. Solve y'' + 4y' + 4y = 0.
Find a fundamental set of solutions and write the general solution.

4. Solve y'' - y = 0.
`;

const longTextbookMarkdown = `# Table of Contents

3.4 Systems of Linear Equations--Computational Aspects .......... 181

# Chapter 1

${'introductory material '.repeat(1600)}

# Chapter 3

## 3.4 Systems of Linear Equations--Computational Aspects

This section starts on page 181 and discusses computation.

### Exercises

1. First exercise.

2. Second exercise.

3. Use Gaussian elimination to solve the augmented matrix.
This is the exercise body that appears far beyond the first excerpt window.
`;

const tocNumberOnlyMarkdown = `# Table of Contents

3.4 Systems of Linear Equations--Computational Aspects .......... 127

# Chapter 1

${'introductory material '.repeat(1600)}

# Chapter 3

## Systems of Linear Equations--Computational Aspects

The actual section heading lost its numeric prefix during conversion.

### Exercises

1. First computational exercise.

2. Second computational exercise.

3. Determine the solution set of the linear system Ax = b.
This is the precise exercise text from the body, not the table of contents.
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
  assert.equal(target.indexVersion, INDEX_VERSION);
  assert.equal(target.fileName, 'ode.md');
  assert.deepEqual(target.headingPath, ['Chapter 3 Differential Equations', '3.4 Linear Equations', 'Exercises']);
  assert.match(target.content, /Exercise 3/);
  assert.match(target.content, /characteristic equation/);
});

test('extractQueryHints recognizes section and exercise references', () => {
  assert.deepEqual(extractQueryHints('帮我解 3.4 第 3 题'), {
    sectionNo: '3.4',
    itemNo: '3',
    pageNo: '',
    keywords: ['帮我解'],
  });
});

test('extractQueryHints recognizes page references without confusing exercise numbers', () => {
  assert.equal(extractQueryHints('第 181 页之后 3.4 节第 3 题').pageNo, '181');
  assert.equal(extractQueryHints('帮我解 3.4 第 3 题').pageNo, '');
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

test('bare numbered textbook exercises are chunked and ranked above table of contents', () => {
  const chunks = chunkMarkdownMaterial({
    fileId: 'file2',
    courseId: 'course1',
    fileName: 'textbook.md',
    text: bareExerciseMarkdown,
  });

  const target = chunks.find(c => c.sectionNo === '3.4' && c.itemNo === '3');
  assert.ok(target, 'expected bare "3." exercise to become its own retrievable chunk');
  assert.equal(target.blockType, 'exercise');
  assert.match(target.content, /fundamental set of solutions/);

  const matches = rankMaterialChunks('帮我解 3.4 第 3 题', chunks, 3);
  assert.equal(matches[0].fileName, 'textbook.md');
  assert.equal(matches[0].sectionNo, '3.4');
  assert.equal(matches[0].itemNo, '3');
  assert.equal(matches[0].blockType, 'exercise');
  assert.doesNotMatch(matches[0].content, /Table of Contents/);
  assert.match(matches[0].content, /4y' \+ 4y/);
});

test('buildTargetedExcerpt uses section and exercise hints instead of the file prefix', () => {
  const excerpt = buildTargetedExcerpt(longTextbookMarkdown, '帮我解第 181 页之后 3.4 节第 3 题', {
    maxChars: 12000,
    beforeChars: 800,
  });

  assert.match(excerpt.text, /3\.4 Systems of Linear Equations/);
  assert.match(excerpt.text, /Gaussian elimination/);
  assert.doesNotMatch(excerpt.text, /Table of Contents/);
  assert.ok(excerpt.start > 20000, 'expected targeted excerpt to come from later in the document');
});

test('buildTargetedExcerpt follows table-of-contents titles to body headings without section numbers', () => {
  const excerpt = buildTargetedExcerpt(tocNumberOnlyMarkdown, '帮我解第 127 页之后 3.4 节第 3 题', {
    maxChars: 12000,
    beforeChars: 800,
  });

  assert.match(excerpt.text, /actual section heading lost its numeric prefix/);
  assert.match(excerpt.text, /Determine the solution set/);
  assert.doesNotMatch(excerpt.text, /Table of Contents/);
  assert.ok(excerpt.start > 20000, 'expected TOC title to redirect to the later body heading');
});

test('needsTargetedExcerpt flags section matches that miss the requested exercise number', () => {
  const chunks = chunkMarkdownMaterial({
    fileId: 'file4',
    courseId: 'course1',
    fileName: 'concepts.md',
    text: `# Chapter 3

## 3.4 Real Repeated Roots; Reduction of Order

This section explains repeated roots and gives an initial value problem example.
`,
  });

  const matches = rankMaterialChunks('帮我解 3.4 第 3 题', chunks, 6);

  assert.ok(matches.length > 0, 'expected section-level matches');
  assert.equal(needsTargetedExcerpt('帮我解 3.4 第 3 题', matches), true);
  assert.equal(needsTargetedExcerpt('帮我解释 3.4 重根概念', matches), false);
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

// ── 新增测试：改动 1 ──────────────────────────────────────────────────────

test('chunkMarkdownMaterial does not pollute sectionNo from equation or figure refs in content', () => {
  const md = `# Chapter 2

## Mixing Problems

The substance satisfies equation (3.4): dT/dt = k(T - M).
See also Figure 3.4 for the phase portrait.

1. Solve the mixing problem.
`;
  const chunks = chunkMarkdownMaterial({
    fileId: 'f', courseId: 'c', fileName: 'ch2.md', text: md,
  });
  const ch2Chunk = chunks.find(c => (c.headingPath || []).some(h => h.includes('Mixing')));
  assert.ok(ch2Chunk, 'expected a Chapter 2 chunk');
  assert.equal(ch2Chunk.sectionNo, '', 'sectionNo must not be set by equation (3.4) in content');
});

// ── 新增测试：改动 2 ──────────────────────────────────────────────────────

test('extractQueryHints normalizes 第X章第Y节 (Chinese numerals) to X.Y', () => {
  const h1 = extractQueryHints('第三章第四节第3题');
  assert.equal(h1.sectionNo, '3.4', '第三章第四节 → 3.4');
  assert.equal(h1.itemNo, '3');

  const h2 = extractQueryHints('第3章第4节');
  assert.equal(h2.sectionNo, '3.4', '第3章第4节 → 3.4');

  const h3 = extractQueryHints('第十章第二节');
  assert.equal(h3.sectionNo, '10.2', '第十章第二节 → 10.2');
});

test('extractQueryHints normalizes "chapter X section Y" to X.Y', () => {
  const h = extractQueryHints('chapter 3 section 4 problem 3');
  assert.equal(h.sectionNo, '3.4');
  assert.equal(h.itemNo, '3');
});

test('extractQueryHints does not extract sectionNo from formula/figure references', () => {
  assert.equal(extractQueryHints('公式(3.4)是什么意思').sectionNo, '', '公式(3.4) should not become sectionNo');
  assert.equal(extractQueryHints('图3.4说明了什么').sectionNo,    '', '图3.4 should not become sectionNo');
  assert.equal(extractQueryHints('equation (3.4) derivation').sectionNo, '', 'equation (3.4) should not become sectionNo');
  assert.equal(extractQueryHints('figure 3.4 shows the curve').sectionNo, '', 'figure 3.4 should not become sectionNo');
  // 真正的章节写法仍然有效
  assert.equal(extractQueryHints('3.4节第3题').sectionNo, '3.4', '3.4节 still works');
  assert.equal(extractQueryHints('Section 3.4 problem 3').sectionNo, '3.4', 'Section 3.4 still works');
});
