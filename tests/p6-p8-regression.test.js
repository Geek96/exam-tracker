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
  assert.match(html, /course\.js\?v=31/);

  assert.match(css, /\.exam-panel-item/);
  assert.equal((strings.match(/examCount:/g) || []).length, 3);
});
