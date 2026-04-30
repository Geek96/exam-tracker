# Session Log

## 2026-04-30

- 分析并诊断 P6 bug 根因：`sessPersist` 将最多 300 KB 的 Markdown 上下文写入 localStorage，在 Safari/iOS 等旧浏览器超配额时可能清空整个域名存储，导致课程数据丢失；同时 `renderSessionMessages` 在会话恢复时错误地展示了完整系统提示词而非用户输入。
- 编写 P6/P7/P8 完整实现计划，保存至 `docs/superpowers/plans/2026-04-30-p6-p7-p8-fixes-and-features.md`。
- 更新 `STATUS.md`，在 TASKS 板块添加 P6/P7/P8（新）三项待实现任务及版本路线。

## 2026-04-29

- Implemented P6-P8 accepted features: batch PDF conversion summary toast, TOC source choice, two-step material deletion, and AI-readable Markdown file selection.
- Pre-wired DeepSeek provider code and UI, while keeping P5 open until `DEEPSEEK_API_KEY` is available for verification.
- Updated `course.js` cache version to `v=27` and synchronized `STATUS.md`, `ROADMAP.md`, and agent guidelines.
