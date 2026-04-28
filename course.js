// ── PDF.js setup ──────────────────────────────────────────────────────────────
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── Storage ───────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'examTrackerCourses';

function loadCourses() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveCourses(courses) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
}

// ── Current course ────────────────────────────────────────────────────────────
const params = new URLSearchParams(location.search);
const courseId = params.get('id');
let courses = loadCourses();
let course = courses.find(c => c.id === courseId);

if (!course) {
  document.body.innerHTML = '<div style="padding:60px;text-align:center;color:#7B82A8">课程未找到 — <a href="index.html" style="color:#5B8DEF">返回首页</a></div>';
  throw new Error('course not found');
}

if (!course.chapters) course.chapters = [];

// ── DOM ───────────────────────────────────────────────────────────────────────
const topbarName      = document.getElementById('topbarName');
const topbarSubject   = document.getElementById('topbarSubject');
const heroMeta        = document.getElementById('heroMeta');
const heroPct         = document.getElementById('heroPct');
const heroFill        = document.getElementById('heroFill');
const heroCounts      = document.getElementById('heroCounts');
const importLanding   = document.getElementById('importLanding');
const chaptersWrap    = document.getElementById('chaptersWrap');
const chaptersList    = document.getElementById('chaptersList');
const courseHero      = document.getElementById('courseHero');

// ── Colour CSS var ────────────────────────────────────────────────────────────
document.documentElement.style.setProperty('--course-color', course.color || 'var(--accent)');
courseHero.style.borderBottom = `2px solid ${course.color}`;

// ── Render Header ─────────────────────────────────────────────────────────────
function renderHeader() {
  topbarName.textContent = course.name;
  topbarSubject.textContent = course.subject || '';

  const d = daysUntil(course.examDate);
  const dateStr = course.examDate
    ? new Date(course.examDate).toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' })
    : '–';

  let dClass = 'normal', dText = d !== null ? `还有 ${d} 天` : '–';
  if (d !== null) {
    if (d < 0)  { dClass = 'urgent'; dText = '已过期'; }
    if (d === 0){ dClass = 'urgent'; dText = '今天考试！'; }
    if (d <= 7) { dClass = 'urgent'; }
    else if (d <= 30) { dClass = 'soon'; }
  }

  heroMeta.innerHTML = `
    <div class="hero-meta-item">
      <span class="hero-meta-label">课程</span>
      <span class="hero-meta-value">${escHtml(course.name)}</span>
    </div>
    ${course.subject ? `
    <div class="hero-meta-item">
      <span class="hero-meta-label">科目</span>
      <span class="hero-meta-value">${escHtml(course.subject)}</span>
    </div>` : ''}
    ${course.examDate ? `
    <div class="hero-meta-item">
      <span class="hero-meta-label">考试日期</span>
      <span class="hero-meta-value">${dateStr}</span>
    </div>
    <div class="hero-meta-item">
      <span class="hero-meta-label">倒计时</span>
      <span class="hero-meta-value ${dClass}">${dText}</span>
    </div>` : ''}
  `;
}

function renderProgress() {
  let total = 0, done = 0;
  for (const ch of course.chapters) {
    for (const sec of ch.sections) {
      if (sec.subsections && sec.subsections.length > 0) {
        for (const sub of sec.subsections) { total++; if (sub.done) done++; }
      } else {
        total++; if (sec.done) done++;
      }
    }
  }
  const pct = total ? Math.round((done / total) * 100) : 0;
  heroPct.textContent = `${pct}%`;
  heroFill.style.width = `${pct}%`;
  heroFill.style.background = course.color || 'var(--accent)';
  heroCounts.textContent = total ? `已完成 ${done} / ${total} 个知识点` : '暂无章节 — 请导入或手动添加';

  course.completedTopics = done;
  course.totalTopics = total;
  course.progress = pct;
  persist();
}

// ── Render Chapters ───────────────────────────────────────────────────────────
function renderChapters() {
  if (course.chapters.length === 0) {
    importLanding.style.display = 'flex';
    chaptersWrap.style.display = 'none';
    return;
  }
  importLanding.style.display = 'none';
  chaptersWrap.style.display = 'block';
  chaptersList.innerHTML = '';
  course.chapters.forEach((ch, ci) => chaptersList.appendChild(buildChapterEl(ch, ci)));
}

function buildChapterEl(ch, ci) {
  const totalSecs = countLeaves(ch);
  const doneSecs  = countDoneLeaves(ch);
  const pct = totalSecs ? Math.round((doneSecs / totalSecs) * 100) : 0;
  const allDone = totalSecs > 0 && doneSecs === totalSecs;
  const partial  = doneSecs > 0 && !allDone;

  const el = document.createElement('div');
  el.className = 'chapter-item' + (ch.open !== false ? ' open' : '');
  el.innerHTML = `
    <div class="chapter-header">
      <span class="chapter-toggle">▶</span>
      <input type="checkbox" class="chapter-check ${partial ? 'partial' : ''}"
             ${allDone ? 'checked' : ''} data-ci="${ci}" />
      <div class="chapter-title-wrap">
        <div class="chapter-name">${escHtml(ch.title)}</div>
        <div class="chapter-sec-count">${totalSecs} 个知识点</div>
      </div>
      <div class="chapter-progress-mini">
        <div class="mini-bar"><div class="mini-fill" style="width:${pct}%;background:${course.color}"></div></div>
        <span class="mini-pct">${pct}%</span>
      </div>
    </div>
    <div class="sections-list" id="secs-${ch.id}"></div>
  `;

  const secList = el.querySelector('.sections-list');
  ch.sections.forEach((sec, si) => secList.appendChild(buildSectionEl(sec, ci, si)));

  // Toggle open/close
  el.querySelector('.chapter-header').addEventListener('click', (e) => {
    if (e.target.classList.contains('chapter-check')) return;
    el.classList.toggle('open');
    ch.open = el.classList.contains('open');
    persist();
  });

  // Chapter checkbox — check/uncheck all sections
  el.querySelector('.chapter-check').addEventListener('change', (e) => {
    const checked = e.target.checked;
    setAllInChapter(ch, checked);
    renderChapters();
    renderProgress();
  });

  return el;
}

