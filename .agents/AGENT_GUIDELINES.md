# Agent Guidelines — Exam Tracker

> 本文件是 AI Agent 的行为宪法。在修改任何代码前，请完整阅读本文件。

---

## 项目概览

**名称**: 复习追踪器 / Study Tracker  
**技术栈**: 纯浏览器 HTML + CSS + Vanilla JS，Vercel Serverless Functions（Node.js）  
**部署**: Vercel，通过 GitHub `main` 分支自动触发部署  
**无构建步骤**: 不使用任何打包工具（Vite/Webpack）。所有 JS 直接由浏览器加载。

---

## 1. 绝对禁止

| 禁止行为 | 原因 |
|---|---|
| 安装 npm 包（`npm install`）| 无构建步骤，浏览器直接加载文件，包会被忽略 |
| 提交 `.env` 或任何包含 API Key 的文件 | 安全红线 |
| 修改 `.vercel/` 目录内容 | 由 Vercel CLI 管理，手动修改会导致部署失效 |
| 删除或重命名现有 API 路由文件 | 会中断已部署的 Vercel Functions |
| 在未确认的情况下 `git push --force` | 会覆盖生产历史 |
| 在 HTML 中硬编码中文界面文字 | 必须通过 `data-i18n` + `strings.js` 处理 |

---

## 2. 文件版本控制

`course.html` 底部引用 JS 文件时携带版本号，防止浏览器缓存旧代码：

```html
<script src="course.js?v=21"></script>
```

**规则**：每次修改 `course.js` 后，必须同步递增 `course.html` 中的 `?v=N`。  
当前版本：`v=21`（每次修改后更新此处记录）。

---

## 3. 国际化（i18n）规约

- 所有界面文字必须通过 `strings.js` 的 `window.t(key)` 或 `window.tf(key, vars)` 读取
- 每新增一个字符串 key，必须同时填写 `zh`、`en`、`es` 三种语言的值
- HTML 静态文字使用 `data-i18n="key"` 属性，JS 动态文字使用 `window.t(key)`
- 含变量的字符串使用模板格式 `{varName}`，通过 `window.tf(key, {varName: value})` 渲染
- `applyStrings()` 在页面加载和语言切换时调用，处理所有 `data-i18n` 元素

---

## 4. 样式规约

- **主题**: 深色紫色 Holo 风格，CSS 变量定义在 `styles.css` 的 `:root` 中
- **不添加**亮色模式（Light Mode）
- 课程页专属样式写入 `course.css`，全局样式写入 `styles.css`
- CSS 变量命名：`--accent`（主色）、`--bg`（背景）、`--card`（卡片背景）、`--muted`（次要文字）

---

## 5. 数据存储规约

| 存储类型 | 用途 | 键名示例 |
|---|---|---|
| `localStorage` | 课程元数据、进度、会话 ID | `examTrackerCourses`, `chatSessions_<id>`, `chatActive_<id>`, `app_lang` |
| `IndexedDB`（`courseFiles` 数据库）| 课程资料文件（PDF/Markdown/图片）| 通过 `dbGet/dbSave/dbDelete` 函数操作 |

**不要**将文件二进制数据存入 `localStorage`（大小限制约 5MB）。

---

## 6. API 路由规约

所有 Serverless Functions 位于 `/api/` 目录：

| 文件 | 方法 | 功能 |
|---|---|---|
| `api/study-plan.js` | POST | 流式调用 Gemini 生成学习建议 |
| `api/generate-toc.js` | POST | 调用 Gemini 从 MinerU 内容生成目录结构 JSON |
| `api/mineru-submit.js` | POST | 提交文件 URL 到 MinerU，返回 taskId |
| `api/mineru-result.js` | GET | 轮询 MinerU 任务状态，返回 Markdown |

**环境变量**（仅在 Vercel Dashboard 中设置，不写入代码）：
- `GEMINI_API_KEY`
- `MINERU_API_KEY`

---

## 7. MinerU 文件上传规约

- 上传服务：`litterbox.catbox.moe`（72 小时临时链接）
- MinerU 每次任务**严格限制 < 200 页**（代码中用 199 作为分片阈值）
- 超过限制的 PDF 由 `splitPdfIfNeeded()` 使用 `pdf-lib` 在浏览器端分片
- 分片后并行提交（`Promise.all`），结果按顺序拼接为完整 Markdown

---

## 8. 第三方库（通过 CDN 加载）

| 库 | 版本 | 用途 |
|---|---|---|
| pdf.js | 3.11.174 | 客户端 PDF 书签解析 |
| pdf-lib | 1.17.1 | 客户端 PDF 分片 |
| KaTeX | 0.16.11 | LaTeX 数学公式渲染 |
| marked.js | 9.1.6 | Markdown → HTML |

不要替换为其他版本，除非有明确兼容性问题。

---

## 9. 提交规范

- 使用语义化提交信息：`fix:`, `feat:`, `refactor:`, `docs:`, `chore:`
- 每次提交后在 `SESSION_LOG.md` 追加一条记录
- 不跳过 pre-commit hooks（不使用 `--no-verify`）
