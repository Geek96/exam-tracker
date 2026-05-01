const fs = require('fs');
const vm = require('vm');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const demoKeys = [
  'demoCourseName', 'demoCourseSubject',
  'demoWelcomeTitle', 'demoWelcomeDesc',
  'demoAddExamTitle', 'demoAddExamDesc',
  'demoConfirmExamTitle', 'demoConfirmExamDesc',
  'demoChaptersTitle', 'demoChaptersDesc',
  'demoCheckChapterTitle', 'demoCheckChapterDesc',
  'demoMaterialsTitle', 'demoMaterialsDesc',
  'demoAITitle', 'demoAIDesc',
  'demoFileSelectTitle', 'demoFileSelectDesc',
  'demoQuestionsTitle', 'demoQuestionsDesc',
  'demoSaveTitle', 'demoSaveDesc',
  'demoDoneTitle', 'demoDoneDesc',
  'demoNext', 'demoSkip', 'demoClose',
  'demoReset', 'demoResetConfirm',
  'demoStepOf', 'demoRestart',
  'demoQ1', 'demoQ2', 'demoQ3',
];

const stringsSandbox = {
  window: {
    applyStrings() {},
  },
  localStorage: {
    getItem() { return 'zh'; },
  },
  document: {
    querySelectorAll() { return []; },
    documentElement: {},
  },
};
stringsSandbox.window.window = stringsSandbox.window;
vm.createContext(stringsSandbox);
vm.runInContext(read('strings.js'), stringsSandbox, { filename: 'strings.js' });
const strings = stringsSandbox.STRINGS;

assert(strings, 'STRINGS object should load');
['zh', 'en', 'es'].forEach((lang) => {
  demoKeys.forEach((key) => {
    assert(strings[lang][key], `${lang}.${key} is missing`);
  });
});

const appJs = read('app.js');
assert(appJs.includes('function seedDemoCourse()'), 'app.js should define seedDemoCourse');
assert(appJs.includes("id: '__demo__'"), 'seedDemoCourse should use __demo__ id');
assert(appJs.includes('seedDemoCourse();'), 'app.js init should call seedDemoCourse');

const html = read('course.html');
assert(html.includes('id="demoTourPanel"'), 'course.html should include demo tour panel');
assert(html.includes('id="demoRestartBanner"'), 'course.html should include demo restart banner');
assert(html.includes('<script src="demo-tour.js"></script>'), 'course.html should load demo-tour.js');
assert(html.includes('course.js?v=40'), 'course.html should bump course.js to v=40');

const css = read('course.css');
assert(css.includes('.demo-tour-panel'), 'course.css should style demo tour panel');
assert(css.includes('.demo-tour-highlight'), 'course.css should style highlighted targets');

const courseJs = read('course.js');
assert(courseJs.includes('async function dbDeleteChunksForFile'), 'course.js should expose dbDeleteChunksForFile');
assert(courseJs.includes('function _reloadCourseExams()'), 'course.js should expose _reloadCourseExams');
assert(courseJs.includes('function _setCourseChapters'), 'course.js should expose _setCourseChapters');
assert(courseJs.includes("courseId === '__demo__'"), 'course.js should initialize demo tour for __demo__');

const demoTour = read('demo-tour.js');
assert(demoTour.includes('DEMO_MATERIALS'), 'demo-tour.js should seed multiple demo materials');
assert(demoTour.includes('demo_linear_algebra_guide_md'), 'demo-tour.js should seed the study guide material');
assert(demoTour.includes('demo_linear_algebra_original_excerpt_md'), 'demo-tour.js should seed the original PDF excerpt material');
assert(read('demo/linear-algebra-original-excerpt.md').includes('# Linear Algebra - Original PDF Excerpt'), 'original PDF excerpt markdown should exist');
vm.runInNewContext(demoTour, {
  window: {},
  document: {},
  localStorage: { getItem() {}, setItem() {}, removeItem() {} },
  console,
  TextEncoder,
  MutationObserver: function () {},
  confirm() { return false; },
  setTimeout,
});
assert(demoTour.includes('window.initDemoTour'), 'demo-tour.js should assign window.initDemoTour');
assert(demoTour.includes('loadDemoMaterialText'), 'demo-tour.js should load external demo markdown material');

console.log('demo tour verification OK');