function buildSectionEl(sec, ci, si) {
  const hasSubs = sec.subsections && sec.subsections.length > 0;
  const allDone = hasSubs
    ? sec.subsections.every(s => s.done)
    : sec.done;
  const partial = hasSubs && sec.subsections.some(s => s.done) && !allDone;

  const row = document.createElement('div');
  row.className = 'section-row' + (allDone && !hasSubs ? ' done' : '');
  row.innerHTML = `
    <input type="checkbox" class="section-check ${partial ? 'partial' : ''}"
           ${allDone ? 'checked' : ''} data-ci="${ci}" data-si="${si}" />
    <label class="section-label">${escHtml(sec.title)}</label>
    ${hasSubs ? '<span class="chapter-toggle" style="font-size:10px">▶</span>' : ''}
  `;

  if (hasSubs) {
    const subList = document.createElement('div');
    subList.className = 'subsection-list';
    subList.style.display = 'none';
    sec.subsections.forEach((sub, bi) => {
      const subRow = document.createElement('div');
      subRow.className = 'subsection-row' + (sub.done ? ' done' : '');
      subRow.innerHTML = `
        <input type="checkbox" class="subsection-check"
               ${sub.done ? 'checked' : ''} data-ci="${ci}" data-si="${si}" data-bi="${bi}" />
        <label class="subsection-label">${escHtml(sub.title)}</label>
      `;
      subRow.querySelector('.subsection-check').addEventListener('change', (e) => {
        course.chapters[ci].sections[si].subsections[bi].done = e.target.checked;
        persist(); renderChapters(); renderProgress();
      });
      subList.appendChild(subRow);
    });

    // Toggle subsections
    const toggle = row.querySelector('.chapter-toggle');
    toggle.style.cursor = 'pointer';
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = subList.style.display === 'none';
      subList.style.display = open ? 'block' : 'none';
      toggle.style.transform = open ? 'rotate(90deg)' : '';
    });

    // Append subList right after row in parent
    row.dataset.hasSubs = '1';
    const wrapper = document.createElement('div');
    wrapper.appendChild(row);
    wrapper.appendChild(subList);

    row.querySelector('.section-check').addEventListener('change', (e) => {
      const checked = e.target.checked;
      course.chapters[ci].sections[si].subsections.forEach(s => s.done = checked);
      persist(); renderChapters(); renderProgress();
    });
    return wrapper;
  }

  // Simple section (no subs)
  row.querySelector('.section-check').addEventListener('change', (e) => {
    course.chapters[ci].sections[si].done = e.target.checked;
    persist(); renderChapters(); renderProgress();
  });
  return row;
}

function setAllInChapter(ch, val) {
  ch.sections.forEach(sec => {
    sec.done = val;
    if (sec.subsections) sec.subsections.forEach(s => s.done = val);
  });
}

function countLeaves(ch) {
  let n = 0;
  for (const s of ch.sections) {
    n += (s.subsections && s.subsections.length > 0) ? s.subsections.length : 1;
  }
  return n;
}
function countDoneLeaves(ch) {
  let n = 0;
  for (const s of ch.sections) {
    if (s.subsections && s.subsections.length > 0) {
      n += s.subsections.filter(b => b.done).length;
    } else if (s.done) n++;
  }
  return n;
}

// ── Toolbar buttons ───────────────────────────────────────────────────────────
document.getElementById('btnExpandAll').addEventListener('click', () => {
  course.chapters.forEach(ch => ch.open = true);
  persist(); renderChapters();
});
document.getElementById('btnCollapseAll').addEventListener('click', () => {
  course.chapters.forEach(ch => ch.open = false);
  persist(); renderChapters();
});
document.getElementById('btnAddMore').addEventListener('click', openPdfModal);
document.getElementById('btnImportTop').addEventListener('click', openPdfModal);

// ══════════════════════════════════════════════════════════════════════════════
//  PDF IMPORT MODAL
// ══════════════════════════════════════════════════════════════════════════════

let extractedOutline = null;  // raw from PDF.js or parsed text
let pdfFileName = '';

// ── Open / close ──────────────────────────────────────────────────────────────
const pdfModal = document.getElementById('pdfModal');

function openPdfModal() {
  resetStep1();
  showStep(1);
  pdfModal.classList.add('open');
}
function closePdfModal() { pdfModal.classList.remove('open'); }

document.getElementById('pdfModalClose1').addEventListener('click', closePdfModal);
document.getElementById('pdfModalClose2').addEventListener('click', closePdfModal);
document.getElementById('step1Cancel').addEventListener('click', closePdfModal);
pdfModal.addEventListener('click', (e) => { if (e.target === pdfModal) closePdfModal(); });

function showStep(n) {
  document.getElementById('step1').style.display = n === 1 ? 'flex' : 'none';
  document.getElementById('step2').style.display = n === 2 ? 'flex' : 'none';
}

// ── Step 1: upload zone ───────────────────────────────────────────────────────
const pdfDrop     = document.getElementById('pdfDrop');
const pdfLoading  = document.getElementById('pdfLoading');
const pdfError    = document.getElementById('pdfError');
const pdfNoOutline= document.getElementById('pdfNoOutline');
const step1Footer = document.getElementById('step1Footer');

function resetStep1() {
  extractedOutline = null;
  pdfFileName = '';
  showSubstate('drop');
  step1Footer.style.display = 'none';
  document.getElementById('tocFileName').textContent = '';
  document.getElementById('rangeStart').value = '';
  document.getElementById('rangeEnd').value   = '';
}

function showSubstate(state) {
  pdfDrop.style.display      = state === 'drop'    ? 'flex' : 'none';
  pdfLoading.style.display   = state === 'loading' ? 'flex' : 'none';
  pdfError.style.display     = state === 'error'   ? 'flex' : 'none';
  pdfNoOutline.style.display = state === 'noOutline'? 'flex' : 'none';
}

// Drag & drop on drop zone
pdfDrop.addEventListener('dragover', (e) => { e.preventDefault(); pdfDrop.classList.add('drag-over'); });
pdfDrop.addEventListener('dragleave', () => pdfDrop.classList.remove('drag-over'));
pdfDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  pdfDrop.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handlePdfFile(file);
});

