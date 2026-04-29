# Sitemap & Route Structure

## 页面路由

```
/welcome.html          ← 入口页（首次访问，未设置语言时重定向至此）
    │
    └──► /index.html   ← 课程列表页（设置语言后的主页面）
              │
              └──► /course.html?id=<courseId>   ← 课程详情页
```

### 路由跳转逻辑

| 条件 | 跳转 |
|---|---|
| `app_lang` 未设置 | `index.html` → `welcome.html`（`app.js` 顶部重定向） |
| 用户选择语言并点击"进入" | `welcome.html` → `index.html` |
| 点击课程卡片 | `index.html` → `course.html?id=<courseId>` |
| 点击返回 | `course.html` → `index.html` |

---

## API 路由（Vercel Serverless Functions）

```
POST /api/study-plan        ← 流式 AI 问答（Gemini SSE）
POST /api/generate-toc      ← 从 MinerU Markdown 生成章节目录 JSON
POST /api/mineru-submit     ← 提交文件 URL 至 MinerU，返回 taskId
GET  /api/mineru-result     ← 轮询 MinerU 任务状态，返回 Markdown
```

### API 请求/响应格式

#### `POST /api/study-plan`
```json
// Request
{
  "courseName": "高等数学",
  "subject": "数学",
  "examDate": "2026-06-15",
  "daysLeft": 47,
  "hoursPerDay": 3,
  "chapterText": "第1章 极限...",
  "markdownContext": "# 第一章\n...",
  "reviewGuide": "",
  "lang": "zh",
  "history": [{ "role": "user", "parts": [{"text": "..."}] }]
}
// Response: text/event-stream (SSE)
```

#### `POST /api/generate-toc`
```json
// Request
{ "content": "<markdown string>", "range": "第3章到第5章" }
// Response
{ "chapters": [{ "title": "第3章", "sections": [...] }] }
```

#### `POST /api/mineru-submit`
```json
// Request
{ "url": "https://litter.catbox.moe/abc.pdf", "filename": "book.pdf", "fileType": "pdf" }
// Response
{ "taskId": "abc123" }
```

#### `GET /api/mineru-result?taskId=abc123`
```json
// Response (pending)
{ "status": "pending", "progress": 45 }
// Response (done)
{ "status": "done", "content": "# Chapter 1\n..." }
// Response (failed)
{ "status": "failed", "error": "..." }
```

---

## 数据存储结构

### localStorage

| 键 | 数据结构 | 说明 |
|---|---|---|
| `examTrackerCourses` | `Course[]` | 所有课程的元数据 + 章节结构 |
| `chatSessions_<courseId>` | `Session[]` | 某课程的所有对话会话 |
| `chatActive_<courseId>` | `string` | 当前活跃会话的 ID |
| `app_lang` | `"zh" \| "en" \| "es"` | 用户选择的界面语言 |

### IndexedDB（数据库名：`courseFiles`，表：`files`）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一标识（自动生成） |
| `courseId` | `string` | 所属课程 ID |
| `name` | `string` | 文件名 |
| `type` | `string` | MIME 类型 |
| `size` | `number` | 文件大小（字节） |
| `data` | `ArrayBuffer` | 文件原始数据 |
| `addedAt` | `number` | 添加时间戳 |
