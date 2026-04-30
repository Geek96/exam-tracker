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

  // IDB version 2 with chatSessions store
  assert.match(src, /indexedDB\.open\('examTrackerFiles',\s*2\)/);
  assert.match(src, /createObjectStore\('chatSessions'/);

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
  assert.match(read('course.html'), /course\.js\?v=32/);
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