// Drag & drop on landing card (homepage panel)
const dropZoneCard = document.getElementById('dropZoneCard');
dropZoneCard.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneCard.classList.add('drag-over'); });
dropZoneCard.addEventListener('dragleave', () => dropZoneCard.classList.remove('drag-over'));
dropZoneCard.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZoneCard.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) { openPdfModal(); setTimeout(() => handlePdfFile(file), 50); }
});

// File pickers — reset value after read so the same file can be re-selected after clearing
document.getElementById('pdfFileModal').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) handlePdfFile(file);
});
document.getElementById('pdfFileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) { openPdfModal(); setTimeout(() => handlePdfFile(file), 50); }
});

document.getElementById('btnRetry').addEventListener('click', resetStep1);

// Parse from PDF
async function handlePdfFile(file) {
  if (!file.name.endsWith('.pdf')) {
    showError('请选择 .pdf 文件');
    return;
  }
  pdfFileName = file.name;
  showSubstate('loading');
  step1Footer.style.display = 'none';

  try {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const outline = await pdf.getOutline();

    if (!outline || outline.length === 0) {
      showSubstate('noOutline');
      return;
    }

    extractedOutline = normalizeOutline(outline);
    onOutlineReady();
  } catch (err) {
    showError('PDF 解析失败：' + err.message);
  }
}

function showError(msg) {
  document.getElementById('pdfErrorMsg').textContent = msg;
  showSubstate('error');
}

// Parse from pasted text
document.getElementById('btnParseText').addEventListener('click', () => {
  const text = document.getElementById('tocPaste').value.trim();
  if (!text) return;
  extractedOutline = parseTextTOC(text);
  if (!extractedOutline.length) { showToast('未能解析出章节，请检查格式'); return; }
  onOutlineReady();
});

function onOutlineReady() {
  document.getElementById('tocFileName').textContent = pdfFileName || '手动输入';
  step1Footer.style.display = 'flex';
}

document.getElementById('step1Next').addEventListener('click', () => {
  if (!extractedOutline) return;
  renderTOCTree(extractedOutline);
  showStep(2);
});

// ── Noise filter ──────────────────────────────────────────────────────────────
const NOISE_RE = /^(cover|preface|foreword|acknowledgements?|table\s+of\s+contents?|contents?$|index$|bibliography|references?$|about\s+the\s+author|copyright|dedication|glossary|half[\s-]?title|prologue|epilogue|colophon|封面|前言|目录|致谢|索引|参考文献|版权|推荐序|序言|作者简介|书名页|附录目录|图表目录|插图目录)/i;

function isNoise(title) {
  if (!title) return true;
  const t = title.trim();
  if (/^\d/.test(t)) return false;   // numbered items are never noise
  if (/^第.+[章篇部节]/u.test(t)) return false; // Chinese chapter headings kept
  return NOISE_RE.test(t);
}

// Section-level filter: keep only items whose title starts with a decimal number (e.g. "3.1")
function isSectionNoise(title) {
  if (!title) return true;
  return !/^\d+\.\d/.test(title.trim());
}

// ── Normalize PDF.js outline → {title, num, sections:[{title,num,subsections:[]}]} ──
function normalizeOutline(raw, depth = 0) {
  if (depth > 2 || !raw) return [];
  return raw
    .filter(item => !isNoise((item.title || '').trim()))
    .map(item => ({
      title: (item.title || '').trim(),
      num: extractNum((item.title || '').trim()),
      sections: depth === 0
        ? (item.items || [])
            .filter(sec => !isSectionNoise((sec.title || '').trim()))
            .map(sec => ({
              title: (sec.title || '').trim(),
              num: extractNum((sec.title || '').trim()),
              subsections: (sec.items || [])
                .filter(sub => !isSectionNoise((sub.title || '').trim()))
                .map(sub => ({
                  title: (sub.title || '').trim(),
                  num: extractNum((sub.title || '').trim()),
                }))
            }))
        : []
    }));
}

// ── Parse pasted plain text TOC ───────────────────────────────────────────────
function parseTextTOC(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const chapters = [];
  let curChapter = null, curSection = null;

  for (const line of lines) {
    if (isNoise(line)) continue;
    const level = detectLevel(line);
    // At section/subsection level, skip anything without a decimal number prefix
    if (level >= 1 && isSectionNoise(line)) continue;
    if (level === 0) {
      curChapter = { title: line, num: extractNum(line), sections: [] };
      chapters.push(curChapter);
      curSection = null;
    } else if (level === 1) {
      if (!curChapter) {
        curChapter = { title: '其他', num: null, sections: [] };
        chapters.push(curChapter);
      }
      curSection = { title: line, num: extractNum(line), subsections: [] };
      curChapter.sections.push(curSection);
    } else {
      if (!curSection) {
        if (!curChapter) { curChapter = { title: '其他', num: null, sections: [] }; chapters.push(curChapter); }
        curSection = { title: '其他', num: null, subsections: [] };
        curChapter.sections.push(curSection);
      }
      curSection.subsections.push({ title: line, num: extractNum(line) });
    }
  }
  return chapters;
}

function detectLevel(line) {
  // Chapter-level: starts with chapter keyword or single number
  if (/^(第.+[章篇部]|chapter|part|unit)\b/i.test(line)) return 0;
  const m = line.match(/^(\d+(?:\.\d+)*)/);
  if (!m) return 0;
  const dots = (m[1].match(/\./g) || []).length;
  if (dots === 0) return 0; // e.g. "3 ..."
  if (dots === 1) return 1; // e.g. "3.1 ..."
  return 2;                 // e.g. "3.1.1 ..."
}

// ══════════════════════════════════════════════════════════════════════════════
//  Step 2 — TOC Tree + Range selection
// ══════════════════════════════════════════════════════════════════════════════

function renderTOCTree(outline) {
  const tree = document.getElementById('tocTree');
  tree.innerHTML = '';
  outline.forEach((ch, ci) => tree.appendChild(buildTOCChapter(ch, ci)));
  updateSelCount();
}

