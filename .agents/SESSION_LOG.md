# Session Log

> 格式：`## YYYY-MM-DD — [主题]`，按时间倒序排列（最新在最上）。  
> 每次 Agent 会话结束后追加一条记录。

---

## 2026-04-29 — 项目结构初始化 & i18n 完善

**操作者**: Claude Sonnet 4.6  
**涉及文件**: `strings.js`, `course.js`, `course.html`, `app.js`, `.agents/`, `docs/`, `STATUS.md`, `README.md`

**完成内容**:
- 修复"添加课程"按钮双加号 bug（`btn-add-icon` + `addCourse` 字符串同时含 `+`）
- 完整翻译所有 UI 文字（~100 个字符串键）：课程资料查看/删除按钮、hero 区课程信息标签、PDF 导入弹窗全文、AI 面板全文
- 新增 `window.tf(key, vars)` 模板替换函数
- 新增 `appLocale()` 辅助函数，日期格式随语言自动切换
- 修复 MinerU 上传 `ERR_CERT_COMMON_NAME_INVALID`：从 `tmpfiles.org` 迁移到 `litterbox.catbox.moe`
- 新增首页跳转：`app_lang` 未设置的新用户自动重定向到 `welcome.html`
- 初始化项目文档目录结构（`.agents/`, `docs/`, `public/`, `src/`）

**下一步建议**:
- 验证 litterbox.catbox.moe 上传在各网络环境（含国内）的可用性
- 考虑添加上传失败后的回退服务（如 `0x0.st`）
- 探索是否需要将 `welcome.html` 注册为 Vercel 的根路由（`vercel.json` rewrites）

---

## 2026-04-29 — 会话历史 & 欢迎页 & i18n 基础

**操作者**: Claude Sonnet 4.6  
**涉及文件**: `course.html`, `course.css`, `course.js`, `index.html`, `styles.css`, `strings.js`, `welcome.html`, `welcome.css`, `api/study-plan.js`

**完成内容**:
- 多会话对话历史系统：每个课程的对话存储于 `localStorage`，支持同课程内多次独立会话
- 移除 ⚙/↺ 按钮，替换为 `🕐 历史` 侧边栏（占 AI 面板 1/3 宽度）
- 新建 `welcome.html` 欢迎页（选择语言 + 进入入口）和 `welcome.css`
- 新建 `strings.js` i18n 系统，支持中/英/西三语
- 课程列表页顶部语言切换按钮（中/EN/ES）
- `api/study-plan.js` 接收 `lang` 参数，AI 以对应语言回复

---

## 2026-04-28 — MinerU 大文件 & AI 上下文 & LaTeX 渲染

**操作者**: Claude Sonnet 4.6  
**涉及文件**: `course.js`, `course.html`, `api/generate-toc.js`, `api/mineru-submit.js`

**完成内容**:
- PDF 超 199 页时自动分片（`splitPdfIfNeeded`），并行提交 MinerU（`Promise.all`）
- AI 上下文窗口：从 15K → 120K chars/文件，总 300K 上限
- MinerU 上传从 Vercel 代理 base64 改为浏览器直传 `tmpfiles.org`，解决 413 错误
- KaTeX auto-render：流式输出完成后调用 `renderMathInElement`，解决 LaTeX 不渲染问题
- Gemini TOC 生成：移除废弃模型，添加 `responseMimeType: 'application/json'`

---

## 2026-04-28 — 项目初始化

**操作者**: 用户 (zhiyuan.daniel06@gmail.com)  
**涉及文件**: 全部文件

**完成内容**:
- 项目初始化：课程列表页、课程详情页、AI 学习助手
- PDF 书签目录导入、手动添加章节
- Gemini 流式 AI 问答
- IndexedDB 课程资料存储
- MinerU PDF/HTML → Markdown 转换
- Vercel 部署配置
