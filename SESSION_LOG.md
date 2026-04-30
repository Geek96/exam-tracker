# Session Log

> Canonical project session log. Entries are kept in reverse chronological order.

## 2026-04-30

**操作者**: Codex (GPT-5)

- 更新 `ROADMAP.md` 至 v29 当前状态，补充 M8 课程与考试管理重构里程碑，并同步 `STATUS.md` 当前功能与近期提交信息。
- 提交剩余项目说明文件改动：根目录 `AGENTS.md`、`CLAUDE.md` 架构规划补充、`ROADMAP.md` 路线图同步。
- 合并两份会话日志为根目录 `SESSION_LOG.md`，删除 `.agents/SESSION_LOG.md`，并将最新提交推送到 GitHub `main` 以触发 Vercel 自动部署。
- Implemented and accepted P6/P7/P8: fixed AI chat session persistence/display overflow, redesigned AI-readable file selection as a dropdown, renamed the app to 课程与考试管理, simplified course creation, and added local exam management.
- Updated `course.js` cache version to `v=29`, marked P6/P7/P8 as completed in `STATUS.md`, and renamed the implementation plan file with the `已完成-` prefix.
- 分析并诊断 P6 bug 根因：`sessPersist` 将最多 300 KB 的 Markdown 上下文写入 localStorage，在 Safari/iOS 等旧浏览器超配额时可能清空整个域名存储，导致课程数据丢失；同时 `renderSessionMessages` 在会话恢复时错误地展示了完整系统提示词而非用户输入。
- 编写 P6/P7/P8 完整实现计划，保存至 `docs/superpowers/plans/2026-04-30-p6-p7-p8-fixes-and-features.md`。
- 更新 `STATUS.md`，在 TASKS 板块添加 P6/P7/P8（新）三项待实现任务及版本路线。

## 2026-04-29

**操作者**: Codex (GPT-5)

- Implemented P6-P8 accepted features: batch PDF conversion summary toast, TOC source choice, two-step material deletion, and AI-readable Markdown file selection.
- Pre-wired DeepSeek provider code and UI, while keeping P5 open until `DEEPSEEK_API_KEY` is available for verification.
- Updated `course.js` cache version to `v=27` and synchronized `STATUS.md`, `ROADMAP.md`, and agent guidelines.

### 项目结构初始化 & i18n 完善

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

### 会话历史 & 欢迎页 & i18n 基础

**操作者**: Claude Sonnet 4.6

**涉及文件**: `course.html`, `course.css`, `course.js`, `index.html`, `styles.css`, `strings.js`, `welcome.html`, `welcome.css`, `api/study-plan.js`

**完成内容**:
- 多会话对话历史系统：每个课程的对话存储于 `localStorage`，支持同课程内多次独立会话
- 移除 ⚙/↺ 按钮，替换为 `🕐 历史` 侧边栏（占 AI 面板 1/3 宽度）
- 新建 `welcome.html` 欢迎页（选择语言 + 进入入口）和 `welcome.css`
- 新建 `strings.js` i18n 系统，支持中/英/西三语
- 课程列表页顶部语言切换按钮（中/EN/ES）
- `api/study-plan.js` 接收 `lang` 参数，AI 以对应语言回复

## 2026-04-28

### MinerU 大文件 & AI 上下文 & LaTeX 渲染

**操作者**: Claude Sonnet 4.6

**涉及文件**: `course.js`, `course.html`, `api/generate-toc.js`, `api/mineru-submit.js`

**完成内容**:
- PDF 超 199 页时自动分片（`splitPdfIfNeeded`），并行提交 MinerU（`Promise.all`）
- AI 上下文窗口：从 15K → 120K chars/文件，总 300K 上限
- MinerU 上传从 Vercel 代理 base64 改为浏览器直传 `tmpfiles.org`，解决 413 错误
- KaTeX auto-render：流式输出完成后调用 `renderMathInElement`，解决 LaTeX 不渲染问题
- Gemini TOC 生成：移除废弃模型，添加 `responseMimeType: 'application/json'`

### 项目初始化

**操作者**: 用户 (zhiyuan.daniel06@gmail.com)

**涉及文件**: 全部文件

**完成内容**:
- 项目初始化：课程列表页、课程详情页、AI 学习助手
- PDF 书签目录导入、手动添加章节
- Gemini 流式 AI 问答
- IndexedDB 课程资料存储
- MinerU PDF/HTML → Markdown 转换
- Vercel 部署配置