function buildTOCChapter(ch, ci) {
  const secCount = ch.sections.length;
  const el = document.createElement('div');
  el.className = 'toc-chapter open';
  el.dataset.ci = ci;

  el.innerHTML = `
    <div class="toc-ch-header">
      <span class="toc-ch-arrow">▶</span>
      <input type="checkbox" class="toc-ch-check" data-ci="${ci}" />
      <span class="toc-ch-title">${escHtml(ch.title)}</span>
      <span class="toc-ch-count">${secCount} 小节</span>
    </div>
    <div class="toc-sec-list" id="tsl-${ci}"></div>
  `;

  const secList = el.querySelector('.toc-sec-list');
  ch.sections.forEach((sec, si) => secList.appendChild(buildTOCSection(sec, ci, si)));

  // Toggle
  el.querySelector('.toc-ch-header').addEventListener('click', (e) => {
    if (e.target.classList.contains('toc-ch-check')) return;
    el.classList.toggle('open');
  });

  // Chapter check → all sections
  const chkEl = el.querySelector('.toc-ch-check');
  chkEl.addEventListener('change', () => {
    const val = chkEl.checked;
    el.querySelectorAll('.toc-sec-check, .toc-sub-check').forEach(c => c.checked = val);
    refreshChapterCheckState(el);
    updateSelCount();
  });

  refreshChapterCheckState(el);
  return el;
}

function buildTOCSection(sec, ci, si) {
  const hasSubs = sec.subsections && sec.subsections.length > 0;
  const el = document.createElement('div');

  const row = document.createElement('div');
  row.className = 'toc-sec-row';
  row.dataset.ci = ci;
  row.dataset.si = si;
  row.dataset.num = sec.num || '';
  row.innerHTML = `
    <input type="checkbox" class="toc-sec-check" data-ci="${ci}" data-si="${si}" checked />
    <span class="toc-sec-title">${escHtml(sec.title)}</span>
    ${hasSubs ? '<span class="toc-ch-arrow" style="font-size:10px;cursor:pointer">▶</span>' : ''}
  `;

  row.querySelector('.toc-sec-check').addEventListener('change', () => {
    if (hasSubs) {
      const val = row.querySelector('.toc-sec-check').checked;
      el.querySelectorAll('.toc-sub-check').forEach(c => c.checked = val);
    }
    const chEl = row.closest('.toc-chapter');
    refreshChapterCheckState(chEl);
    updateSelCount();
  });

  el.appendChild(row);

  if (hasSubs) {
    const subList = document.createElement('div');
    subList.className = 'toc-sub-list';
    subList.style.display = 'block';

    sec.subsections.forEach((sub, bi) => {
      const subRow = document.createElement('div');
      subRow.className = 'toc-sub-row';
      subRow.dataset.num = sub.num || '';
      subRow.innerHTML = `
        <input type="checkbox" class="toc-sub-check" data-ci="${ci}" data-si="${si}" data-bi="${bi}" checked />
        <span class="toc-sub-title">${escHtml(sub.title)}</span>
      `;
      subRow.querySelector('.toc-sub-check').addEventListener('change', () => {
        const chEl = subRow.closest('.toc-chapter');
        refreshChapterCheckState(chEl);
        updateSelCount();
      });
      subList.appendChild(subRow);
    });

    // Toggle subsections
    const arrow = row.querySelector('.toc-ch-arrow');
    if (arrow) {
      arrow.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = subList.style.display !== 'none';
        subList.style.display = open ? 'none' : 'block';
        arrow.style.transform = open ? '' : 'rotate(90deg)';
      });
      arrow.style.transform = 'rotate(90deg)'; // starts open
    }

    el.appendChild(subList);
  }

  return el;
}

function refreshChapterCheckState(chEl) {
  if (!chEl) return;
  const checks = [...chEl.querySelectorAll('.toc-sec-check, .toc-sub-check')];
  const allOn  = checks.every(c => c.checked);
  const anyOn  = checks.some(c => c.checked);
  const chk    = chEl.querySelector('.toc-ch-check');
  if (!chk) return;
  chk.checked = allOn;
  chk.classList.toggle('partial', !allOn && anyOn);
}

function updateSelCount() {
  const secs = [...document.querySelectorAll('.toc-sec-check')].filter(c => c.checked).length;
  const subs = [...document.querySelectorAll('.toc-sub-check')].filter(c => c.checked).length;
  const chaps = [...document.querySelectorAll('.toc-ch-check')].filter(c => {
    const chEl = c.closest('.toc-chapter');
    if (!chEl) return false;
    const checks = [...chEl.querySelectorAll('.toc-sec-check, .toc-sub-check')];
    return checks.some(x => x.checked);
  }).length;
  document.getElementById('selCount').textContent = chaps;
  document.getElementById('selSecCount').textContent = subs > 0 ? subs : secs;
}

// ── Range apply ───────────────────────────────────────────────────────────────
document.getElementById('btnApplyRange').addEventListener('click', applyRange);
document.getElementById('rangeStart').addEventListener('keydown', e => { if (e.key === 'Enter') applyRange(); });
document.getElementById('rangeEnd').addEventListener('keydown',   e => { if (e.key === 'Enter') applyRange(); });

