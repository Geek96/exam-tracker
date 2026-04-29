/* ── i18n Strings ── */
var STRINGS = {
  zh: {
    appName: '复习追踪器', pageTitle: '考试复习追踪器',
    myCourses: '我的课程', addCourse: '+ 添加课程',
    noCoursesTitle: '还没有课程', noCoursesHint: '点击「添加课程」开始规划你的复习计划',
    addCourseTitle: '添加新课程', courseName: '课程名称', courseNamePh: '例：高等数学',
    category: '科目分类', examDate: '考试日期（可选）', color: '颜色标签',
    cancel: '取消', add: '添加',
    aiAssistant: 'AI 学习助手', aiSub: '我可以帮你制定复习计划、解答课程疑问、分析重点内容。',
    genPlan: '📋 生成复习计划', summarize: '📖 总结课程重点', quiz: '❓ 出题测验',
    askAI: '向 AI 助手提问…（Enter 发送，Shift+Enter 换行）',
    history: '历史', newChat: '＋ 新对话',
    langLabel: '语言',
  },
  en: {
    appName: 'Study Tracker', pageTitle: 'Exam Study Tracker',
    myCourses: 'My Courses', addCourse: '+ Add Course',
    noCoursesTitle: 'No courses yet', noCoursesHint: 'Click "Add Course" to start planning your study sessions',
    addCourseTitle: 'Add New Course', courseName: 'Course Name', courseNamePh: 'e.g. Calculus II',
    category: 'Category', examDate: 'Exam Date (optional)', color: 'Color',
    cancel: 'Cancel', add: 'Add',
    aiAssistant: 'AI Study Assistant', aiSub: 'I can help you create study plans, answer questions, and analyze key content.',
    genPlan: '📋 Generate Study Plan', summarize: '📖 Summarize Key Points', quiz: '❓ Quiz Me',
    askAI: 'Ask the AI assistant… (Enter to send, Shift+Enter for newline)',
    history: 'History', newChat: '＋ New Chat',
    langLabel: 'Language',
  },
  es: {
    appName: 'Seguidor de Estudio', pageTitle: 'Seguidor de Exámenes',
    myCourses: 'Mis Cursos', addCourse: '+ Agregar Curso',
    noCoursesTitle: 'Aún no hay cursos', noCoursesHint: 'Haz clic en "Agregar Curso" para comenzar',
    addCourseTitle: 'Agregar Nuevo Curso', courseName: 'Nombre del Curso', courseNamePh: 'Ej: Cálculo II',
    category: 'Categoría', examDate: 'Fecha del Examen (opcional)', color: 'Color',
    cancel: 'Cancelar', add: 'Agregar',
    aiAssistant: 'Asistente de Estudio IA', aiSub: 'Puedo ayudarte a crear planes de estudio, responder preguntas y analizar contenido clave.',
    genPlan: '📋 Generar Plan de Estudio', summarize: '📖 Resumir Puntos Clave', quiz: '❓ Hacerme Preguntas',
    askAI: 'Pregunta al asistente IA… (Enter para enviar)',
    history: 'Historial', newChat: '＋ Nueva Conversación',
    langLabel: 'Idioma',
  }
};

window.t = function(key) {
  var lang = localStorage.getItem('app_lang') || 'zh';
  return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.zh[key] || key;
};

window.applyStrings = function() {
  document.querySelectorAll('[data-i18n]').forEach(function(el) { el.textContent = window.t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(function(el) { el.placeholder = window.t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-title]').forEach(function(el) { el.title = window.t(el.dataset.i18nTitle); });
  var lang = localStorage.getItem('app_lang') || 'zh';
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang === 'es' ? 'es' : 'en';
};
