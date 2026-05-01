const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('P6 sends full markdown context only in the current API payload', () => {
  const src = read('course.js');

  assert.match(src, /async function sendAIMsg\(userText,\s*displayLabel,\s*apiContent\)/);
  assert.match(src, /aiConversation\.push\(\{\s*role:\s*'user',\s*content:\s*userText,\s*display:/);
  assert.match(src, /const apiMsgs = aiConversation\.map\(\(m,\s*i\) => \{/);
  assert.match(src, /i === aiConversation\.length - 1 && apiContent/);
  assert.match(src, /messages:\s*apiMsgs/);
  assert.match(src, /await sendAIMsg\(text,\s*text,\s*apiContent\)/);
  assert.match(src, /await sendAIMsg\(displayLabel,\s*displayLabel,\s*apiContent\)/);
});

test('P6 guards localStorage writes and caps chat sessions', () => {
  const courseSrc = read('course.js');
  const appSrc = read('app.js');
  const welcomeSrc = read('welcome.html');

  assert.match(courseSrc, /function saveCourses\(courses\)\s*\{\s*try\s*\{/);
  assert.match(courseSrc, /function saveFileSelection\(sel\)\s*\{\s*try\s*\{/);
  assert.match(courseSrc, /function actSet\(id\)\s*\{\s*try\s*\{/);
  assert.match(courseSrc, /if \(sessions\.length > 5\) sessions = sessions\.slice\(0,\s*5\)/);
  assert.match(appSrc, /function saveCourses\(courses\)\s*\{\s*try\s*\{/);
  assert.match(appSrc, /function saveExams\(exams\)\s*\{\s*try\s*\{/);
  assert.match(welcomeSrc, /try\s*\{\s*localStorage\.setItem\('app_lang',\s*currentLang\)/);
});

test('main course management header exposes a quiet build version label', () => {
  const html = read('index.html');
  const css = read('styles.css');

  assert.match(html, /<span class="app-version"[^>]*>v43<\/span>/);
  assert.match(css, /\.app-version/);
  assert.match(css, /opacity:\s*0\.55/);
});

test('P8 integrates a course-specific exam panel', () => {
  const js = read('course.js');
  const html = read('course.html');
  const css = read('course.css');
  const strings = read('strings.js');

  assert.match(js, /const EXAMS_KEY = 'examTrackerExams'/);
  assert.match(js, /function renderCourseExams\(\)/);
  assert.match(js, /courseExams\.filter\(e => e\.courseId === courseId\)/);
  assert.match(js, /saveExamsLocal\(courseExams\)/);
  assert.match(js, /updateExamNavCard\(\);/);

  assert.match(html, /id="examNavCard"/);
  assert.match(html, /id="panelExams"/);
  assert.match(html, /id="courseExamModalOverlay"/);
  assert.match(html, /course\.js\?v=\d+/);

  assert.match(css, /\.exam-panel-item/);
  assert.equal((strings.match(/examCount:/g) || []).length, 3);
});

test('Task1 AI sessions stored in IndexedDB not localStorage', () => {
  const src = read('course.js');

  // File materials DB is opened without a forced version upgrade.
  assert.match(src, /indexedDB\.open\('examTrackerFiles'\)/);
  assert.doesNotMatch(src, /indexedDB\.open\('examTrackerFiles',\s*2\)/);

  // Chat sessions live in an isolated DB so materials are not blocked by chat schema changes.
  assert.match(src, /indexedDB\.open\('examTrackerChatSessions',\s*1\)/);
  assert.match(src, /createObjectStore\('sessions'/);

  // IDB session helpers exist
  assert.match(src, /async function dbGetSessions\(cid\)/);
  assert.match(src, /async function dbSaveSessions\(cid,\s*sessions\)/);

  // Session cache variable
  assert.match(src, /let _sessCache\s*=\s*\[\]/);

  // sessLoad returns cache
  assert.match(src, /function sessLoad\(\)\s*\{\s*return _sessCache;\s*\}/);

  // sessSave updates cache and writes to IDB asynchronously
  assert.match(src, /_sessCache\s*=\s*s/);
  assert.match(src, /dbSaveSessions\(courseId,\s*s\)/);

  // initSessions is an async function (not an IIFE)
  assert.match(src, /async function initSessions\(\)/);

  // localStorage sessKey usage removed
  assert.doesNotMatch(src, /chatSessions_\$\{courseId\}/);

  // version bump
  assert.match(read('course.html'), /course\.js\?v=\d+/);
});

test('Task2 main page shows upcoming exam reminders not CRUD', () => {
  const html = read('index.html');
  const js   = read('app.js');
  const css  = read('styles.css');

  // New widget HTML exists
  assert.match(html, /id="upcomingExamsList"/);
  assert.match(html, /id="upcomingExamsEmpty"/);

  // Old exam CRUD modal removed
  assert.doesNotMatch(html, /id="examModalOverlay"/);
  assert.doesNotMatch(html, /id="btnAddExam"/);

  // New render function in app.js
  assert.match(js, /function renderUpcomingExams\(\)/);

  // Old exam CRUD functions removed from app.js
  assert.doesNotMatch(js, /function renderExams\(\)/);
  assert.doesNotMatch(js, /function openExamModal\(\)/);

  // New styles exist
  assert.match(css, /\.upcoming-exam-item/);
});

test('Task3 MinerU task IDs persisted for resume after navigation', () => {
  const src = read('course.js');

  assert.match(src, /function addPendingMinerUTask\(taskId,/);
  assert.match(src, /function removePendingMinerUTask\(taskId\)/);
  assert.match(src, /function loadPendingMinerUTasks\(\)/);
  assert.match(src, /async function resumeMinerUPoll\(taskId,/);
  assert.match(src, /resumePendingMinerUTasks\(\)/);

  // mineruSubmitAndPoll accepts onTaskIdReady callback
  assert.match(src, /async function mineruSubmitAndPoll\(fileBuffer,\s*filename,\s*fileType,\s*onStatus,\s*isCancelled,\s*onTaskIdReady\)/);
  assert.match(src, /if \(onTaskIdReady\) onTaskIdReady\(taskId\)/);

  assert.match(read('course.html'), /course\.js\?v=\d+/);
});

test('Navigation storage fix avoids blocking the materials database upgrade path', () => {
  const src = read('course.js');

  assert.match(src, /function getChatDB\(\)/);
  assert.match(src, /async function dbGetLegacySessions\(cid\)/);
  assert.match(src, /_idb\.onversionchange\s*=\s*\(\)\s*=>\s*_idb\.close\(\)/);
  assert.match(src, /_chatIdb\.onversionchange\s*=\s*\(\)\s*=>\s*_chatIdb\.close\(\)/);
  assert.doesNotMatch(src, /db\.transaction\('chatSessions',\s*'readwrite'\)/);

  assert.match(read('course.html'), /course\.js\?v=\d+/);
});

test('Material chunks are persisted and deleted with source materials', () => {
  const src = read('course.js');
  const rag = read('material-rag.js');

  assert.match(src, /indexedDB\.open\('examTrackerMaterialChunks',\s*1\)/);
  assert.match(src, /createObjectStore\('materialChunks'/);
  assert.doesNotMatch(src, /indexedDB\.open\('examTrackerFiles',\s*db\.version \+ 1\)/);
  assert.match(src, /async function dbSaveChunksForFile\(fileId,\s*chunks\)/);
  assert.match(src, /async function dbGetChunksForCourse\(cid\)/);
  assert.match(src, /async function dbDeleteChunksForFile\(fileId\)/);
  assert.match(src, /async function ensureChunksForMaterial\(f\)/);
  assert.match(src, /await dbDeleteChunksForFile\(f\.id\)/);
  assert.match(src, /MaterialRAG\.chunkMarkdownMaterial/);
  assert.match(rag, /INDEX_VERSION/);
  assert.match(src, /c\.indexVersion === MaterialRAG\.INDEX_VERSION/);
});

test('AI free-form chat retrieves relevant material chunks on every turn', () => {
  const src = read('course.js');
  const html = read('course.html');
  const materialScriptIndex = html.indexOf('material-rag.js');
  const courseScriptIndex = html.search(/course\.js\?v=\d+/);

  assert.ok(materialScriptIndex > -1, 'course.html should load material-rag.js');
  assert.ok(courseScriptIndex > materialScriptIndex, 'material-rag.js must load before course.js');
  assert.match(src, /async function loadRetrievedMaterialContext\(query\)/);
  assert.match(src, /async function loadSelectedMarkdownExcerptContext\(query\)/);
  assert.match(src, /function summarizeAvailableMaterialChoices\(chunks,\s*files\)/);
  assert.match(src, /await Promise\.all\(selectedMdFiles\.map\(f => ensureChunksForMaterial\(f\)\)\)/);
  assert.match(src, /MaterialRAG\.rankMaterialChunks\(query,\s*chunks,\s*6\)/);
  assert.match(src, /MaterialRAG\.formatRetrievedContext\(matches\)/);
  assert.match(src, /RAG 未命中/);
  assert.match(src, /可以检索到的资料范围/);
  assert.match(src, /请先引导用户从上面的文件、章节或小节中选择/);

  const doSend = src.match(/async function doSend\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(doSend, /const mdCtx = await loadRetrievedMaterialContext\(text\)/);
  assert.match(doSend, /const fallbackMdCtx = mdCtx \? '' : await loadSelectedMarkdownExcerptContext\(text\)/);
  assert.match(doSend, /if \(mdCtx \|\| fallbackMdCtx\) apiContent = text \+ '\s*\\n\\n' \+ \(mdCtx \|\| fallbackMdCtx\)/);
  assert.doesNotMatch(doSend, /aiConversation\.length === 0/);
  assert.match(doSend, /await sendAIMsg\(text,\s*text,\s*apiContent\)/);
});

test('AI fallback excerpt targets the requested section instead of only the file prefix', () => {
  const src = read('course.js');

  assert.match(src, /async function loadSelectedMarkdownExcerptContext\(query\)/);
  assert.match(src, /MaterialRAG\.buildTargetedExcerpt\(text,\s*query/);
  assert.match(src, /课程资料相关摘录/);
  assert.doesNotMatch(src, /节选前 \$\{chunk\.length\} 字符/);
});

test('AI system prompt acknowledges injected local markdown materials', () => {
  const api = read('api/study-plan.js');

  assert.match(api, /课程资料上下文由前端从用户已选中的本地 Markdown 文件注入/);
  assert.match(api, /不得声称自己无法访问已选课程资料/);
  assert.match(api, /如果用户消息说明“RAG 未命中”/);
  assert.match(api, /引导用户从可检索到的文件、章节或小节中选择/);
});

test('Saved AI answers become markdown materials with rendered preview support', () => {
  const src = read('course.js');
  const html = read('course.html');
  const css = read('course.css');
  const strings = read('strings.js');

  assert.match(src, /const name = `AI对话_[^`]+\.md`/);
  assert.match(src, /courseId,\s*name,\s*type:\s*'text\/markdown'/);
  assert.match(src, /await ensureChunksForMaterial\(record\)/);
  assert.match(src, /function isMarkdownMaterial\(f\)/);
  assert.match(src, /function renderTextEditPreview\(text\)/);
  assert.match(src, /preview\.innerHTML = mdToHtml\(text\)/);
  assert.match(src, /renderMath\(preview\)/);

  assert.match(html, /id="textEditPreviewToggle"/);
  assert.match(html, /id="textEditPreview"/);
  assert.match(html, /course\.js\?v=\d+/);

  assert.match(css, /\.text-edit-preview/);
  assert.equal((strings.match(/previewMarkdown:/g) || []).length, 3);
  assert.equal((strings.match(/editMarkdown:/g) || []).length, 3);
});