// Compare section numbers as ordered tuples, e.g. "6.11" > "6.3" > "6.2"
function cmpSecNum(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function applyRange() {
  const startStr = document.getElementById('rangeStart').value.trim();
  const endStr   = document.getElementById('rangeEnd').value.trim();
  if (!startStr && !endStr) return;

  document.querySelectorAll('.toc-sec-row').forEach(row => {
    const num = row.dataset.num;
    if (!num) return;
    const afterStart = !startStr || cmpSecNum(num, startStr) >= 0;
    const beforeEnd  = !endStr   || cmpSecNum(num, endStr)   <= 0;
    const inRange = afterStart && beforeEnd;
    const chk = row.querySelector('.toc-sec-check');
    if (chk) chk.checked = inRange;
    row.classList.toggle('in-range', inRange);
    const subList = row.nextElementSibling;
    if (subList && subList.classList.contains('toc-sub-list')) {
      subList.querySelectorAll('.toc-sub-check').forEach(c => c.checked = inRange);
    }
  });

  document.querySelectorAll('.toc-chapter').forEach(ch => refreshChapterCheckState(ch));
  updateSelCount();
  showToast(`已选范围 ${startStr || '起始'}  至  ${endStr || '结束'}`);
}

document.getElementById('btnSelAll').addEventListener('click', () => {
  document.querySelectorAll('.toc-sec-check, .toc-sub-check').forEach(c => c.checked = true);
  document.querySelectorAll('.toc-chapter').forEach(ch => refreshChapterCheckState(ch));
  updateSelCount();
});
document.getElementById('btnSelNone').addEventListener('click', () => {
  document.querySelectorAll('.toc-sec-check, .toc-sub-check').forEach(c => c.checked = false);
  document.querySelectorAll('.toc-chapter').forEach(ch => refreshChapterCheckState(ch));
  updateSelCount();
});

// ── Step 2 back ───────────────────────────────────────────────────────────────
document.getElementById('step2Back').addEventListener('click', () => {
  showStep(1);
  step1Footer.style.display = 'flex';
  showSubstate(extractedOutline ? 'drop' : 'drop');
  // Show "file loaded" state: re-show footer only
  if (extractedOutline) showSubstate('drop');
});

// ── Confirm Import ────────────────────────────────────────────────────────────
document.getElementById('btnImportConfirm').addEventListener('click', () => {
  const imported = buildChaptersFromTree();
  if (!imported.length) { showToast('请至少选择一个章节'); return; }

  // Merge: append non-duplicate chapters
  const existingTitles = new Set(course.chapters.map(c => c.title));
  let added = 0;
  for (const ch of imported) {
    if (!existingTitles.has(ch.title)) {
      course.chapters.push(ch);
      added++;
    }
  }

  persist();
  renderChapters();
  renderProgress();
  closePdfModal();
  showToast(`已导入 ${added} 个章节 ✓`);
});

function buildChaptersFromTree() {
  const chapters = [];
  document.querySelectorAll('.toc-chapter').forEach((chEl, ci) => {
    const secChecks = [...chEl.querySelectorAll('.toc-sec-check')];
    const selectedSecs = secChecks.filter(c => c.checked);
    if (selectedSecs.length === 0) return;

    const outChapter = extractedOutline[ci];
    const ch = {
      id: uid(),
      title: outChapter.title,
      num: outChapter.num,
      open: true,
      sections: [],
    };

    selectedSecs.forEach(secChk => {
      const si = parseInt(secChk.dataset.si);
      const outSec = outChapter.sections[si];
      if (!outSec) return;

      const subChecks = [...chEl.querySelectorAll(`.toc-sub-check[data-si="${si}"]`)].filter(c => c.checked);
      const sec = {
        id: uid(),
        title: outSec.title,
        num: outSec.num,
        done: false,
        subsections: subChecks.map(subChk => {
          const bi = parseInt(subChk.dataset.bi);
          const outSub = outSec.subsections[bi];
          return { id: uid(), title: outSub ? outSub.title : '', num: outSub ? outSub.num : null, done: false };
        }),
      };
      ch.sections.push(sec);
    });

    if (ch.sections.length > 0) chapters.push(ch);
  });
  return chapters;
}

// ══════════════════════════════════════════════════════════════════════════════
//  Manual Modal
// ══════════════════════════════════════════════════════════════════════════════
const manualModal = document.getElementById('manualModal');
document.getElementById('btnManualAdd').addEventListener('click', () => { manualModal.classList.add('open'); });
document.getElementById('manualClose').addEventListener('click', () => { manualModal.classList.remove('open'); });
document.getElementById('manualCancel').addEventListener('click', () => { manualModal.classList.remove('open'); });
manualModal.addEventListener('click', (e) => { if (e.target === manualModal) manualModal.classList.remove('open'); });

document.getElementById('manualConfirm').addEventListener('click', () => {
  const text = document.getElementById('manualText').value.trim();
  if (!text) return;
  const parsed = parseTextTOC(text);
  if (!parsed.length) { showToast('未能解析，请检查格式'); return; }

  const built = parsed.map(ch => ({
    id: uid(),
    title: ch.title,
    num: ch.num,
    open: true,
    sections: ch.sections.map(sec => ({
      id: uid(),
      title: sec.title,
      num: sec.num,
      done: false,
      subsections: (sec.subsections || []).map(sub => ({
        id: uid(), title: sub.title, num: sub.num, done: false,
      })),
    })),
  }));

  course.chapters.push(...built);
  persist(); renderChapters(); renderProgress();
  manualModal.classList.remove('open');
  document.getElementById('manualText').value = '';
  showToast(`已添加 ${built.length} 个章节 ✓`);
});

// ── Utils ─────────────────────────────────────────────────────────────────────

function extractNum(title) {
  if (!title) return null;
  const m = title.trim().match(/^(\d+(?:\.\d+)*)/);
  return m ? m[1] : null;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - Date.now()) / 86400000);
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function persist() {
  const idx = courses.findIndex(c => c.id === courseId);
  if (idx !== -1) { courses[idx] = course; saveCourses(courses); }
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ══════════════════════════════════════════════════════════════════════════════
//  Edit Course Modal
// ══════════════════════════════════════════════════════════════════════════════
const editCourseModal = document.getElementById('editCourseModal');
let editColor = course.color;

function openEditCourseModal() {
  document.getElementById('editName').value    = course.name;
  document.getElementById('editSubject').value = course.subject || '';
  document.getElementById('editDate').value    = course.examDate || '';
  editColor = course.color;
  document.querySelectorAll('#editColorPicker .color-swatch').forEach(s => {
    s.classList.toggle('selected', s.dataset.color === editColor);
  });
  editCourseModal.classList.add('open');
  document.getElementById('editName').focus();
}

function closeEditCourseModal() { editCourseModal.classList.remove('open'); }

document.getElementById('btnEditCourse').addEventListener('click', openEditCourseModal);
document.getElementById('editCourseClose').addEventListener('click', closeEditCourseModal);
document.getElementById('editCourseCancel').addEventListener('click', closeEditCourseModal);
editCourseModal.addEventListener('click', (e) => { if (e.target === editCourseModal) closeEditCourseModal(); });

document.getElementById('editColorPicker').addEventListener('click', (e) => {
  const swatch = e.target.closest('.color-swatch');
  if (!swatch) return;
  document.querySelectorAll('#editColorPicker .color-swatch').forEach(s => s.classList.remove('selected'));
  swatch.classList.add('selected');
  editColor = swatch.dataset.color;
});

document.getElementById('editCourseForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('editName').value.trim();
  if (!name) return;

  course.name     = name;
  course.subject  = document.getElementById('editSubject').value.trim();
  course.examDate = document.getElementById('editDate').value;
  course.color    = editColor;

  document.documentElement.style.setProperty('--course-color', course.color);
  courseHero.style.borderBottom = `2px solid ${course.color}`;

  persist();
  renderHeader();
  renderProgress();
  closeEditCourseModal();
  showToast('课程信息已更新 ✓');
});

// ══════════════════════════════════════════════════════════════════════════════
//  Reset Chapters (two-click confirmation)
// ══════════════════════════════════════════════════════════════════════════════
let resetTimer = null;
const btnReset = document.getElementById('btnResetChapters');

btnReset.addEventListener('click', function () {
  if (this.dataset.confirm === '1') {
    clearTimeout(resetTimer);
    course.chapters = [];
    persist();
    renderChapters();
    renderProgress();
    this.textContent = '重新开始';
    this.classList.remove('danger');
    delete this.dataset.confirm;
    showToast('目录已清空，可重新导入');
  } else {
    this.dataset.confirm = '1';
    this.textContent = '确认清空？';
    this.classList.add('danger');
    resetTimer = setTimeout(() => {
      this.textContent = '重新开始';
      this.classList.remove('danger');
      delete this.dataset.confirm;
    }, 3000);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  Materials (IndexedDB)
// ══════════════════════════════════════════════════════════════════════════════
let _idb = null;
function getDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((res, rej) => {
    const req = indexedDB.open('examTrackerFiles', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('files', { keyPath: 'id' });
    req.onsuccess = e => { _idb = e.target.result; res(_idb); };
    req.onerror = () => rej(req.error);
  });
}
async function dbSave(record) {
  const db = await getDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(record);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}
async function dbGetAll() {
  const db = await getDB();
  return new Promise((res, rej) => {
    const req = db.transaction('files', 'readonly').objectStore('files').getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function dbDelete(id) {
  const db = await getDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').delete(id);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

function fileIcon(type, name) {
  const n = (name || '').toLowerCase();
  if (type === 'application/pdf' || n.endsWith('.pdf')) return '📄';
  if (type.startsWith('image/')) return '🖼';
  if (n.endsWith('.pptx') || n.endsWith('.ppt')) return '📊';
  if (n.endsWith('.docx') || n.endsWith('.doc')) return '📝';
  if (n.endsWith('.txt')) return '📃';
  return '📎';
}
function fmtSize(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1048576).toFixed(1)} MB`;
}

async function renderMaterials() {
  const all   = await dbGetAll();
  const files = all.filter(f => f.courseId === courseId);
  const grid  = document.getElementById('materialsGrid');
  const empty = document.getElementById('materialsEmpty');
  grid.innerHTML = '';

  if (files.length === 0) {
    empty.style.display = 'flex';
    grid.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  grid.style.display = 'grid';

  files.forEach(f => {
    const card = document.createElement('div');
    card.className = 'material-card';
    card.innerHTML = `
      <div class="material-card-icon">${fileIcon(f.type, f.name)}</div>
      <div class="material-card-name" title="${escHtml(f.name)}">${escHtml(f.name)}</div>
      <div class="material-card-meta">${fmtSize(f.size)} · ${new Date(f.addedAt).toLocaleDateString('zh-CN')}</div>
      <div class="material-card-actions">
        <button class="btn-mat-open">查看</button>
        <button class="btn-mat-del">删除</button>
      </div>`;
    card.querySelector('.btn-mat-open').addEventListener('click', e => {
      e.stopPropagation();
      if (f.type === 'text/plain') { openTextEditModal(f); return; }
      const blob = new Blob([f.data], { type: f.type });
      const url  = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    });
    card.querySelector('.btn-mat-del').addEventListener('click', async e => {
      e.stopPropagation();
      await dbDelete(f.id);
      renderMaterials();
      showToast('已删除');
    });
    grid.appendChild(card);
  });
}

async function uploadMaterialFiles(fileList) {
  for (const file of fileList) {
    const data = await file.arrayBuffer();
    await dbSave({
      id: `mat_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      courseId,
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      data,
      addedAt: new Date().toISOString(),
    });
  }
  await renderMaterials();
  showToast(`已上传 ${fileList.length} 个文件`);
}

// File input
document.getElementById('materialFileInput').addEventListener('change', async e => {
  const files = Array.from(e.target.files);
  e.target.value = '';
  if (files.length) await uploadMaterialFiles(files);
});

// Drag-and-drop onto materials zone
const matDropZone = document.getElementById('materialsDropZone');
matDropZone.addEventListener('dragover', e => { e.preventDefault(); matDropZone.classList.add('drag-over'); });
matDropZone.addEventListener('dragleave', () => matDropZone.classList.remove('drag-over'));
matDropZone.addEventListener('drop', async e => {
  e.preventDefault();
  matDropZone.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files);
  if (files.length) await uploadMaterialFiles(files);
});

// Initialise
renderMaterials();

// ══════════════════════════════════════════════════════════════════════════════
//  AI Study Plan
// ══════════════════════════════════════════════════════════════════════════════
const aiModal        = document.getElementById('aiModal');
const aiSetupPanel   = document.getElementById('aiSetupPanel');
const aiChatPanel    = document.getElementById('aiChatPanel');
const aiChatMessages = document.getElementById('aiChatMessages');
const aiChatInput    = document.getElementById('aiChatInput');
const aiDaysLeft     = document.getElementById('aiDaysLeft');
const aiHoursPerDay  = document.getElementById('aiHoursPerDay');
const aiReviewGuide  = document.getElementById('aiReviewGuide');
let aiAbortCtrl      = null;
let aiGuideContent   = '';
let aiProvider       = 'gemini';
let aiConversation   = [];   // [{role:'user'|'assistant', content:string}]
let aiStreaming       = false;

document.querySelectorAll('.ai-provider-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ai-provider-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    aiProvider = btn.dataset.provider;
  });
});

function openAIModal() {
  const d = daysUntil(course.examDate);
  if (d !== null && d > 0) aiDaysLeft.value = d;
  showAISetup();
  aiModal.classList.add('open');
}
function closeAIModal() {
  if (aiAbortCtrl) { aiAbortCtrl.abort(); aiAbortCtrl = null; }
  aiModal.classList.remove('open');
}
function showAISetup() {
  aiSetupPanel.style.display = 'flex';
  aiChatPanel.style.display  = 'none';
}
function showAIChat() {
  aiSetupPanel.style.display = 'none';
  aiChatPanel.style.display  = 'flex';
}

document.getElementById('btnAIPlan').addEventListener('click', openAIModal);
document.getElementById('aiModalClose').addEventListener('click', closeAIModal);
document.getElementById('aiCancelBtn').addEventListener('click', closeAIModal);
document.getElementById('aiChatClose').addEventListener('click', closeAIModal);
document.getElementById('aiBtnRestart').addEventListener('click', () => {
  if (aiAbortCtrl) { aiAbortCtrl.abort(); aiAbortCtrl = null; }
  aiConversation = [];
  aiChatMessages.innerHTML = '';
  aiStreaming = false;
  showAISetup();
});
aiModal.addEventListener('click', e => { if (e.target === aiModal) closeAIModal(); });

// ── AI Guide Tabs ─────────────────────────────────────────────────────────────
function getActiveTab() {
  const active = document.querySelector('.ai-tab.active');
  return active ? active.dataset.tab : 'text';
}

document.querySelectorAll('.ai-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('aiPaneText').style.display = tab === 'text' ? 'flex' : 'none';
    document.getElementById('aiPanePdf').style.display  = tab === 'pdf'  ? 'flex' : 'none';
    document.getElementById('aiPaneUrl').style.display  = tab === 'url'  ? 'flex' : 'none';
    if (tab !== 'pdf') { /* keep aiGuideContent from pdf until user explicitly clears */ }
    if (tab !== 'url') { /* keep aiGuideContent from url until user explicitly clears */ }
    if (tab === 'text') aiGuideContent = '';
  });
});

// ── PDF tab: extract text ─────────────────────────────────────────────────────
function resetPdfPane() {
  document.getElementById('aiPdfZone').style.display   = 'flex';
  document.getElementById('aiPdfLoaded').style.display = 'none';
  aiGuideContent = '';
}

document.getElementById('aiPdfFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;

  document.getElementById('aiPdfZone').style.display   = 'none';
  document.getElementById('aiPdfLoaded').style.display = 'none';

  try {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = '';
    const maxPages = Math.min(pdf.numPages, 40);
    for (let i = 1; i <= maxPages; i++) {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(it => it.str).join(' ') + '\n';
    }
    aiGuideContent = text.trim().slice(0, 25000);

    document.getElementById('aiPdfName').textContent  = file.name;
    document.getElementById('aiPdfChars').textContent = `已提取 ${aiGuideContent.length} 字`;
    document.getElementById('aiPdfLoaded').style.display = 'flex';
  } catch (err) {
    document.getElementById('aiPdfZone').style.display = 'flex';
    showToast('PDF 提取失败：' + err.message);
  }
});

document.getElementById('aiPdfClear').addEventListener('click', resetPdfPane);

// ── URL tab: fetch content ────────────────────────────────────────────────────
function resetUrlPane() {
  document.getElementById('aiUrlLoaded').style.display = 'none';
  document.getElementById('aiUrlStatus').textContent   = '';
  aiGuideContent = '';
}

document.getElementById('aiFetchUrlBtn').addEventListener('click', async () => {
  const url    = document.getElementById('aiUrlInput').value.trim();
  const status = document.getElementById('aiUrlStatus');
  if (!url) { showToast('请输入链接'); return; }

  status.textContent = '正在获取页面内容…';
  document.getElementById('aiUrlLoaded').style.display = 'none';
  document.getElementById('aiFetchUrlBtn').disabled = true;

  try {
    const res  = await fetch('/api/fetch-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

    aiGuideContent = data.text;
    status.textContent = '';
    document.getElementById('aiUrlChars').textContent = `已提取 ${aiGuideContent.length} 字`;
    document.getElementById('aiUrlLoaded').style.display = 'flex';
  } catch (err) {
    status.textContent = '获取失败：' + err.message;
    aiGuideContent = '';
  } finally {
    document.getElementById('aiFetchUrlBtn').disabled = false;
  }
});

document.getElementById('aiUrlClear').addEventListener('click', resetUrlPane);

// ── Build first-turn context message ─────────────────────────────────────────
function buildContextMsg(daysLeft, hoursPerDay, reviewGuide) {
  const chapterText = course.chapters.map(ch => {
    const total = countLeaves(ch), done = countDoneLeaves(ch);
    const secLines = ch.sections.map(sec => {
      if (sec.subsections?.length > 0) {
        return `  - ${sec.title}\n` + sec.subsections.map(s => `    · ${s.title}${s.done ? ' ✓' : ''}`).join('\n');
      }
      return `  - ${sec.title}${sec.done ? ' ✓' : ''}`;
    }).join('\n');
    return `【${ch.title}】(${done}/${total} 已完成)\n${secLines}`;
  }).join('\n\n');

  return `距考试还有 ${daysLeft} 天，每天可用 ${hoursPerDay} 小时（共约 ${daysLeft * hoursPerDay} 小时）。

课程章节及复习进度：
${chapterText || '（暂无章节）'}

复习指导：
${reviewGuide || '（未提供）'}

请根据以上信息，生成一份按天分配的详细复习计划。`;
}

// ── Core: send one message and stream the response ────────────────────────────
async function sendAIMsg(userContent, displayLabel) {
  if (aiStreaming) return;
  aiStreaming = true;
  aiChatInput.disabled = true;
  document.getElementById('aiChatSend').disabled = true;

  aiConversation.push({ role: 'user', content: userContent });

  // User bubble
  const userEl = document.createElement('div');
  userEl.className = 'chat-msg chat-msg-user';
  userEl.innerHTML = `<div class="chat-bubble chat-bubble-user">${escHtml(displayLabel || userContent)}</div>`;
  aiChatMessages.appendChild(userEl);
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;

  // AI bubble (streaming placeholder)
  const aiMsgEl = document.createElement('div');
  aiMsgEl.className = 'chat-msg chat-msg-assistant';
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble chat-bubble-ai';
  bubble.innerHTML = '<div class="ai-generating"><span class="ai-spinner"></span>正在生成…</div>';
  aiMsgEl.appendChild(bubble);
  aiChatMessages.appendChild(aiMsgEl);
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;

  aiAbortCtrl = new AbortController();
  let fullText = '';

  try {
    const res = await fetch('/api/study-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: aiAbortCtrl.signal,
      body: JSON.stringify({
        provider:   aiProvider,
        courseName: course.name,
        subject:    course.subject,
        messages:   aiConversation,
      }),
    });

    if (!res.ok) {
      let errMsg;
      try { errMsg = (await res.json()).error; } catch { errMsg = await res.text(); }
      bubble.innerHTML = `<div class="ai-error">生成失败（${res.status}）：${escHtml(errMsg || '')}</div>`;
      aiConversation.pop();
      return;
    }

    bubble.innerHTML = '';
    const reader = res.body.getReader();
    const dec    = new TextDecoder();
    let buf      = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6);
        if (raw === '[DONE]') continue;
        try {
          const ev = JSON.parse(raw);
          if (ev.err) throw new Error(ev.err);
          if (ev.t) {
            fullText += ev.t;
            bubble.innerHTML = mdToHtml(fullText) + '<span class="ai-cursor"></span>';
            aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
          }
        } catch (e) { if (!(e instanceof SyntaxError)) throw e; }
      }
    }

    bubble.innerHTML = mdToHtml(fullText);
    aiConversation.push({ role: 'assistant', content: fullText });

    // Save-to-materials button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-save-msg';
    saveBtn.textContent = '💾 保存为资料';
    saveBtn.addEventListener('click', () => saveMsgAsMaterial(fullText));
    aiMsgEl.appendChild(saveBtn);

  } catch (err) {
    if (err.name === 'AbortError') { aiConversation.pop(); return; }
    bubble.innerHTML = `<div class="ai-error">网络错误：${escHtml(err.message)}</div>`;
    aiConversation.pop();
  } finally {
    aiStreaming = false;
    aiAbortCtrl = null;
    aiChatInput.disabled = false;
    document.getElementById('aiChatSend').disabled = false;
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
  }
}

// ── First generation ──────────────────────────────────────────────────────────
document.getElementById('aiBtnGenerate').addEventListener('click', async () => {
  const daysLeft    = parseFloat(aiDaysLeft.value)    || 7;
  const hoursPerDay = parseFloat(aiHoursPerDay.value) || 3;
  const tab         = getActiveTab();
  const reviewGuide = tab === 'text' ? aiReviewGuide.value.trim() : aiGuideContent;

  aiConversation   = [];
  aiChatMessages.innerHTML = '';
  showAIChat();

  const contextMsg   = buildContextMsg(daysLeft, hoursPerDay, reviewGuide);
  const displayLabel = `📋 生成复习计划 · ${daysLeft} 天 · 每天 ${hoursPerDay} 小时${reviewGuide ? ' · 含复习指导' : ''}`;
  await sendAIMsg(contextMsg, displayLabel);
});

// ── Follow-up chat ────────────────────────────────────────────────────────────
async function doSend() {
  const text = aiChatInput.value.trim();
  if (!text || aiStreaming) return;
  aiChatInput.value = '';
  await sendAIMsg(text);
}
document.getElementById('aiChatSend').addEventListener('click', doSend);
aiChatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
});

// ── Save AI message to materials ──────────────────────────────────────────────
async function saveMsgAsMaterial(content) {
  const now  = new Date();
  const pad  = n => String(n).padStart(2, '0');
  const name = `AI对话_${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.txt`;
  const data = new TextEncoder().encode(content).buffer;
  await dbSave({
    id: `mat_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    courseId, name, type: 'text/plain',
    size: data.byteLength, data, addedAt: now.toISOString(),
  });
  await renderMaterials();
  showToast('已保存到课程资料 ✓');
}

// ── Text edit modal ───────────────────────────────────────────────────────────
let textEditFileId = null;

function openTextEditModal(f) {
  textEditFileId = f.id;
  document.getElementById('textEditTitle').textContent = f.name;
  const text = new TextDecoder().decode(f.data);
  document.getElementById('textEditArea').value = text;
  document.getElementById('textEditModal').classList.add('open');
}
function closeTextEditModal() {
  document.getElementById('textEditModal').classList.remove('open');
  textEditFileId = null;
}

document.getElementById('textEditClose').addEventListener('click', closeTextEditModal);
document.getElementById('textEditCancel').addEventListener('click', closeTextEditModal);
document.getElementById('textEditModal').addEventListener('click', e => {
  if (e.target === document.getElementById('textEditModal')) closeTextEditModal();
});

document.getElementById('textEditSave').addEventListener('click', async () => {
  if (!textEditFileId) return;
  const text = document.getElementById('textEditArea').value;
  const data = new TextEncoder().encode(text).buffer;
  const all  = await dbGetAll();
  const orig = all.find(f => f.id === textEditFileId);
  if (!orig) return;
  await dbSave({ ...orig, data, size: data.byteLength });
  closeTextEditModal();
  await renderMaterials();
  showToast('已保存 ✓');
});

function mdToHtml(md) {
  const lines = md.split('\n');
  const out   = [];
  let inList  = false;

  for (const raw of lines) {
    const line = raw
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

    if (/^## /.test(raw)) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h2>${line.replace(/^## /, '')}</h2>`);
    } else if (/^### /.test(raw)) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h3>${line.replace(/^### /, '')}</h3>`);
    } else if (/^- /.test(raw)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${line.replace(/^- /, '')}</li>`);
    } else if (raw.trim() === '') {
      if (inList) { out.push('</ul>'); inList = false; }
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<p>${line}</p>`);
    }
  }
  if (inList) out.push('</ul>');
  return out.join('');
}

// ── Init ──────────────────────────────────────────────────────────────────────
renderHeader();
renderChapters();
renderProgress();
